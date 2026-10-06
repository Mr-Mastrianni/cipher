import * as Astronomy from "astronomy-engine";
import { normalize } from "./zodiac";
import type { BodyKey, Precision } from "./types";

/**
 * Ephemeris provider.
 *
 * The engine uses `astronomy-engine` (MIT licensed), whose solar and lunar
 * positions are validated to roughly an arcsecond against JPL DE431 — verified
 * in this repo against three published equinox instants and three solar-eclipse
 * maxima. That is one to two orders of magnitude finer than an astrology line
 * (0.9375°), so it is more than sufficient for both the natal chart and the
 * Human Design bodygraph.
 *
 * WHY NOT SWISS EPHEMERIS
 * -----------------------
 * Swiss Ephemeris is the industry-standard reference and matches astro.com to
 * ~0.001″. It is also dual-licensed AGPL-3.0 / commercial, and the AGPL's
 * network clause would require this entire application to be released under
 * the AGPL because it is offered as a public service. The commercial licence is
 * a one-time 700 CHF. We therefore keep the ephemeris behind this provider
 * interface: swapping in `swisseph-wasm` for arcsecond parity is a single-file
 * change plus a licence purchase, and nothing else in the codebase moves.
 *
 * KNOWN LIMITS
 * ------------
 * - Chiron is not available from `astronomy-engine`. It is resolved to `null`
 *   and surfaces as an explicit warning rather than a silently wrong number.
 * - The lunar node is the TRUE (osculating) node, computed from the Moon's
 *   instantaneous orbital plane, which is what the Human Design system uses.
 * - Lunar distance is in AU.
 */

const AU_KM = 149_597_870.7;

/** Bodies we can compute directly, mapped to their astronomy-engine enum. */
const ENGINE_BODIES: Partial<Record<BodyKey, Astronomy.Body>> = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

export interface RawPosition {
  longitude: number;
  latitude: number;
  distanceAU?: number;
  /** Degrees of longitude per day; negative means retrograde. */
  speed: number;
  retrograde: boolean;
  precision: Precision;
}

/**
 * Geocentric apparent ecliptic position of a body.
 *
 * `astronomy-engine` returns vectors carrying their own time, and `Ecliptic()`
 * rotates them into the true equinox and ecliptic **of date** — which is
 * exactly the tropical frame astrology is defined in.
 */
function eclipticOfDate(body: Astronomy.Body, date: Date) {
  const vector = Astronomy.GeoVector(body, date, true);
  const ecliptic = Astronomy.Ecliptic(vector);
  return {
    lon: normalize(ecliptic.elon),
    lat: ecliptic.elat,
    dist: Math.hypot(vector.x, vector.y, vector.z),
  };
}

/** Central difference of longitude over ±h days, unwrapped across 0°/360°. */
function longitudeSpeed(body: Astronomy.Body, date: Date, h = 0.5): number {
  const before = eclipticOfDate(body, new Date(date.getTime() - h * 86_400_000));
  const after = eclipticOfDate(body, new Date(date.getTime() + h * 86_400_000));
  let delta = after.lon - before.lon;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta / (2 * h);
}

export function sunPosition(date: Date): RawPosition {
  const { lon, lat, dist } = eclipticOfDate(Astronomy.Body.Sun, date);
  const speed = longitudeSpeed(Astronomy.Body.Sun, date);
  return {
    longitude: lon,
    latitude: lat,
    distanceAU: dist,
    speed,
    retrograde: speed < 0,
    precision: "high",
  };
}

export function moonPosition(date: Date): RawPosition {
  const moon = Astronomy.EclipticGeoMoon(date);
  const speed = longitudeSpeed(Astronomy.Body.Moon, date, 0.25);
  return {
    longitude: normalize(moon.lon),
    latitude: moon.lat,
    distanceAU: moon.dist,
    speed,
    retrograde: speed < 0,
    precision: "high",
  };
}

export function bodyPosition(key: BodyKey, date: Date): RawPosition | null {
  if (key === "sun") return sunPosition(date);
  if (key === "moon") return moonPosition(date);
  if (key === "northNode") return { ...trueNode(date), };
  if (key === "southNode") {
    const node = trueNode(date);
    return {
      longitude: normalize(node.longitude + 180),
      latitude: 0,
      speed: node.speed,
      retrograde: true,
      precision: "high",
    };
  }
  if (key === "lilith") return meanLilith(date);

  const body = ENGINE_BODIES[key];
  if (!body) return null;

  const { lon, lat, dist } = eclipticOfDate(body, date);
  const speed = longitudeSpeed(body, date);
  return {
    longitude: lon,
    latitude: lat,
    distanceAU: dist,
    speed,
    retrograde: speed < 0,
    precision: "high",
  };
}

/**
 * True (osculating) north lunar node.
 *
 * The node is the ascending intersection of the Moon's instantaneous orbital
 * plane with the ecliptic. Two nearby Moon positions define that plane; its
 * normal crossed with the ecliptic pole gives the node direction. This is the
 * node convention Human Design uses — the *mean* node can differ by more than
 * a degree, which is enough to move a gate.
 */
export function trueNode(date: Date): {
  longitude: number;
  latitude: number;
  speed: number;
  retrograde: boolean;
  precision: Precision;
} {
  const dt = 0.02; // days either side — small enough to be osculating
  const a = moonVector(date, -dt);
  const b = moonVector(date, +dt);

  // Orbital plane normal h = a × b (only its x and y components are needed)
  const hx = a.y * b.z - a.z * b.y;
  const hy = a.z * b.x - a.x * b.z;

  // Ascending node direction n = ẑ × h  →  (-hy, hx, 0)
  let lon = normalize((Math.atan2(hx, -hy) * 180) / Math.PI);

  // The node regresses ~0.053°/day; compute it the same way for consistency.
  const nodeAt = (d: Date) => {
    const p = moonVector(d, -dt);
    const q = moonVector(d, +dt);
    const jx = p.y * q.z - p.z * q.y;
    const jy = p.z * q.x - p.x * q.z;
    return normalize((Math.atan2(jx, -jy) * 180) / Math.PI);
  };
  const dayMs = 86_400_000;
  const before = nodeAt(new Date(date.getTime() - dayMs));
  const after = nodeAt(new Date(date.getTime() + dayMs));
  let speed = after - before;
  if (speed > 180) speed -= 360;
  if (speed < -180) speed += 360;

  // Guard against the branch cut flipping the sign.
  if (Math.abs(speed) > 5) speed = -0.0529;
  lon = normalize(lon);

  return {
    longitude: lon,
    latitude: 0,
    speed,
    retrograde: speed < 0,
    precision: "high",
  };
}

/** Moon position as an ecliptic-of-date cartesian unit-ish vector. */
function moonVector(date: Date, offsetDays: number) {
  const shifted = new Date(date.getTime() + offsetDays * 86_400_000);
  const moon = Astronomy.EclipticGeoMoon(shifted);
  const lonR = (moon.lon * Math.PI) / 180;
  const latR = (moon.lat * Math.PI) / 180;
  return {
    x: moon.dist * Math.cos(latR) * Math.cos(lonR),
    y: moon.dist * Math.cos(latR) * Math.sin(lonR),
    z: moon.dist * Math.sin(latR),
  };
}

/**
 * Mean Black Moon Lilith — the mean lunar apogee.
 *
 * This is the "mean" Lilith, which is the version most chart services print
 * under the name Lilith. It is a smooth averaged point, not the true osculating
 * apogee, and is labelled `approximate` so the UI can say so.
 */
export function meanLilith(date: Date): RawPosition {
  const jd = julianDayUT(date);
  const T = (jd - 2451545.0) / 36525;
  // Meeus, Astronomical Algorithms, ch. 47 — mean lunar elements.
  const Lp = normalize(
    218.3164477 +
      481267.88123421 * T -
      0.0015786 * T * T +
      (T * T * T) / 538841 -
      (T * T * T * T) / 65194000,
  );
  const Mp = normalize(
    134.9633964 +
      477198.8675055 * T +
      0.0087414 * T * T +
      (T * T * T) / 69699 -
      (T * T * T * T) / 14712000,
  );
  const perigee = Lp - Mp;
  const apogee = normalize(perigee + 180);

  const next = new Date(date.getTime() + 86_400_000);
  const jdNext = julianDayUT(next);
  const Tn = (jdNext - 2451545.0) / 36525;
  const Lpn =
    218.3164477 +
    481267.88123421 * Tn -
    0.0015786 * Tn * Tn +
    (Tn * Tn * Tn) / 538841;
  const Mpn =
    134.9633964 +
    477198.8675055 * Tn +
    0.0087414 * Tn * Tn +
    (Tn * Tn * Tn) / 69699;
  let speed = normalize(Lpn - Mpn + 180) - apogee;
  if (speed > 180) speed -= 360;
  if (speed < -180) speed += 360;

  return {
    longitude: apogee,
    latitude: 0,
    speed,
    retrograde: speed < 0,
    precision: "approximate",
  };
}

/** Julian Day from a JS Date (UTC). */
export function julianDayUT(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Days since the J2000.0 epoch, which is the time argument the engine expects. */
export function daysSinceJ2000(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
}

/**
 * ΔT — the difference TT − UT in seconds.
 *
 * We deliberately call the same Espenak–Meeus polynomial that
 * `astronomy-engine` uses internally, so the house cusps we compute at TT and
 * the planetary positions the engine computes at TT share one time scale and
 * cannot disagree with each other.
 *
 * The polynomial's absolute error reaches a few seconds in the 2020s because
 * Earth's rotation has sped up relative to the extrapolation. A 5-second ΔT
 * error moves the Moon by ~2.5″ and the planets far less — four orders of
 * magnitude below the width of a Human Design line — so it is not corrected.
 */
export function deltaTSeconds(date: Date): number {
  return Astronomy.DeltaT_EspenakMeeus(daysSinceJ2000(date));
}

/** Julian Day in Terrestrial Time. */
export function julianDayTT(date: Date): number {
  return julianDayUT(date) + deltaTSeconds(date) / 86_400;
}

/** Greenwich apparent sidereal time in degrees. */
export function gast(date: Date): number {
  return normalize(Astronomy.SiderealTime(date) * 15);
}

/** Local apparent sidereal time in degrees, east longitude positive. */
export function last(date: Date, longitudeEast: number): number {
  return normalize(gast(date) + longitudeEast);
}

/** Mean obliquity of the ecliptic (IAU 2006), in degrees. */
export function meanObliquity(jdTT: number): number {
  const T = (jdTT - 2451545.0) / 36525;
  const arcsec =
    84381.406 -
    46.836769 * T -
    0.0001831 * T * T +
    0.0020034 * T * T * T -
    5.76e-7 * Math.pow(T, 4) -
    4.34e-8 * Math.pow(T, 5);
  return arcsec / 3600;
}

export const KM_PER_AU = AU_KM;
