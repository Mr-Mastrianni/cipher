/**
 * High-precision geocentric positions for KP: full VSOP87D for the Sun and
 * planets, full ELP/MPP02 (fitted to DE405) for the Moon, both MIT licensed
 * via `astronomia`.
 *
 * Why not `astronomy-engine` here: its truncated planetary theories are good to
 * ~10″, which is a tenth of the narrowest KP sub-sub. These series agree with
 * the Swiss Ephemeris to ≈1″ for the planets and ≈0.7″ for the Moon (see
 * `__tests__/kp.test.ts`).
 *
 * Every function returns longitudes on the MEAN ecliptic and equinox of date.
 * Sidereal = that − mean KP ayanamsa: nutation cancels exactly, because a KP
 * ephemeris subtracts the TRUE ayanamsa from the TRUE-equinox longitude.
 *
 * Apparent place: the planet AND the Earth are both evaluated at t − τ (light
 * time). That single step yields light-time correction plus annual
 * aberration, the classical "planetary aberration" (Meeus ch. 33).
 *
 * Server-only: the series data is several megabytes.
 */

import * as Astronomy from "astronomy-engine";
import { Planet } from "astronomia/planetposition";
import { Moon } from "astronomia/elp";
import precess from "astronomia/precess";
import coord from "astronomia/coord";
import vsopEarth from "astronomia/data/vsop87Dearth";
import vsopMercury from "astronomia/data/vsop87Dmercury";
import vsopVenus from "astronomia/data/vsop87Dvenus";
import vsopMars from "astronomia/data/vsop87Dmars";
import vsopJupiter from "astronomia/data/vsop87Djupiter";
import vsopSaturn from "astronomia/data/vsop87Dsaturn";
import elpData from "astronomia/data/elpMppDeFull";
import { installDeltaT } from "../astronomy/delta-t";
import { normalizeDegrees } from "./lords";

installDeltaT();

/** Light days per AU. */
const LIGHT_DAYS_PER_AU = 1 / 173.1446326846693;
/** Light days per km. */
const LIGHT_DAYS_PER_KM = 1 / (299_792.458 * 86_400);
const RAD = Math.PI / 180;

type PlanetKey = "mercury" | "venus" | "mars" | "jupiter" | "saturn";

let cache:
  | { earth: Planet; planets: Record<PlanetKey, Planet>; moon: Moon }
  | null = null;

function series() {
  cache ??= {
    earth: new Planet(vsopEarth),
    planets: {
      mercury: new Planet(vsopMercury),
      venus: new Planet(vsopVenus),
      mars: new Planet(vsopMars),
      jupiter: new Planet(vsopJupiter),
      saturn: new Planet(vsopSaturn),
    },
    moon: new Moon(elpData),
  };
  return cache;
}

/** Julian Ephemeris Day (TT) for a UT instant, using the shared ΔT. */
export function jde(date: Date): number {
  return Astronomy.MakeTime(date).tt + 2451545.0;
}

function rectangular(c: { lon: number; lat: number; range: number }): [number, number, number] {
  const cosLat = Math.cos(c.lat);
  return [c.range * cosLat * Math.cos(c.lon), c.range * cosLat * Math.sin(c.lon), c.range * Math.sin(c.lat)];
}

function spherical(v: readonly number[]): { lon: number; lat: number } {
  return {
    lon: normalizeDegrees(Math.atan2(v[1], v[0]) / RAD),
    lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / RAD,
  };
}

/** Apparent geocentric ecliptic position (mean equinox of date) of the Sun or a planet. */
export function apparentPlanet(body: "sun" | PlanetKey, jd: number): { lon: number; lat: number } {
  const { earth, planets } = series();
  let tau = 0;
  let geo: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    const e = rectangular(earth.position(jd - tau));
    const p: [number, number, number] =
      body === "sun" ? [0, 0, 0] : rectangular(planets[body].position(jd - tau));
    geo = [p[0] - e[0], p[1] - e[1], p[2] - e[2]];
    tau = Math.hypot(...geo) * LIGHT_DAYS_PER_AU;
  }
  return spherical(geo);
}

/** Geometric geocentric Moon on the J2000 ecliptic, km. */
function moonJ2000(jd: number): [number, number, number] {
  const xyz = series().moon.positionXYZ(jd) as { x: number; y: number; z: number };
  return [xyz.x, xyz.y, xyz.z];
}

/** Rotate a J2000-ecliptic direction to the mean ecliptic and equinox of date. */
function toEclipticOfDate(v: readonly number[], jd: number): { lon: number; lat: number } {
  const s = spherical(v);
  const ecl = precess.eclipticPosition(
    new coord.Ecliptic(s.lon * RAD, s.lat * RAD),
    2000.0,
    2000.0 + (jd - 2451545.0) / 365.25,
  );
  return { lon: normalizeDegrees(ecl.lon / RAD), lat: ecl.lat / RAD };
}

/** Apparent geocentric Moon (light-time corrected), mean equinox of date. */
export function apparentMoon(jd: number): { lon: number; lat: number } {
  const geometric = moonJ2000(jd);
  const tau = Math.hypot(...geometric) * LIGHT_DAYS_PER_KM;
  return toEclipticOfDate(moonJ2000(jd - tau), jd);
}

/** Mean ascending node, mean equinox of date (Meeus 47.7), degrees. */
export function meanNode(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return normalizeDegrees(
    125.0445479 - 1934.1362891 * T + 0.0020754 * T ** 2 + T ** 3 / 467441 - T ** 4 / 60616000,
  );
}

/**
 * True (osculating) ascending node, mean equinox of date.
 *
 * The orbit normal h = r × v from the ELP Moon (velocity by a ±1-minute central
 * difference) is rotated onto the ecliptic of date; the ascending node lies
 * along ẑ × h.
 */
export function trueNodeOfDate(jd: number): number {
  const dt = 1 / 1440;
  const r = moonJ2000(jd);
  const a = moonJ2000(jd - dt);
  const b = moonJ2000(jd + dt);
  const v = [(b[0] - a[0]) / (2 * dt), (b[1] - a[1]) / (2 * dt), (b[2] - a[2]) / (2 * dt)];
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const normal = toEclipticOfDate(h, jd);
  // Node direction = ẑ × h: longitude of the normal minus 90°.
  return normalizeDegrees(normal.lon + 90);
}
