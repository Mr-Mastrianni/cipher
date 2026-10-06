/**
 * Astrocartography: where on Earth each graha was angular at the birth instant.
 *
 * This is pure spherical astronomy and independent of any zodiac — the lines
 * come from each body's apparent right ascension and declination, not from a
 * tropical or sidereal longitude — so it sits alongside KP without introducing
 * any Western calculation.
 *
 * For a body at (α, δ) and Greenwich apparent sidereal time θ at the instant:
 * - 10th-cusp (MC) line: the meridian where the body culminates, λ = α − θ.
 * - 4th-cusp (IC) line: λ = α − θ + 180°.
 * - Lagna (rising) / 7th-cusp (setting) lines: where the body's geometric
 *   altitude is 0, i.e. cos H = −tan φ · tan δ, with H the local hour angle
 *   (negative rising, positive setting) and λ = α + H − θ. They exist only for
 *   latitudes where |tan φ · tan δ| ≤ 1, so a line can stop short of the poles.
 *
 * Altitude is geometric (no refraction, centre of the body), the standard
 * astrocartography convention, and is stated in the UI.
 */

import * as Astronomy from "astronomy-engine";
import { installDeltaT } from "../astronomy/delta-t";
import { gast } from "../astronomy/ephemeris";
import { normalize } from "../astronomy/angles";
import { kpAyanamsaMean, nutationInLongitude, trueObliquity } from "../kp/ayanamsa";
import { siderealLongitude, type NodeType } from "../kp/positions";
import type { Graha } from "../kp/constants";

installDeltaT();

export type AngleLine = "lagna" | "seventh" | "tenth" | "fourth";

export interface CartoLine {
  graha: Graha;
  angle: AngleLine;
  /** Polyline segments of [longitude, latitude] pairs, split at the antimeridian. */
  segments: Array<Array<[number, number]>>;
}

export interface Equatorial {
  ra: number; // degrees
  dec: number; // degrees
}

const RAD = Math.PI / 180;

const BODIES: Partial<Record<Graha, Astronomy.Body>> = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mars: Astronomy.Body.Mars,
  mercury: Astronomy.Body.Mercury,
  jupiter: Astronomy.Body.Jupiter,
  venus: Astronomy.Body.Venus,
  saturn: Astronomy.Body.Saturn,
};

/** Apparent geocentric right ascension and declination of date. */
export function equatorialOf(graha: Graha, date: Date, nodeType: NodeType = "mean"): Equatorial {
  const body = BODIES[graha];
  if (body) {
    // Geocentric apparent vector (light time + aberration), rotated from J2000
    // to the true equator and equinox of date.
    const vector = Astronomy.GeoVector(body, date, true);
    const rotation = Astronomy.Rotation_EQJ_EQD(Astronomy.MakeTime(date));
    const ofDate = Astronomy.RotateVector(rotation, vector);
    const sphere = Astronomy.EquatorFromVector(ofDate);
    return { ra: sphere.ra * 15, dec: sphere.dec };
  }
  // Nodes lie on the ecliptic (β = 0). Convert their true-equinox longitude.
  const sidereal = siderealLongitude(graha, date, nodeType);
  const tropicalTrue = normalize(sidereal + kpAyanamsaMean(date) + nutationInLongitude(date));
  const eps = trueObliquity(date) * RAD;
  const lambda = tropicalTrue * RAD;
  const ra = Math.atan2(Math.sin(lambda) * Math.cos(eps), Math.cos(lambda)) / RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) / RAD;
  return { ra: normalize(ra), dec };
}

/** Wrap a longitude into [−180, 180). */
function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Split a polyline wherever consecutive longitudes jump across the antimeridian. */
function splitAtAntimeridian(points: Array<[number, number]>): Array<Array<[number, number]>> {
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  for (const point of points) {
    const previous = current.at(-1);
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Latitudes sampled for horizon lines: dense near the poles where the curves bend sharply. */
const LATITUDES: number[] = (() => {
  const out: number[] = [];
  for (let lat = -85; lat <= 85; lat += 1) out.push(lat);
  return out;
})();

/** The four angle lines of one graha. */
export function linesFor(graha: Graha, date: Date, nodeType: NodeType = "mean"): CartoLine[] {
  const { ra, dec } = equatorialOf(graha, date, nodeType);
  const theta = gast(date);
  const mcLon = wrapLon(ra - theta);
  const meridian = (lon: number): Array<Array<[number, number]>> => [
    [
      [lon, -85],
      [lon, 85],
    ],
  ];

  const horizon = (sign: -1 | 1): Array<Array<[number, number]>> => {
    const points: Array<[number, number]> = [];
    const tanDec = Math.tan(dec * RAD);
    for (const lat of LATITUDES) {
      const x = -Math.tan(lat * RAD) * tanDec;
      if (x < -1 || x > 1) continue;
      const H = (sign * Math.acos(x)) / RAD;
      points.push([wrapLon(ra + H - theta), lat]);
    }
    return splitAtAntimeridian(points);
  };

  return [
    { graha, angle: "tenth", segments: meridian(mcLon) },
    { graha, angle: "fourth", segments: meridian(wrapLon(mcLon + 180)) },
    { graha, angle: "lagna", segments: horizon(-1) },
    { graha, angle: "seventh", segments: horizon(1) },
  ];
}

const GRAHAS: Graha[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];

/** Every graha's four lines at an instant. */
export function astrocartography(date: Date, nodeType: NodeType = "mean"): CartoLine[] {
  return GRAHAS.flatMap((graha) => linesFor(graha, date, nodeType));
}

/**
 * Great-circle distance in km from a point to the nearest vertex of a line,
 * for "which lines pass near this place" lookups.
 */
export function distanceToLineKm(line: CartoLine, latitude: number, longitude: number): number {
  const R = 6371;
  let best = Number.POSITIVE_INFINITY;
  const φ1 = latitude * RAD;
  for (const segment of line.segments) {
    // Meridians are two-point segments; sample them at the query latitude.
    const points: Array<[number, number]> =
      segment.length === 2 && segment[0][0] === segment[1][0]
        ? [[segment[0][0], Math.max(-85, Math.min(85, latitude))]]
        : segment;
    for (const [lon, lat] of points) {
      const φ2 = lat * RAD;
      const Δλ = (lon - longitude) * RAD;
      const c =
        Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
      best = Math.min(best, R * Math.acos(Math.max(-1, Math.min(1, c))));
    }
  }
  return best;
}
