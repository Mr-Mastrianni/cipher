/**
 * Sidereal (KP) positions of the nine grahas and the twelve KP cusps.
 *
 * Planets and Moon: apparent geocentric longitude on the mean ecliptic of date
 * from full VSOP87D / ELP-MPP02 (`./ephemeris`), minus the MEAN KP ayanamsa.
 * That equals a KP ephemeris' true-equinox longitude minus the true ayanamsa:
 * nutation cancels.
 *
 * Nodes: KP software defaults to the MEAN node, which is what most KP
 * practitioners use; the TRUE (osculating) node is available as an explicit
 * option. They differ by up to ~1.7°, enough to change a sub lord, so the
 * chosen node is always labelled. Ketu is exactly opposite Rahu.
 *
 * Cusps: Placidus, which is the KP house system, computed from apparent
 * sidereal time and the TRUE obliquity, then shifted by the true ayanamsa.
 * Placidus is undefined where part of the ecliptic is circumpolar (beyond
 * roughly ±66° latitude). KP has no substitute house system, so such charts
 * are refused rather than silently computed with another system.
 *
 * Verified against Swiss Ephemeris 2.10 (`swetest -sid5`) over 16 charts from
 * 1900 to 2049 — see `__tests__/kp.test.ts`.
 */

import { gast } from "../astronomy/ephemeris";
import { ascendant, midheaven, placidusCusps } from "../astronomy/houses";
import { kpAyanamsaMean, kpAyanamsaTrue, trueObliquity } from "./ayanamsa";
import { apparentMoon, apparentPlanet, jde, meanNode, trueNodeOfDate } from "./ephemeris";
import { normalizeDegrees } from "./lords";
import type { Graha } from "./constants";

/** Which lunar node Rahu/Ketu are computed from. */
export type NodeType = "mean" | "true";

export interface SiderealPosition {
  graha: Graha;
  /** Sidereal longitude, [0, 360). */
  longitude: number;
  /** Ecliptic latitude, degrees (0 for the nodes). */
  latitude: number;
  /** Degrees per day; negative is retrograde. */
  speed: number;
  retrograde: boolean;
}

function signedDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/** Tropical (mean equinox of date) longitude and latitude of one graha. */
function tropicalOfDate(graha: Graha, jd: number, nodeType: NodeType): { lon: number; lat: number } {
  switch (graha) {
    case "moon":
      return apparentMoon(jd);
    case "rahu":
      return { lon: nodeType === "mean" ? meanNode(jd) : trueNodeOfDate(jd), lat: 0 };
    case "ketu":
      return { lon: normalizeDegrees(tropicalOfDate("rahu", jd, nodeType).lon + 180), lat: 0 };
    default:
      return apparentPlanet(graha, jd);
  }
}

/** Sidereal longitude of one graha. */
export function siderealLongitude(graha: Graha, date: Date, nodeType: NodeType): number {
  return normalizeDegrees(tropicalOfDate(graha, jde(date), nodeType).lon - kpAyanamsaMean(date));
}

/** Sidereal positions of all nine grahas, with speeds from a ±6 h central difference. */
export function siderealPositions(date: Date, nodeType: NodeType = "mean"): SiderealPosition[] {
  const h = 0.25;
  const before = new Date(date.getTime() - h * 86_400_000);
  const after = new Date(date.getTime() + h * 86_400_000);
  const grahas: Graha[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
  return grahas.map((graha) => {
    const longitude = siderealLongitude(graha, date, nodeType);
    const speed =
      signedDelta(siderealLongitude(graha, after, nodeType), siderealLongitude(graha, before, nodeType)) /
      (2 * h);
    const latitude = tropicalOfDate(graha, jde(date), nodeType).lat;
    // The mean node always regresses; for the true node, trust the sign of motion.
    const retrograde = graha === "rahu" || graha === "ketu" ? nodeType === "mean" || speed < 0 : speed < 0;
    return { graha, longitude, latitude, speed, retrograde };
  });
}

export interface KpCusps {
  /** Sidereal cusps 1–12 (index 0 = cusp 1 = Ascendant). */
  cusps: number[];
  ascendant: number;
  midheaven: number;
  /** Local apparent sidereal time (RAMC), degrees. */
  ramc: number;
  trueObliquity: number;
}

/** Thrown when Placidus (and therefore KP) houses do not exist at a latitude. */
export class KpHouseError extends RangeError {
  constructor(latitude: number) {
    super(
      `KP uses Placidus cusps, which are undefined at latitude ${latitude.toFixed(4)}° ` +
        `(part of the ecliptic never rises or sets there). KP has no substitute house ` +
        `system, so this chart cannot be cast.`,
    );
    this.name = "KpHouseError";
  }
}

/** The twelve KP (sidereal Placidus) cusps for an instant and place. */
export function kpCusps(date: Date, latitude: number, longitudeEast: number): KpCusps {
  const obliquity = trueObliquity(date);
  const ramc = normalizeDegrees(gast(date) + longitudeEast);
  const tropical = placidusCusps(ramc, obliquity, latitude);
  if (!tropical) throw new KpHouseError(latitude);
  const ayanamsa = kpAyanamsaTrue(date);
  const cusps = tropical.map((cusp) => normalizeDegrees(cusp - ayanamsa));
  return {
    cusps,
    ascendant: normalizeDegrees(ascendant(ramc, obliquity, latitude) - ayanamsa),
    midheaven: normalizeDegrees(midheaven(ramc, obliquity) - ayanamsa),
    ramc,
    trueObliquity: obliquity,
  };
}

/** The KP house (bhava) a sidereal longitude falls in: cusp n up to cusp n+1. */
export function houseOf(longitude: number, cusps: readonly number[]): number {
  const lon = normalizeDegrees(longitude);
  for (let i = 0; i < 12; i += 1) {
    const start = cusps[i];
    const span = normalizeDegrees(cusps[(i + 1) % 12] - start);
    if (normalizeDegrees(lon - start) < span) return i + 1;
  }
  return 1;
}
