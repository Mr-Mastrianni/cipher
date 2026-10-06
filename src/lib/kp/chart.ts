/**
 * The complete KP chart for a verified birth moment.
 *
 * KP only: sidereal zodiac with the KP (Krishnamurti) ayanamsa, Placidus
 * cusps, nine grahas, sign/star/sub/sub-sub lords, four-level significators,
 * ruling planets and Vimshottari dashas. There is no Western or tropical
 * fallback anywhere in this path: if KP cannot be cast (Placidus undefined at
 * the latitude, or an invalid birth moment) the chart is refused.
 *
 * Birth time must be given to the second, and an ambiguous local time (a
 * daylight-saving fold) must be resolved explicitly by the caller.
 */

import { DateTime } from "luxon";
import { resolveBirthInstantDetailed } from "../astronomy/time";
import type { BirthInput } from "../astronomy/types";
import { formatAyanamsa, kpAyanamsaTrue } from "./ayanamsa";
import { GRAHA_DISPLAY_ORDER, type Graha } from "./constants";
import { DASHA_YEAR_DAYS, runningPeriods, vimshottari, type DashaPeriod, type DashaResult } from "./dasha";
import { kpLords, type KpLords } from "./lords";
import { houseOf, kpCusps, siderealPositions, type NodeType } from "./positions";
import { rulingPlanets, type RulingPlanets } from "./ruling-planets";
import { computeSignificators, type HouseSignificators, type PlanetSignification } from "./significators";

/** Birth data for KP. Seconds are mandatory. */
export interface KpBirthInput extends BirthInput {
  second: number;
  /** Which occurrence of a repeated (fall-back) local time; required when it is ambiguous. */
  fold?: "earlier" | "later";
}

export interface KpOptions {
  nodeType?: NodeType;
}

export interface KpPlanet extends KpLords {
  graha: Graha;
  house: number;
  retrograde: boolean;
  speed: number;
  /**
   * Seconds of birth-time error that would move this graha across its nearest
   * sub boundary. Infinity for practical purposes on slow planets.
   */
  subStableSeconds: number;
}

export interface KpCusp extends KpLords {
  house: number;
  subStableSeconds: number;
}

export interface KpChart {
  system: {
    name: "Krishnamurti Paddhati";
    zodiac: "Sidereal";
    ayanamsa: { name: "KP (Krishnamurti)"; degrees: number; formatted: string };
    houseSystem: "Placidus";
    nodeType: NodeType;
    ephemeris: string;
    dashaYearDays: number;
  };
  birth: {
    input: KpBirthInput;
    utc: string;
    local: string;
    utcOffset: string;
    isDst: boolean;
    timeZoneAbbreviation: string;
  };
  planets: KpPlanet[];
  cusps: KpCusp[];
  significators: { houses: HouseSignificators[]; planets: PlanetSignification[] };
  rulingPlanets: RulingPlanets;
  dasha: DashaResult;
  /** Maha/bhukti/antara running at the time the chart was cast. */
  currentPeriods: DashaPeriod[];
  /** Birth-time sensitivity notes. */
  warnings: string[];
}

/** Sub lords that change within this many seconds of birth time are flagged. */
export const SENSITIVE_SECONDS = 60;

function stableSeconds(distanceDegrees: number, degreesPerSecond: number): number {
  if (!(Math.abs(degreesPerSecond) > 0)) return Number.POSITIVE_INFINITY;
  return distanceDegrees / Math.abs(degreesPerSecond);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Thrown when the birth moment is ambiguous and the caller has not chosen. */
export class AmbiguousBirthTimeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousBirthTimeError";
  }
}

/** Resolve and describe the birth instant exactly as the verification step shows it. */
export function resolveKpBirth(input: KpBirthInput) {
  if (!Number.isInteger(input.second) || input.second < 0 || input.second > 59) {
    throw new RangeError("KP charts need the birth time to the second (0–59).");
  }
  const { date, warnings } = resolveBirthInstantDetailed(input, { fold: input.fold });
  const ambiguous = warnings.some((w) => w.includes("ambiguous"));
  if (ambiguous && !input.fold) {
    throw new AmbiguousBirthTimeError(
      warnings.find((w) => w.includes("ambiguous")) ??
        "This local time occurs twice. Choose the earlier or later occurrence.",
    );
  }
  const gap = warnings.find((w) => w.includes("does not exist"));
  if (gap) throw new RangeError(gap);

  const local = DateTime.fromJSDate(date, { zone: input.timeZone });
  return {
    date,
    utc: date.toISOString(),
    local: local.toISO({ suppressMilliseconds: true }) ?? "",
    utcOffset: formatOffset(local.offset),
    isDst: local.isInDST,
    timeZoneAbbreviation: local.offsetNameShort ?? "",
    warnings: warnings.filter((w) => !w.includes("ambiguous")),
  };
}

export function computeKpChart(input: KpBirthInput, options: KpOptions = {}, now: Date = new Date()): KpChart {
  const nodeType = options.nodeType ?? "mean";
  const birth = resolveKpBirth(input);
  const date = birth.date;
  const warnings = [...birth.warnings];

  const houses = kpCusps(date, input.latitude, input.longitude);
  // Cusp speeds (deg/s) by a ±30 s central difference — they vary with latitude.
  const before = kpCusps(new Date(date.getTime() - 30_000), input.latitude, input.longitude).cusps;
  const after = kpCusps(new Date(date.getTime() + 30_000), input.latitude, input.longitude).cusps;

  const cusps: KpCusp[] = houses.cusps.map((longitude, i) => {
    const lords = kpLords(longitude);
    const delta = ((after[i] - before[i] + 540) % 360) - 180;
    return { ...lords, house: i + 1, subStableSeconds: stableSeconds(lords.toSubBoundary, delta / 60) };
  });

  const positions = siderealPositions(date, nodeType);
  const planets: KpPlanet[] = GRAHA_DISPLAY_ORDER.map((graha) => {
    const p = positions.find((entry) => entry.graha === graha);
    if (!p) throw new Error(`missing ${graha}`);
    const lords = kpLords(p.longitude);
    return {
      ...lords,
      graha,
      house: houseOf(p.longitude, houses.cusps),
      retrograde: p.retrograde,
      speed: p.speed,
      subStableSeconds: stableSeconds(lords.toSubBoundary, p.speed / 86_400),
    };
  });

  const byGraha = <T,>(pick: (p: KpPlanet) => T) =>
    Object.fromEntries(planets.map((p) => [p.graha, pick(p)])) as Record<Graha, T>;

  const significators = computeSignificators({
    houseOf: byGraha((p) => p.house),
    starLordOf: byGraha((p) => p.starLord),
    signLordOf: byGraha((p) => p.signLord),
    cuspSignLords: cusps.map((c) => c.signLord),
  });

  for (const cusp of cusps) {
    if (cusp.subStableSeconds < SENSITIVE_SECONDS) {
      warnings.push(
        `Cusp ${cusp.house}'s sub lord (${cusp.subLord}) changes if the birth time is off by ` +
          `${Math.max(1, Math.round(cusp.subStableSeconds))} s. Confirm the time to the second.`,
      );
    }
  }
  const moon = planets.find((p) => p.graha === "moon");
  if (moon && moon.subStableSeconds < SENSITIVE_SECONDS * 10) {
    warnings.push(
      `The Moon's sub lord (${moon.subLord}) changes within ${Math.round(moon.subStableSeconds)} s of birth time.`,
    );
  }

  const dasha = vimshottari(moon?.longitude ?? 0, date, 3);
  const ayanamsa = kpAyanamsaTrue(date);

  return {
    system: {
      name: "Krishnamurti Paddhati",
      zodiac: "Sidereal",
      ayanamsa: { name: "KP (Krishnamurti)", degrees: ayanamsa, formatted: formatAyanamsa(ayanamsa) },
      houseSystem: "Placidus",
      nodeType,
      ephemeris: "VSOP87D + ELP/MPP02 (≈0.5″ vs Swiss Ephemeris)",
      dashaYearDays: DASHA_YEAR_DAYS,
    },
    birth: {
      input,
      utc: birth.utc,
      local: birth.local,
      utcOffset: birth.utcOffset,
      isDst: birth.isDst,
      timeZoneAbbreviation: birth.timeZoneAbbreviation,
    },
    planets,
    cusps,
    significators,
    rulingPlanets: rulingPlanets(date, input.latitude, input.longitude, input.timeZone, nodeType),
    dasha,
    currentPeriods: runningPeriods(dasha, now),
    warnings,
  };
}
