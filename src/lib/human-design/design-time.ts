/**
 * Human Design — the Design (unconscious) instant.
 *
 * The Design chart is cast for the moment at which the **Sun stood exactly 88°
 * of solar arc before** its natal position. It is *not* "88 days before birth".
 * Earth's orbital speed varies — fastest near perihelion in early January,
 * slowest near aphelion in early July — so 88° of solar arc takes roughly
 * **86–92 days**, and a flat `birth − 88 days` is wrong by up to four days.
 * That error moves the Design Moon by tens of degrees and can change the
 * Design Sun line, and therefore the **Profile and Incarnation Cross**.
 *
 * This module therefore root-finds on the Sun's apparent longitude. The Sun
 * moves ~1°/day and is strictly monotonic in the interval of interest, so
 * bisection on the arc difference converges to sub-second precision in ~60
 * iterations, with no ephemeris table and no approximation of the varying
 * orbital speed.
 */

import { sunPosition } from "../astronomy/ephemeris";

/** Solar arc, in degrees, between the Design Sun and the natal Sun. */
export const DESIGN_SOLAR_ARC_DEGREES = 88;

/**
 * Search window for the root-find, in days before birth.
 *
 * The bracket must *contain* the true answer for every birth date in the
 * Gregorian era: the extreme arcs are ~86.4 d (Sun at perihelion speed) and
 * ~91.9 d (aphelion speed), so `[80, 100]` has several days of margin on both
 * sides. The sign convention is `far = birth − 100 d` (largest arc) and
 * `near = birth − 80 d` (smallest arc).
 */
export const DESIGN_SEARCH_WINDOW_DAYS = { far: 100, near: 80 } as const;

/** Bisection depth. 60 halvings of a 20-day window is ~15 µs of time. */
const BISECTION_ITERATIONS = 60;

const MS_PER_DAY = 86_400_000;

/**
 * The Sun's solar arc *ahead of* a reference longitude, as a signed angle.
 *
 * `arc = signedAngularDifference(sunLongitude(date), referenceLongitude)`,
 * where the signed difference lives in `(-180, 180]`. For a date **before** the
 * reference instant the Sun has not yet reached the reference longitude, so the
 * result is **negative**: at 88° of solar arc before birth this returns `-88`,
 * and {@link solveDesignTime} solves `-arc = 88`.
 *
 * @param date Instant to sample.
 * @param referenceLongitude The natal Sun's apparent geocentric tropical
 *   longitude, in degrees. When omitted, the chart's own Sun at `date` is used,
 *   which makes the arc `0` and is only useful as a self-check.
 *
 * @remarks The value is monotonic in time over a window of a few weeks (and
 * uses a half-open, wrap-safe form), which is what lets the root-find compare
 * arcs instead of longitudes and so never trip over the 0°/360° seam.
 */
export function solarArcAt(date: Date, referenceLongitude?: number): number {
  const reference = referenceLongitude ?? sunPosition(date).longitude;
  return signedDifference(sunPosition(date).longitude, reference);
}

/** Signed angular difference `a − b`, in `(-180, 180]`. */
function signedDifference(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/** Degrees of solar arc travelled *before* the natal Sun. */
function arcFromTarget(date: Date, natalSunLongitude: number): number {
  // Negated so that the quantity is positive and increasing as we walk
  // backwards from birth: 0 at birth, 88 at the Design instant.
  return -signedDifference(sunPosition(date).longitude, natalSunLongitude);
}

/**
 * Find the instant at which the Sun was exactly 88° of solar arc behind the
 * Sun at `birthInstant`.
 *
 * @param birthInstant The natal (Personality) instant.
 * @returns The Design instant. It is always strictly earlier than
 *   `birthInstant`.
 *
 * @throws If the arc is not bracketed by the search window and cannot be
 *   bracketed by widening it to ±400 days — which would mean the ephemeris is
 *   returning something that is not a Sun.
 *
 * @remarks
 * - The root-find is on `signedAngularDifference(sunLon(birth), sunLon(t)) = −88°`
 *   (equivalently, 88° of arc travelled *before* birth), evaluated with
 *   bisection over `[birth − 100 d, birth − 80 d]`. Because the Sun's
 *   motion is not uniform, this is the only correct construction: sampling 88
 *   equal time steps would land on the wrong day for roughly half of all births.
 * - Convergence is checked against a `1e-9°` tolerance, well inside the
 *   ~0.9375° line width; the returned instant is accurate to well under a
 *   second, and any residual error is many orders of magnitude below the width
 *   of the finest base slice (18.75″).
 * - The Design Moon, Mercury…Pluto are all sampled at this one instant. There
 *   is no separate Design-Moon rule.
 */
export function solveDesignTime(birthInstant: Date): Date {
  const natalSunLongitude = sunPosition(birthInstant).longitude;

  let nearArc = 0;
  let farArc = 0;
  let low = birthInstant;
  let high = birthInstant;

  // The published window brackets every real birth date. Widen it symmetrically
  // rather than throwing if an unusual ephemeris ever pushes the root outside.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    low = new Date(
      birthInstant.getTime() -
        DESIGN_SEARCH_WINDOW_DAYS.near * MS_PER_DAY * (attempt + 1),
    );
    high = new Date(
      birthInstant.getTime() -
        DESIGN_SEARCH_WINDOW_DAYS.far * MS_PER_DAY * (attempt + 1),
    );
    nearArc = arcFromTarget(low, natalSunLongitude);
    farArc = arcFromTarget(high, natalSunLongitude);
    if (nearArc <= DESIGN_SOLAR_ARC_DEGREES && farArc >= DESIGN_SOLAR_ARC_DEGREES) {
      break;
    }
  }

  if (nearArc > DESIGN_SOLAR_ARC_DEGREES || farArc < DESIGN_SOLAR_ARC_DEGREES) {
    throw new Error(
      `solveDesignTime: could not bracket an 88° solar arc for ${birthInstant.toISOString()} ` +
        `(arc at -${DESIGN_SEARCH_WINDOW_DAYS.near} d = ${nearArc.toFixed(4)}°, ` +
        `arc at -${DESIGN_SEARCH_WINDOW_DAYS.far} d = ${farArc.toFixed(4)}°)`,
    );
  }

  let mid = low;

  for (let i = 0; i < BISECTION_ITERATIONS; i += 1) {
    mid = new Date((low.getTime() + high.getTime()) / 2);
    const delta = arcFromTarget(mid, natalSunLongitude) - DESIGN_SOLAR_ARC_DEGREES;

    if (Math.abs(delta) < 1e-9) return mid;

    if (delta > 0) {
      // Too far back: the arc is too large, move the upper bound in.
      high = mid;
    } else {
      low = mid;
    }
  }

  return mid;
}

/**
 * Convenience wrapper: the Design instant for a birth instant.
 *
 * Identical to {@link solveDesignTime}; exported under the name the rest of the
 * system reads as a noun rather than a verb.
 */
export function designInstant(birthInstant: Date): Date {
  return solveDesignTime(birthInstant);
}

/**
 * The elapsed time between the Design and Personality instants, in days.
 *
 * Exposed so callers and tests can assert that it is **not** 88, which is the
 * single most common way a Human Design chart is computed wrongly.
 */
export function designIntervalDays(birthInstant: Date): number {
  return (
    (birthInstant.getTime() - solveDesignTime(birthInstant).getTime()) /
    MS_PER_DAY
  );
}
