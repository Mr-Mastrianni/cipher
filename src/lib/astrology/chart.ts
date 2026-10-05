/**
 * The natal chart: one call that turns birth data into every position, the
 * house cusps, the aspect grid and the element/modality balance.
 */

import {
  bodyPosition,
  julianDayTT,
  julianDayUT,
  deltaTSeconds,
  last,
  meanObliquity,
} from "./ephemeris";
import { ascendant, assignHouse, computeHouses, midheaven, vertex } from "./houses";
import { computeAspects } from "./aspects";
import { resolveBirthInstantDetailed } from "./time";
import { normalize, signDegreeOf, signOf, SIGN_ELEMENT, SIGN_MODALITY } from "./zodiac";
import type {
  BirthInput,
  BodyKey,
  Element,
  HouseCusps,
  HouseSystem,
  Modality,
  NatalChart,
  PointKey,
  Position,
  Precision,
} from "./types";

/**
 * Hard cap on `NatalChart.warnings`. A chart near a sign boundary can produce a
 * dozen boundary notices; the cap keeps a pathological case from unbounded
 * growth, and one extra line reports how many were suppressed.
 */
const MAX_WARNINGS = 32;

/**
 * How close to a sign boundary (in degrees) triggers a warning. The same
 * longitudes drive the Human Design gate/line assignment, where a line is only
 * 0.9375° wide, so a position this close to a boundary can flip sign — and the
 * gate — under a few seconds of birth-time error or a different ephemeris.
 */
const SIGN_BOUNDARY_ORB = 0.05;

/** The ten "planets" (Sun through Pluto) used for the balance readout. */
const BALANCE_BODIES: readonly BodyKey[] = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

/** Everything requested from the ephemeris provider, in chart display order. */
const CHART_BODIES: readonly BodyKey[] = [
  ...BALANCE_BODIES,
  "chiron",
  "northNode",
  "southNode",
  "lilith",
];

/** Display names for warnings. */
const POINT_LABELS: Readonly<Record<PointKey, string>> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  chiron: "Chiron",
  northNode: "North Node",
  southNode: "South Node",
  lilith: "Lilith",
  ascendant: "Ascendant",
  midheaven: "Midheaven",
  descendant: "Descendant",
  imumCoeli: "Imum Coeli",
  vertex: "Vertex",
};

/** Options for `computeNatalChart`. */
export interface NatalChartOptions {
  /** House system to request. Defaults to `"placidus"`. */
  houseSystem?: HouseSystem;
}

function toPosition(
  key: PointKey,
  longitude: number,
  latitude: number,
  speed: number,
  retrograde: boolean,
  precision: Precision,
  houses: HouseCusps,
  distance?: number,
): Position {
  const lon = normalize(longitude);
  return {
    key,
    longitude: lon,
    latitude,
    distance,
    speed,
    retrograde,
    sign: signOf(lon),
    signDegree: signDegreeOf(lon),
    house: assignHouse(lon, houses),
    precision,
  };
}

/**
 * Compute a full Western tropical natal chart.
 *
 * Pipeline: resolve the wall-clock birth time to a UTC instant (reporting DST
 * gaps and folds rather than guessing), derive ΔT and both Julian Days, take
 * the local apparent sidereal time as the RAMC, then compute the angles, the
 * twelve cusps, every body position, the aspect grid and the balance counts.
 *
 * Accuracy caveats:
 * - Positions come from `astronomy-engine`, good to roughly an arcminute
 *   against Swiss Ephemeris, and the house cusps are computed here from the
 *   mean obliquity (the ~9″ nutation-in-obliquity term is omitted).
 * - Chiron is not available from the provider. It is omitted and a warning is
 *   pushed; it is never approximated.
 * - The angles are exact functions of the birth instant, so their real error is
 *   the birth-time error: ≈15′ of Ascendant per minute of clock error.
 * - The element/modality balance counts the ten planets (Sun–Pluto) plus the
 *   Ascendant and Midheaven, once each with no weighting — a transparent
 *   convention, not a standard one; the literature disagrees on both the body
 *   set and the weights, so raw counts are what is reported.
 * - Hemisphere counts use the ten planets only (the angles lie exactly on the
 *   horizon and meridian, so their placement would be arbitrary).
 */
export function computeNatalChart(
  input: BirthInput,
  options: NatalChartOptions = {},
): NatalChart {
  const warnings: string[] = [];
  let suppressed = 0;
  const warn = (message: string): void => {
    if (warnings.length < MAX_WARNINGS) warnings.push(message);
    else suppressed += 1;
  };

  const { date, warnings: timeWarnings } = resolveBirthInstantDetailed(input);
  timeWarnings.forEach(warn);

  const jdUT = julianDayUT(date);
  const jdTT = julianDayTT(date);
  const deltaT = deltaTSeconds(date);

  // Mean obliquity of the ecliptic at the birth instant (TT).
  const obliquity = meanObliquity(jdTT);

  // RAMC = local apparent sidereal time. `last` returns degrees, east positive.
  const ramc = last(date, input.longitude);

  const requestedSystem: HouseSystem = options.houseSystem ?? "placidus";
  const houses = computeHouses(ramc, obliquity, input.latitude, requestedSystem);
  if (houses.fallback && houses.fallbackReason) {
    warn(
      `${houses.fallbackReason} (requested ${houses.requestedSystem}, used ${houses.system}).`,
    );
  }

  // The angles are always the true Ascendant/MC even when the house system
  // places its first and tenth cusps elsewhere (Whole Sign, Equal).
  const asc = ascendant(ramc, obliquity, input.latitude);
  const mc = midheaven(ramc, obliquity);
  const vertexLongitude = vertex(ramc, obliquity, input.latitude);

  const positions: Position[] = [];

  for (const key of CHART_BODIES) {
    const raw = bodyPosition(key, date);
    if (!raw) {
      warn(
        `Chiron is not available from the astronomy-engine ephemeris and has been omitted ` +
          `from the chart rather than approximated. Positions shown for other bodies are unaffected.`,
      );
      continue;
    }
    // The south node is reflected from the true node, not observed directly.
    const precision: Precision = key === "southNode" ? "derived" : raw.precision;
    positions.push(
      toPosition(
        key,
        raw.longitude,
        raw.latitude,
        raw.speed,
        raw.retrograde,
        precision,
        houses,
        raw.distanceAU,
      ),
    );
  }

  positions.push(
    toPosition("ascendant", asc, 0, 0, false, "high", houses),
    toPosition("midheaven", mc, 0, 0, false, "high", houses),
    toPosition("descendant", normalize(asc + 180), 0, 0, false, "derived", houses),
    toPosition("imumCoeli", normalize(mc + 180), 0, 0, false, "derived", houses),
    toPosition("vertex", vertexLongitude, 0, 0, false, "derived", houses),
  );

  const byKey = new Map<PointKey, Position>();
  for (const position of positions) byKey.set(position.key, position);

  // Balance convention: the ten planets plus Ascendant and Midheaven, once each.
  const elements: Record<Element, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalities: Record<Modality, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  const balanceKeys: readonly PointKey[] = [...BALANCE_BODIES, "ascendant", "midheaven"];
  for (const key of balanceKeys) {
    const position = byKey.get(key);
    if (!position) continue;
    elements[SIGN_ELEMENT[position.sign]] += 1;
    modalities[SIGN_MODALITY[position.sign]] += 1;
  }

  // Hemisphere convention (ten planets only): above the horizon is houses 7–12,
  // below is 1–6; east of the meridian is the Ascendant's half, houses 10–3,
  // and west is houses 4–9.
  const hemispheres = { above: 0, below: 0, east: 0, west: 0 };
  for (const key of BALANCE_BODIES) {
    const position = byKey.get(key);
    if (!position || position.house === null) continue;
    const house = position.house;
    if (house >= 7) hemispheres.above += 1;
    else hemispheres.below += 1;
    if (house >= 10 || house <= 3) hemispheres.east += 1;
    else hemispheres.west += 1;
  }

  const aspects = computeAspects(positions);

  for (const position of positions) {
    const distanceToBoundary = Math.min(position.signDegree, 30 - position.signDegree);
    if (distanceToBoundary <= SIGN_BOUNDARY_ORB) {
      warn(
        `${POINT_LABELS[position.key]} is ${distanceToBoundary.toFixed(4)}° from the ` +
          `${position.sign} boundary at ${position.longitude.toFixed(6)}°. The sign — and the ` +
          `Human Design gate/line derived from the same longitude — can flip on a sub-second ` +
          `change in birth time or a different ephemeris.`,
      );
    }
  }

  if (suppressed > 0) {
    warnings.push(
      `${suppressed} further warning${suppressed === 1 ? "" : "s"} suppressed (cap ${MAX_WARNINGS}).`,
    );
  }

  return {
    input,
    utc: date.toISOString(),
    julianDayUT: jdUT,
    julianDayTT: jdTT,
    deltaTSeconds: deltaT,
    positions,
    houses,
    aspects,
    balance: {
      elements,
      modalities,
      hemispheres,
    },
    warnings,
  };
}
