/**
 * Human Design — ecliptic longitude → gate / line / colour / tone / base.
 *
 * The Rave Mandala overlays the 64 I-Ching hexagrams on the **tropical**
 * zodiac as 64 equal gates of 5.625°. The wheel is anchored so that **Gate 41
 * Line 1 begins at 302.000°**, which is 2°00′00″ Aquarius — the "Rave New
 * Year". Everything here is a pure function of longitude; there is no time
 * dependence and no ephemeris access, which is what makes this layer exactly
 * testable.
 *
 * ACCURACY CAVEATS
 * ----------------
 * - **Everything is floor + 1 on half-open intervals `[start, next)`.** A body
 *   sitting exactly on a boundary belongs to the *higher* slice. Rounding
 *   instead of flooring produces off-by-one errors at exactly the longitudes
 *   an astrologer is most likely to be looking at.
 * - **Gate, line and colour are robust** to any birth time that is accurate to
 *   the minute. **Tone is not** (it is 93.75″ wide) and **base is not**
 *   (18.75″ wide): the Moon moves ~33″ per minute of clock time, so one minute
 *   of uncertainty is ~1.8 base slices. Use {@link boundaryDistance} — and the
 *   `signals` array on the bodygraph — to surface that honestly instead of
 *   printing a confident Base.
 * - Longitudes are assumed to be **apparent geocentric tropical** longitudes
 *   (aberration and nutation included), normalised into `[0, 360)`. A sidereal
 *   longitude would be wrong by ~24° — more than four gates.
 */

import {
  BASE_ARC,
  COLOR_ARC,
  GATE_ARC,
  GATE_WHEEL,
  LINE_ARC,
  TONE_ARC,
  WHEEL_START_DEGREES,
} from "./constants";
import { normalize } from "../astronomy/angles";

/** The 13 bodies Human Design activates, in canonical display order. */
export type BodyKey =
  | "sun"
  | "earth"
  | "moon"
  | "northNode"
  | "southNode"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

/** The canonical order of the 13 activations, personality and design alike. */
export const HD_BODY_ORDER: readonly BodyKey[] = [
  "sun",
  "earth",
  "moon",
  "northNode",
  "southNode",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;

/** Human-readable label per body, for UI use. */
export const HD_BODY_LABEL: Readonly<Record<BodyKey, string>> = {
  sun: "Sun",
  earth: "Earth",
  moon: "Moon",
  northNode: "North Node",
  southNode: "South Node",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
};

/** Which chart an activation belongs to: conscious (personality) or unconscious (design). */
export type ActivationSource = "personality" | "design";

/** Maximum values of the sub-line slices. Base is a 5-fold division, not 6. */
const MAX_COLOR = 6;
const MAX_TONE = 6;
const MAX_BASE = 5;

/**
 * A single substructure reading.
 *
 * Every index is **1-based**, matching how the system is printed: gate 1–64,
 * line 1–6, colour 1–6, tone 1–6, base 1–5.
 */
export interface GateLinePosition {
  /** 1–64. */
  gate: number;
  /** 1–6. */
  line: number;
  /** 1–6. */
  color: number;
  /** 1–6. */
  tone: number;
  /** 1–5. */
  base: number;
  /** Fraction of the way through the gate, `[0, 1)`. */
  gateProgress: number;
  /** Fraction of the way through the line, `[0, 1)`. */
  lineProgress: number;
}

/**
 * How close an activation sits to the slice edges that decide the reading.
 *
 * Both values are degrees of ecliptic longitude. A value of `0` means the body
 * is *exactly* on the boundary.
 */
export interface BoundaryDistance {
  /** Degrees to the nearest line edge (line edges are also gate edges). */
  toLineBoundary: number;
  /** Degrees to the nearest gate edge (both ends of the gate count). */
  toGateBoundary: number;
}

/** A single conscious or unconscious activation of one body. */
export interface Activation {
  body: BodyKey;
  source: ActivationSource;
  /** Apparent geocentric tropical ecliptic longitude in `[0, 360)`. */
  longitude: number;
  /** 1–64. */
  gate: number;
  /** 1–6. */
  line: number;
  /** 1–6. */
  color: number;
  /** 1–6. */
  tone: number;
  /** 1–5. */
  base: number;
  /** How near this activation sits to a slice boundary. */
  boundary: BoundaryDistance;
}

/** Clamp a 1-based index into `[1, max]`, guarding the floating-point tails. */
function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return value > max ? max : value;
}

/** The internal, fully resolved arc position (never clamped, never exact-only). */
interface ArcPosition {
  gate: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  gateProgress: number;
  lineProgress: number;
}

/**
 * Exact, unclamped slice arithmetic.
 *
 * Kept separate from {@link gateLineFromLongitude} so that the boundary helpers
 * can reason about an offset of exactly `0` without the epsilon guards that the
 * public reader applies.
 */
function arcPositionOfOffset(offset: number): ArcPosition {
  const gateIndex = Math.floor(offset / GATE_ARC);
  const withinGate = offset - gateIndex * GATE_ARC;
  const lineIndex = Math.floor(withinGate / LINE_ARC);
  const withinLine = withinGate - lineIndex * LINE_ARC;
  const colorIndex = Math.floor(withinLine / COLOR_ARC);
  const withinColor = withinLine - colorIndex * COLOR_ARC;
  const toneIndex = Math.floor(withinColor / TONE_ARC);
  const withinTone = withinColor - toneIndex * TONE_ARC;
  const baseIndex = Math.floor(withinTone / BASE_ARC);

  return {
    gate: GATE_WHEEL[gateIndex],
    line: lineIndex + 1,
    color: colorIndex + 1,
    tone: toneIndex + 1,
    base: baseIndex + 1,
    gateProgress: withinGate / GATE_ARC,
    lineProgress: withinLine / LINE_ARC,
  };
}

/** Normalised offset from the start of Gate 41, in `[0, 360)`. */
function wheelOffset(longitude: number): number {
  return normalize(longitude - WHEEL_START_DEGREES);
}

/**
 * Resolve an ecliptic longitude to its gate, line, colour, tone and base.
 *
 * @param longitude Apparent geocentric **tropical** ecliptic longitude in
 *   degrees. Any real value is accepted; it is normalised into `[0, 360)`.
 *
 * @remarks
 * Uses floor-based selection on half-open intervals, so a longitude exactly on
 * a boundary belongs to the higher slice. The base index is clamped to 5
 * because base is the only 5-fold division; at an exact tone edge the raw
 * arithmetic can otherwise report 6.
 *
 * Caveats: gate, line and colour are reliable for any birth time accurate to
 * the minute. **Tone and base are not** — see {@link boundaryDistance}.
 */
export function gateLineFromLongitude(longitude: number): GateLinePosition {
  const raw = arcPositionOfOffset(wheelOffset(longitude));

  // Guard the floating-point tail: an offset that lands within a few ULPs of
  // 360 can produce a base index of 6 on the last tone of the last gate.
  const gate = clampIndex(raw.gate, 64);
  const line = clampIndex(raw.line, 6);
  const color = clampIndex(raw.color, MAX_COLOR);
  const tone = clampIndex(raw.tone, MAX_TONE);
  const base = clampIndex(raw.base, MAX_BASE);

  const gateProgress = raw.gateProgress < 0 ? 0 : raw.gateProgress;
  const lineProgress = raw.lineProgress < 0 ? 0 : raw.lineProgress;

  return { gate, line, color, tone, base, gateProgress, lineProgress };
}

/**
 * Degrees travelled into the current gate, in `[0, 5.625)`.
 *
 * Useful for rendering the gate ring and for reasoning about how much of a
 * gate remains before the next one begins.
 */
export function degreesIntoGate(longitude: number): number {
  return wheelOffset(longitude) % GATE_ARC;
}

/**
 * Degrees travelled into the current line, in `[0, 0.9375)`.
 *
 * This is the finest quantity an ordinary birth time can support confidently;
 * the colour, tone and base subdivisions live inside it.
 */
export function degreesIntoLine(longitude: number): number {
  return wheelOffset(longitude) % LINE_ARC;
}

/** Distance from a value to the nearer of its two enclosing edges. */
function distanceToNearestEdge(value: number, width: number): number {
  const ratio = value / width;
  const fraction = ratio - Math.floor(ratio);
  return Math.min(fraction, 1 - fraction) * width;
}

/**
 * How many degrees the longitude sits from the nearest line and gate boundary.
 *
 * This is the number that drives an honest accuracy warning: an activation
 * whose `toLineBoundary` is under ~0.02° can flip line (and therefore profile,
 * cross quartet and variable colour) on a birth time that is wrong by a couple
 * of minutes, and a `toLineBoundary` of 0 cannot be resolved at all without a
 * to-the-second time.
 *
 * @returns Both distances in degrees, each in `[0, half-slice-width]`.
 */
export function boundaryDistance(longitude: number): BoundaryDistance {
  const offset = wheelOffset(longitude);
  const withinGate = offset % GATE_ARC;

  return {
    toLineBoundary: distanceToNearestEdge(offset, LINE_ARC),
    toGateBoundary: distanceToNearestEdge(withinGate, GATE_ARC),
  };
}

/**
 * The default sensitivity threshold, in degrees.
 *
 * 0.02° ≈ 72″ of longitude. At the Moon's ~33″ per minute of clock time that is
 * a little over two minutes of birth-time uncertainty; anything tighter than
 * this should be presented as provisional.
 */
export const BOUNDARY_WARNING_DEGREES = 0.02;
