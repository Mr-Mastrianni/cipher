/**
 * The KP (Krishnamurti) ayanamsa.
 *
 * Definition, as implemented by the Swiss Ephemeris (SE_SIDM_KRISHNAMURTI):
 * 22°21′50″ (22.363889°) at J1900.0, carried forward with Newcomb precession.
 * Re-expressed against modern IAU 2006 precession, the *mean* ayanamsa is
 *
 *     A(T) = A₁₉₀₀ + [p_A(T) − p_A(−1)]
 *
 * where `p_A` is the IAU 2006 general precession in longitude, T is Julian
 * centuries of TT from J2000, and A₁₉₀₀ = 22°21′49.1724″ — the epoch value
 * after the Swiss Ephemeris' Newcomb-to-modern precession correction.
 *
 * Verified against Swiss Ephemeris 2.10 (`swetest -ay5 -nonut`):
 *   J1900  22°21′49.172″   J2000  23°45′36.864″   J2050  24°27′31.539″
 * all reproduced to better than 0.01″.
 *
 * The *true* ayanamsa adds nutation in longitude (Δψ). A sidereal longitude is
 * the apparent (true-equinox) tropical longitude minus the true ayanamsa, which
 * is what every KP ephemeris prints.
 */

import * as Astronomy from "astronomy-engine";

/** Mean KP ayanamsa at J1900.0 TT, in degrees. */
const AYANAMSA_J1900_MEAN = 22 + 21 / 60 + 49.1724 / 3600;

/** IAU 2006 general precession in longitude, arcseconds. */
function generalPrecessionArcsec(T: number): number {
  return (
    5028.796195 * T +
    1.1054348 * T ** 2 +
    0.00007964 * T ** 3 -
    0.000023857 * T ** 4 -
    0.0000000383 * T ** 5
  );
}

/** Julian centuries of TT since J2000 for a UT instant. */
function centuriesTT(date: Date): number {
  return Astronomy.MakeTime(date).tt / 36525;
}

/** Mean KP ayanamsa (no nutation), in degrees. */
export function kpAyanamsaMean(date: Date): number {
  const T = centuriesTT(date);
  return (
    AYANAMSA_J1900_MEAN +
    (generalPrecessionArcsec(T) - generalPrecessionArcsec(-1)) / 3600
  );
}

/** Nutation in longitude Δψ (IAU 2000B), in degrees. */
export function nutationInLongitude(date: Date): number {
  return Astronomy.e_tilt(Astronomy.MakeTime(date)).dpsi / 3600;
}

/** True KP ayanamsa (mean + nutation), in degrees. Subtract from apparent longitudes. */
export function kpAyanamsaTrue(date: Date): number {
  return kpAyanamsaMean(date) + nutationInLongitude(date);
}

/** True obliquity of the ecliptic (IAU 2006 mean + IAU 2000B nutation), in degrees. */
export function trueObliquity(date: Date): number {
  return Astronomy.e_tilt(Astronomy.MakeTime(date)).tobl;
}

/** Format an ayanamsa as `23°45′37″`. */
export function formatAyanamsa(degrees: number): string {
  const totalSeconds = Math.round(degrees * 3600);
  const d = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
}
