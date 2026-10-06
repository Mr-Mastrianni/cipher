/**
 * House systems: the chart angles, twelve cusp constructions, and the
 * longitude → house assignment.
 *
 * ACCURACY NOTES
 * --------------
 * - Inputs are decimal degrees. `ramc` is the right ascension of the Midheaven
 *   (= local apparent sidereal time), `obliquity` is the mean obliquity of the
 *   ecliptic. The ~9″ nutation-in-obliquity term is omitted (the provider only
 *   exposes the mean value); that moves a cusp by well under 0.01°, far below
 *   the 0.9375° Human Design line width.
 * - Placidus is solved by fixed-point iteration on the semi-arcs. Where a cusp
 *   is circumpolar (`|φ| + |δ| ≥ 90°`) no semi-arc exists and the system is
 *   undefined; we fall back to Porphyry and say so rather than emitting NaN.
 * - Koch, Regiomontanus and Campanus are NOT implemented. The research spec
 *   marks their pole/RA formulae `UNVERIFIED`, and a plausible-looking but
 *   wrong cusp table is worse than an honest fallback, so they resolve to
 *   Porphyry with `fallback: true` and a reason.
 */

import type { HouseCusps, HouseSystem } from "./types";
import { normalize } from "./zodiac";

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * Latitudes at or beyond the poles send `tan(φ)` to infinity. We clamp the
 * arithmetic to just inside the pole; the caller still sees the original value
 * in the chart metadata.
 */
const MAX_LATITUDE = 89.999_999;

/** Number of fixed-point passes for a Placidus cusp. Convergence is geometric. */
const PLACIDUS_ITERATIONS = 30;

/** Convergence tolerance, degrees. */
const PLACIDUS_TOLERANCE = 1e-9;

/** Residual tolerance for the final Placidus verification, degrees. */
const PLACIDUS_RESIDUAL_TOLERANCE = 1e-6;

function sinDeg(deg: number): number {
  return Math.sin(deg * RAD_PER_DEG);
}

function cosDeg(deg: number): number {
  return Math.cos(deg * RAD_PER_DEG);
}

function tanDeg(deg: number): number {
  return Math.tan(deg * RAD_PER_DEG);
}

function atan2Deg(y: number, x: number): number {
  return Math.atan2(y, x) * DEG_PER_RAD;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Wrap an angle into (-180, 180]. */
function wrap180(deg: number): number {
  const wrapped = normalize(deg);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/**
 * Ecliptic longitude of the Midheaven: the ecliptic point whose right
 * ascension equals `ramc`.
 *
 * Accuracy caveat: exact given a correct RAMC and obliquity; the dominant error
 * is the birth-time error (the MC moves roughly 15–20′ per minute of clock
 * time), not the trigonometry.
 */
export function midheaven(ramc: number, obliquity: number): number {
  return normalize(atan2Deg(sinDeg(ramc), cosDeg(ramc) * cosDeg(obliquity)));
}

/**
 * Ecliptic longitude of the Ascendant: the ecliptic point rising on the
 * eastern horizon for geographic latitude `latitude`.
 *
 * Accuracy caveat: ill-conditioned near the poles and, for the Vertex variant,
 * near the equator. Latitude is clamped to ±89.999999° so `tan(φ)` stays
 * finite. The Ascendant moves ≈ 15′ per minute of birth-time error at
 * mid-latitudes, which dominates every other term.
 */
export function ascendant(ramc: number, obliquity: number, latitude: number): number {
  const phi = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);
  const y = cosDeg(ramc);
  const x = -(sinDeg(ramc) * cosDeg(obliquity) + tanDeg(phi) * sinDeg(obliquity));
  return normalize(atan2Deg(y, x));
}

/**
 * Ecliptic longitude of the Vertex — the ecliptic point where the ecliptic
 * meets the prime vertical on the western side.
 *
 * Solved directly as a plane intersection rather than through the Ascendant
 * formula at the co-latitude: that shortcut needs a latitude above 90° for
 * every southern birth (which the Ascendant's clamp silently destroys) and
 * returns the Anti-Vertex for part of the low-latitude band.
 *
 * In equatorial coordinates the prime vertical is the great circle whose pole
 * is the north point of the horizon, `N = (−sinφ·cos RAMC, −sinφ·sin RAMC, cosφ)`.
 * An ecliptic point `P(λ) = (cosλ, sinλ·cosε, sinλ·sinε)` lies on it when
 * `P·N = 0`, giving two antipodal solutions; the Vertex is the one west of the
 * meridian, i.e. on the side of the west point `W = (sin RAMC, −cos RAMC, 0)`.
 *
 * Accuracy caveat: on the equator the prime vertical coincides with the
 * celestial equator and the Vertex degenerates to an equinox point. It is
 * reported with `precision: "derived"`. The opposite point is the Anti-Vertex.
 */
export function vertex(ramc: number, obliquity: number, latitude: number): number {
  const phi = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);
  const lambda = atan2Deg(
    sinDeg(phi) * cosDeg(ramc),
    cosDeg(phi) * sinDeg(obliquity) - sinDeg(phi) * cosDeg(obliquity) * sinDeg(ramc),
  );
  // Dot product of P(λ) with the west point: positive means west of the meridian.
  const west =
    cosDeg(lambda) * sinDeg(ramc) - sinDeg(lambda) * cosDeg(obliquity) * cosDeg(ramc);
  return normalize(west >= 0 ? lambda : lambda + 180);
}

/** Hour angle a semi-arc cusp must satisfy, given its own semi-arcs. */
function placidusHourAngle(cusp: 11 | 12 | 2 | 3, dsa: number, nsa: number): number {
  switch (cusp) {
    case 11:
      return -dsa / 3;
    case 12:
      return (-2 * dsa) / 3;
    case 2:
      return -dsa - nsa / 3;
    case 3:
      return -dsa - (2 * nsa) / 3;
  }
}

/**
 * Solve one Placidus intermediate cusp by fixed-point iteration.
 *
 * For a point at ecliptic longitude λ: δ = asin(sin ε · sin λ),
 * α = atan2(sin λ · cos ε, cos λ), H = wrap(RAMC − α),
 * DSA = acos(−tan φ · tan δ), NSA = 180° − DSA. We want the λ whose hour angle
 * equals the cusp's semi-arc fraction, then project α_target = RAMC − H back
 * onto the ecliptic with λ = atan2(sin α_target, cos α_target · cos ε).
 *
 * Returns `null` when the cusp is circumpolar (`|φ| + |δ| ≥ 90°`) or when the
 * iteration fails to converge onto the required hour angle — never NaN.
 */
function solvePlacidusCusp(
  ramc: number,
  obliquity: number,
  phi: number,
  cusp: 11 | 12 | 2 | 3,
  seed: number,
): number | null {
  const sinEps = sinDeg(obliquity);
  const cosEps = cosDeg(obliquity);
  const tanPhi = tanDeg(phi);

  let lambda = normalize(seed);

  for (let i = 0; i < PLACIDUS_ITERATIONS; i += 1) {
    const declination = Math.asin(clamp(sinEps * sinDeg(lambda), -1, 1)) * DEG_PER_RAD;
    if (Math.abs(phi) + Math.abs(declination) >= 90) return null;

    const dsa = Math.acos(clamp(-tanPhi * tanDeg(declination), -1, 1)) * DEG_PER_RAD;
    const nsa = 180 - dsa;
    const targetHourAngle = wrap180(placidusHourAngle(cusp, dsa, nsa));
    const targetRa = ramc - targetHourAngle;
    const next = normalize(atan2Deg(sinDeg(targetRa), cosDeg(targetRa) * cosEps));

    const moved = Math.abs(wrap180(next - lambda));
    lambda = next;
    if (moved < PLACIDUS_TOLERANCE) break;
  }

  // Verify the fixed point really satisfies the semi-arc condition.
  const declination = Math.asin(clamp(sinEps * sinDeg(lambda), -1, 1)) * DEG_PER_RAD;
  if (Math.abs(phi) + Math.abs(declination) >= 90) return null;

  const dsa = Math.acos(clamp(-tanPhi * tanDeg(declination), -1, 1)) * DEG_PER_RAD;
  const nsa = 180 - dsa;
  const target = wrap180(placidusHourAngle(cusp, dsa, nsa));
  const alpha = atan2Deg(sinDeg(lambda) * cosEps, cosDeg(lambda));
  const actual = wrap180(ramc - alpha);
  if (Math.abs(wrap180(actual - target)) > PLACIDUS_RESIDUAL_TOLERANCE) return null;

  return lambda;
}

/** True when `x` lies strictly inside the increasing-longitude arc `from` → `to`. */
function inZodiacalArc(x: number, from: number, to: number): boolean {
  const span = normalize(to - from);
  const offset = normalize(x - from);
  return offset > 0 && offset < span;
}

/**
 * Porphyry cusps: trisect the ecliptic arcs between the angles. Non-iterative
 * and defined at every latitude, which is why it is the polar fallback.
 */
function porphyryCusps(mc: number, asc: number, ic: number): number[] {
  const mcToAsc = normalize(asc - mc);
  const ascToIc = normalize(ic - asc);

  const cusp11 = normalize(mc + mcToAsc / 3);
  const cusp12 = normalize(mc + (2 * mcToAsc) / 3);
  const cusp2 = normalize(asc + ascToIc / 3);
  const cusp3 = normalize(asc + (2 * ascToIc) / 3);

  return [
    normalize(asc),
    cusp2,
    cusp3,
    normalize(ic),
    normalize(cusp11 + 180),
    normalize(cusp12 + 180),
    normalize(asc + 180),
    normalize(cusp2 + 180),
    normalize(cusp3 + 180),
    normalize(mc),
    cusp11,
    cusp12,
  ];
}

/**
 * Placidus cusps, or `null` when the system is undefined or fails to converge.
 *
 * At latitude 0 this reduces to cusps at RAMC + 30°, +60°, +90°, +120°, +150° in
 * right ascension, because DSA = NSA = 90° for every ecliptic degree there and
 * the iteration converges in a single step.
 */
function placidusCusps(ramc: number, obliquity: number, phi: number): number[] | null {
  const mc = midheaven(ramc, obliquity);
  const asc = ascendant(ramc, obliquity, phi);
  const ic = normalize(mc + 180);

  // Porphyry is a good seed and is always in the correct quadrant arc.
  const seed = porphyryCusps(mc, asc, ic);

  const cusp11 = solvePlacidusCusp(ramc, obliquity, phi, 11, seed[10]);
  const cusp12 = solvePlacidusCusp(ramc, obliquity, phi, 12, seed[11]);
  const cusp2 = solvePlacidusCusp(ramc, obliquity, phi, 2, seed[1]);
  const cusp3 = solvePlacidusCusp(ramc, obliquity, phi, 3, seed[2]);
  if (cusp11 === null || cusp12 === null || cusp2 === null || cusp3 === null) return null;

  // Each cusp must land in its own quadrant, otherwise the iteration converged
  // onto a different branch of the multi-valued semi-arc equation.
  if (!inZodiacalArc(cusp11, mc, asc) || !inZodiacalArc(cusp12, cusp11, asc)) return null;
  if (!inZodiacalArc(cusp2, asc, ic) || !inZodiacalArc(cusp3, cusp2, ic)) return null;

  return [
    asc,
    cusp2,
    cusp3,
    ic,
    normalize(cusp11 + 180),
    normalize(cusp12 + 180),
    normalize(asc + 180),
    normalize(cusp2 + 180),
    normalize(cusp3 + 180),
    mc,
    cusp11,
    cusp12,
  ];
}

/** Whole-sign cusps: cusp 1 is 0° of the sign containing the Ascendant, then +30°. */
function wholeSignCusps(asc: number): number[] {
  const start = Math.floor(normalize(asc) / 30) * 30;
  return Array.from({ length: 12 }, (_, index) => normalize(start + index * 30));
}

/** Equal cusps: cusp 1 is the exact Ascendant degree, then +30°. */
function equalCusps(asc: number): number[] {
  return Array.from({ length: 12 }, (_, index) => normalize(asc + index * 30));
}

/**
 * Twelve distinct cusps that tile the zodiac exactly once in increasing
 * longitude.
 *
 * Each forward arc is normalized into [0, 360), so the arcs sum to `360 × k`
 * for an integer winding number `k`. A strictly ordered, non-overlapping set has
 * `k = 1` with every arc positive; a degenerate high-latitude set can wind two
 * or three times, which is what makes `assignHouse` ambiguous. Hence the check
 * is "all arcs positive **and** the winding number is exactly one", not merely
 * "each cusp differs from the last".
 */
function isMonotonic(cusps: readonly number[]): boolean {
  let total = 0;
  for (let i = 0; i < cusps.length; i += 1) {
    const gap = normalize(cusps[(i + 1) % cusps.length] - cusps[i]);
    if (!(gap > 0)) return false;
    total += gap;
  }
  return Math.abs(total - 360) < 1e-6;
}

/** Normalize every cusp and reject non-finite results. */
function sanitize(cusps: readonly number[]): number[] | null {
  const out: number[] = [];
  for (const cusp of cusps) {
    if (!Number.isFinite(cusp)) return null;
    out.push(normalize(cusp));
  }
  return out;
}

/**
 * Compute the twelve house cusps for a chart.
 *
 * @param ramc Right ascension of the Midheaven in degrees (= local apparent
 *   sidereal time). Feed this from `last(date, longitudeEast)`.
 * @param obliquity Mean obliquity of the ecliptic in degrees.
 * @param latitude Geographic latitude in degrees, north positive.
 * @param system Requested house system.
 *
 * Placidus is undefined above the polar circles for part of the zodiac; in that
 * case (and for the systems this module deliberately does not implement) the
 * result carries `fallback: true`, an explicit `fallbackReason`, the original
 * request in `requestedSystem`, and Porphyry cusps in `system`. Non-finite
 * cusps are never returned.
 *
 * Beyond the Porphyry fallback there is one further safety net: past roughly
 * |φ| = 85° the ecliptic arc from the Midheaven to the Ascendant can exceed 180°
 * and even Porphyry's cusps collide, so the cusp list is no longer strictly
 * increasing and `assignHouse` would be ambiguous. In that degenerate regime the
 * result degrades to Equal houses (cusp 1 = Asc, +30° steps), which is monotonic
 * by construction, again with `fallback: true` and a reason.
 */
export function computeHouses(
  ramc: number,
  obliquity: number,
  latitude: number,
  system: HouseSystem,
): HouseCusps {
  const phi = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE);
  const mc = midheaven(ramc, obliquity);
  const asc = ascendant(ramc, obliquity, phi);
  const ic = normalize(mc + 180);

  let usedSystem: HouseSystem;
  let cusps: number[];
  let fallback: boolean;
  let reason: string | undefined;

  if (system === "placidus") {
    const solved = placidusCusps(ramc, obliquity, phi);
    if (solved) {
      usedSystem = "placidus";
      cusps = solved;
      fallback = false;
    } else {
      usedSystem = "porphyry";
      cusps = porphyryCusps(mc, asc, ic);
      fallback = true;
      reason =
        `Placidus is undefined at latitude ${latitude.toFixed(4)}°: at least one cusp is ` +
        `circumpolar (|latitude| + |declination| ≥ 90°), so its semi-arc does not exist. ` +
        `Fell back to Porphyry, which needs only the angles.`;
    }
  } else if (system === "porphyry") {
    usedSystem = "porphyry";
    cusps = porphyryCusps(mc, asc, ic);
    fallback = false;
  } else if (system === "whole-sign") {
    usedSystem = "whole-sign";
    cusps = wholeSignCusps(asc);
    fallback = false;
  } else if (system === "equal") {
    usedSystem = "equal";
    cusps = equalCusps(asc);
    fallback = false;
  } else {
    usedSystem = "porphyry";
    cusps = porphyryCusps(mc, asc, ic);
    fallback = true;
    reason =
      `${system} is not implemented by this engine. The published pole/RA formulae for ` +
      `Koch, Regiomontanus and Campanus are unverified against Swiss Ephemeris, and a ` +
      `plausible-looking but wrong cusp table is worse than an honest fallback, so the ` +
      `chart uses Porphyry (angles-only, always defined) instead.`;
  }

  const clean = sanitize(cusps);
  if (clean && isMonotonic(clean)) {
    return {
      system: usedSystem,
      requestedSystem: system,
      fallback,
      fallbackReason: reason,
      cusps: clean,
    };
  }

  const degenerate =
    `${usedSystem} cusps are degenerate at latitude ${latitude.toFixed(4)}°: the ecliptic ` +
    `arc between the Midheaven and the Ascendant exceeds 180°, so cusps coincide and cannot ` +
    `be put in zodiacal order.`;

  return {
    system: "equal",
    requestedSystem: system,
    fallback: true,
    fallbackReason: reason ? `${reason} ${degenerate} Used Equal houses instead.` : `${degenerate} Used Equal houses instead.`,
    cusps: equalCusps(asc),
  };
}

function isCuspArray(value: HouseCusps | readonly number[]): value is readonly number[] {
  return Array.isArray(value);
}

/**
 * Which house (1–12) a longitude falls in.
 *
 * Convention: half-open intervals `[cusp n, cusp n+1)` in zodiacal order, so a
 * point exactly on a cusp belongs to the house it is entering (the house that
 * cusp begins), and the 360°→0° wrap is handled. Never compares signs.
 *
 * Returns 1 for a degenerate cusp set rather than throwing.
 */
export function assignHouse(longitude: number, cusps: HouseCusps | readonly number[]): number {
  const list = isCuspArray(cusps) ? cusps : cusps.cusps;
  if (list.length < 2) return 1;

  const lon = normalize(longitude);

  for (let i = 0; i < list.length; i += 1) {
    const start = normalize(list[i]);
    const span = normalize(normalize(list[(i + 1) % list.length]) - start);
    if (span <= 0) continue;
    if (normalize(lon - start) < span) return i + 1;
  }

  // Degenerate, overlapping or unordered cusps: nearest preceding cusp.
  let best = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < list.length; i += 1) {
    const distance = normalize(lon - normalize(list[i]));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i + 1;
    }
  }
  return best;
}
