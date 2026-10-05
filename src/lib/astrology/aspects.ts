/**
 * Aspects: the classic angular relationships between two chart points,
 * computed on ecliptic longitude.
 *
 * ACCURACY NOTES
 * --------------
 * - Aspects are measured on apparent geocentric ecliptic longitude only, which
 *   is the mainstream Western convention. Latitude is ignored, so two points at
 *   the exact same longitude are a "conjunction" even when one is far off the
 *   ecliptic; that is intentional and matches astro.com.
 * - Orbs are a policy choice, not physics. The defaults below are a defensible
 *   modern scheme (the research spec's table): a per-aspect base orb sized for
 *   personal planets, plus a bonus when a luminary is involved, since the Sun
 *   and Moon are traditionally allowed wider orbs. Everything is overridable
 *   through `AspectOptions`.
 * - `applying` is derived from the two bodies' daily-motion `speed` values, not
 *   from a finite difference of the real ephemeris. It is therefore a
 *   first-order answer: it is exactly right except within a few hours of a
 *   station or of exactness, where the relative speed changes sign.
 */

import type { Aspect, AspectDefinition, PointKey, Position } from "./types";
import { separation } from "./zodiac";

/**
 * The twelve aspect definitions this engine understands, ordered by angle.
 *
 * `harmonic` is the vibration number of the aspect (360 / angle, rounded to the
 * family it belongs to: sesquiquadrate = 3 × 45° → the 8th harmonic,
 * biquintile = 2 × 72° → the 5th, quincunx = 5 × 30° → the 12th).
 * `glyph` is a display string, not a promise about font coverage.
 */
export const ASPECTS: readonly AspectDefinition[] = [
  { key: "conjunction", name: "Conjunction", angle: 0, orb: 8, major: true, harmonic: 1, glyph: "☌" },
  { key: "semisextile", name: "Semisextile", angle: 30, orb: 2, major: false, harmonic: 12, glyph: "⚺" },
  { key: "decile", name: "Decile", angle: 36, orb: 1, major: false, harmonic: 10, glyph: "D" },
  { key: "semisquare", name: "Semisquare", angle: 45, orb: 2, major: false, harmonic: 8, glyph: "∠" },
  { key: "sextile", name: "Sextile", angle: 60, orb: 5, major: true, harmonic: 6, glyph: "⚹" },
  { key: "quintile", name: "Quintile", angle: 72, orb: 1.5, major: false, harmonic: 5, glyph: "Q" },
  { key: "square", name: "Square", angle: 90, orb: 7, major: true, harmonic: 4, glyph: "□" },
  { key: "trine", name: "Trine", angle: 120, orb: 7, major: true, harmonic: 3, glyph: "△" },
  { key: "sesquiquadrate", name: "Sesquiquadrate", angle: 135, orb: 2, major: false, harmonic: 8, glyph: "⚼" },
  { key: "biquintile", name: "Biquintile", angle: 144, orb: 1.5, major: false, harmonic: 5, glyph: "BQ" },
  { key: "quincunx", name: "Quincunx", angle: 150, orb: 2, major: false, harmonic: 12, glyph: "⚻" },
  { key: "opposition", name: "Opposition", angle: 180, orb: 8, major: true, harmonic: 2, glyph: "☍" },
];

/**
 * Extra orb granted to an aspect when the Sun or Moon is one of the two points.
 * Conjunction and opposition get the full +2° (the traditional 10° luminary
 * orb), the major 60/90/120° aspects get +1°, minor aspects none.
 */
const LUMINARY_ORB_BONUS: Readonly<Record<string, number>> = {
  conjunction: 2,
  opposition: 2,
  trine: 1,
  square: 1,
  sextile: 1,
};

const LUMINARIES: ReadonlySet<PointKey> = new Set<PointKey>(["sun", "moon"]);

/** Caller-supplied aspect policy. Every field is optional. */
export interface AspectOptions {
  /** Restrict output to these aspect keys (e.g. `["conjunction", "square"]`). */
  include?: readonly string[];
  /** Absolute orb override per aspect key, replacing the default base orb. */
  orbOverrides?: Readonly<Record<string, number>>;
  /**
   * Absolute orb override per point pair, keyed `from:to`; either ordering is
   * accepted and the override replaces the whole computation for that pair.
   */
  pairOrbOverrides?: Readonly<Record<string, number>>;
  /** Multiplier applied to every allowance. Default 1. */
  orbScale?: number;
  /** Points to leave out of the aspect grid entirely. */
  exclude?: readonly PointKey[];
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** `from:to`, order-insensitive, for `pairOrbOverrides` lookup. */
function pairKey(a: PointKey, b: PointKey): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The orb allowance for one pairing under the active policy, in degrees. */
function orbAllowance(
  definition: AspectDefinition,
  from: Position,
  to: Position,
  options: AspectOptions,
): number {
  const scale = options.orbScale ?? 1;
  const pair = options.pairOrbOverrides?.[pairKey(from.key, to.key)];
  if (pair !== undefined) return pair * scale;

  const base = options.orbOverrides?.[definition.key] ?? definition.orb;
  const bonus =
    LUMINARIES.has(from.key) || LUMINARIES.has(to.key)
      ? LUMINARY_ORB_BONUS[definition.key] ?? 0
      : 0;

  return (base + bonus) * scale;
}

/**
 * Find every aspect between the supplied positions.
 *
 * All unordered pairs of entries are examined (angles and nodes included; use
 * `exclude` to drop them). For each aspect definition the directed target is
 * `+angle` when the signed separation is positive and `-angle` when it is
 * negative, and the returned `orb` is `separation - target` — signed, so its
 * sign says which side of exactness the pair sits on, and `|orb|` is the usual
 * deviation. Pairs whose `|orb|` exceeds the allowance are skipped.
 *
 * `applying` is true when `orb * relativeSpeed < 0`, i.e. when the deviation is
 * shrinking. A pair at dead-exactness or with zero relative speed reports
 * `applying: false`.
 *
 * `strength` is `1 - |orb| / allowance`, clamped to [0, 1]: 1 is exact.
 *
 * Output is sorted by strength descending, then by absolute orb, then by key so
 * the ordering is stable.
 */
export function computeAspects(
  positions: readonly Position[],
  options: AspectOptions = {},
): Aspect[] {
  const include = options.include;
  const definitions = include
    ? ASPECTS.filter((definition) => include.includes(definition.key))
    : ASPECTS;
  const excluded = new Set<PointKey>(options.exclude ?? []);
  const results: Aspect[] = [];

  for (let i = 0; i < positions.length; i += 1) {
    const from = positions[i];
    if (excluded.has(from.key)) continue;

    for (let j = i + 1; j < positions.length; j += 1) {
      const to = positions[j];
      if (excluded.has(to.key)) continue;

      // Signed separation of `to` relative to `from`, in (-180, 180].
      const signed = separation(from.longitude, to.longitude);
      const absolute = Math.abs(signed);
      const relativeSpeed = to.speed - from.speed;

      for (const definition of definitions) {
        const target = signed >= 0 ? definition.angle : -definition.angle;
        const orb = signed - target;
        const deviation = Math.abs(orb);

        const allowance = orbAllowance(definition, from, to, options);
        if (!(allowance > 0)) {
          if (deviation > 1e-9) continue;
          results.push({
            from: from.key,
            to: to.key,
            definition,
            separation: absolute,
            orb,
            applying: false,
            strength: 1,
          });
          continue;
        }

        if (deviation > allowance) continue;

        results.push({
          from: from.key,
          to: to.key,
          definition,
          separation: absolute,
          orb,
          applying: relativeSpeed !== 0 && orb * relativeSpeed < 0,
          strength: clamp01(1 - deviation / allowance),
        });
      }
    }
  }

  results.sort(
    (a, b) =>
      b.strength - a.strength ||
      Math.abs(a.orb) - Math.abs(b.orb) ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.definition.key.localeCompare(b.definition.key),
  );

  return results;
}
