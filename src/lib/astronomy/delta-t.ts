/**
 * ΔT = TT − UT, in seconds — the time scale used by every ephemeris call.
 *
 * `astronomy-engine` defaults to the Espenak–Meeus polynomial, which runs
 * several seconds high for recent years (≈ 74 s for 2024 against an observed
 * ≈ 69.2 s). A 5 s error moves the Moon by ~2.7″, which matters at the
 * precision KP needs for present-day births.
 *
 * This replaces it with:
 * - before 2023.0: `astronomia`'s tables — historic values from 1657 and the
 *   IERS/USNO measured series from 1973 (polynomials before 1657);
 * - 2023.0 onward: the IERS-observed plateau of 69.2 s (ΔT has been flat to
 *   within ~0.2 s through 2023–2026), then a linear +0.4 s/yr extrapolation
 *   from 2027. Future ΔT is genuinely unknown (Earth's rotation has recently
 *   sped up), so a modest, continuous trend is the honest choice; it never
 *   jumps the way the stitched polynomials do at 2032 and 2050.
 *
 * Installed globally with `installDeltaT()` so that Human Design and KP share
 * one time scale.
 */

import * as Astronomy from "astronomy-engine";
import deltat from "astronomia/deltat";

const OBSERVED_PLATEAU_SECONDS = 69.2;
const PLATEAU_START = 2023.0;
const PLATEAU_END = 2027.0;
const DRIFT_SECONDS_PER_YEAR = 0.4;

/** ΔT in seconds for a decimal (Julian) year. */
export function deltaTForYear(year: number): number {
  if (year < PLATEAU_START) return deltat.deltaT(year);
  if (year < PLATEAU_END) return OBSERVED_PLATEAU_SECONDS;
  return OBSERVED_PLATEAU_SECONDS + (year - PLATEAU_END) * DRIFT_SECONDS_PER_YEAR;
}

/** ΔT in seconds for `ut` days since J2000 (the signature astronomy-engine expects). */
export function deltaTFromUt(ut: number): number {
  return deltaTForYear(2000 + ut / 365.25);
}

let installed = false;

/** Make every astronomy-engine time conversion use this ΔT. Idempotent. */
export function installDeltaT(): void {
  if (installed) return;
  Astronomy.SetDeltaTFunction(deltaTFromUt);
  installed = true;
}
