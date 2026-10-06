/**
 * Plain-data projection of a KP chart for client components: every Date
 * becomes an ISO string and only what the UI renders is kept.
 */

import { DateTime } from "luxon";
import { formatAyanamsa } from "./ayanamsa";
import type { KpChart } from "./chart";
import type { Graha } from "./constants";
import type { DashaPeriod } from "./dasha";

export interface KpPeriodView {
  lord: Graha;
  start: string;
  end: string;
  children?: KpPeriodView[];
}

export interface KpChartView {
  system: KpChart["system"];
  birth: KpChart["birth"];
  planets: Array<{
    graha: Graha;
    longitude: number;
    rasi: { index: number; sanskrit: string; english: string };
    rasiDegree: number;
    nakshatra: { index: number; name: string };
    pada: number;
    signLord: Graha;
    starLord: Graha;
    subLord: Graha;
    subSubLord: Graha;
    house: number;
    retrograde: boolean;
    subStableSeconds: number | null;
  }>;
  cusps: Array<{
    house: number;
    longitude: number;
    rasi: { index: number; sanskrit: string; english: string };
    rasiDegree: number;
    nakshatra: { index: number; name: string };
    signLord: Graha;
    starLord: Graha;
    subLord: Graha;
    subSubLord: Graha;
    subStableSeconds: number | null;
  }>;
  houses: Array<{ house: number; lord: Graha; levels: Record<"A" | "B" | "C" | "D", Graha[]> }>;
  planetHouses: Array<{ graha: Graha; houses: number[] }>;
  rulingPlanets: KpChart["rulingPlanets"];
  dasha: { birthLord: Graha; balanceYears: number; yearDays: number; mahadashas: KpPeriodView[] };
  current: KpPeriodView[];
  warnings: string[];
}

export function period(p: DashaPeriod, depth: number): KpPeriodView {
  return {
    lord: p.lord,
    start: p.start.toISOString(),
    end: p.end.toISOString(),
    ...(depth > 1 && p.children ? { children: p.children.map((c) => period(c, depth - 1)) } : {}),
  };
}

const finite = (n: number) => (Number.isFinite(n) ? n : null);

export function toKpView(chart: KpChart): KpChartView {
  return {
    system: chart.system,
    birth: chart.birth,
    planets: chart.planets.map((p) => ({
      graha: p.graha,
      longitude: p.longitude,
      rasi: { index: p.rasi.index, sanskrit: p.rasi.sanskrit, english: p.rasi.english },
      rasiDegree: p.rasiDegree,
      nakshatra: { index: p.nakshatra.index, name: p.nakshatra.name },
      pada: p.pada,
      signLord: p.signLord,
      starLord: p.starLord,
      subLord: p.subLord,
      subSubLord: p.subSubLord,
      house: p.house,
      retrograde: p.retrograde,
      subStableSeconds: finite(p.subStableSeconds),
    })),
    cusps: chart.cusps.map((c) => ({
      house: c.house,
      longitude: c.longitude,
      rasi: { index: c.rasi.index, sanskrit: c.rasi.sanskrit, english: c.rasi.english },
      rasiDegree: c.rasiDegree,
      nakshatra: { index: c.nakshatra.index, name: c.nakshatra.name },
      signLord: c.signLord,
      starLord: c.starLord,
      subLord: c.subLord,
      subSubLord: c.subSubLord,
      subStableSeconds: finite(c.subStableSeconds),
    })),
    houses: chart.significators.houses.map((h) => ({ house: h.house, lord: h.lord, levels: h.levels })),
    planetHouses: chart.significators.planets.map((p) => ({ graha: p.graha, houses: p.houses })),
    rulingPlanets: chart.rulingPlanets,
    dasha: {
      birthLord: chart.dasha.birthLord,
      balanceYears: chart.dasha.balanceYears,
      yearDays: chart.dasha.yearDays,
      mahadashas: chart.dasha.mahadashas.map((m) => period(m, 2)),
    },
    current: chart.currentPeriods.map((p) => period(p, 1)),
    warnings: chart.warnings,
  };
}

/** Project a horary chart onto the same view the KP chart panel renders. */
export function horaryToView(chart: import("./horary").HoraryChart, current: KpPeriodView[]): KpChartView {
  const at = new Date(chart.at);
  const local = DateTime.fromJSDate(at, { zone: chart.timeZone });
  const offset = local.offset;
  const sign = offset < 0 ? "−" : "+";
  const abs = Math.abs(offset);
  return {
    system: {
      name: "Krishnamurti Paddhati",
      zodiac: "Sidereal",
      ayanamsa: { name: "KP (Krishnamurti)", degrees: chart.ayanamsa, formatted: formatAyanamsa(chart.ayanamsa) },
      houseSystem: "Placidus",
      nodeType: chart.nodeType,
      ephemeris: "VSOP87D + ELP/MPP02 (≈0.5″ vs Swiss Ephemeris)",
      dashaYearDays: chart.dasha.yearDays,
    },
    birth: {
      input: {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: local.hour,
        minute: local.minute,
        second: local.second,
        timeZone: chart.timeZone,
        latitude: chart.latitude,
        longitude: chart.longitude,
      },
      utc: chart.at,
      local: local.toISO({ suppressMilliseconds: true }) ?? chart.at,
      utcOffset: `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`,
      isDst: local.isInDST,
      timeZoneAbbreviation: local.offsetNameShort ?? "",
    },
    planets: chart.planets.map((p) => ({
      graha: p.graha,
      longitude: p.longitude,
      rasi: { index: p.rasi.index, sanskrit: p.rasi.sanskrit, english: p.rasi.english },
      rasiDegree: p.rasiDegree,
      nakshatra: { index: p.nakshatra.index, name: p.nakshatra.name },
      pada: p.pada,
      signLord: p.signLord,
      starLord: p.starLord,
      subLord: p.subLord,
      subSubLord: p.subSubLord,
      house: p.house,
      retrograde: p.retrograde,
      subStableSeconds: null,
    })),
    cusps: chart.cusps.map((c) => ({
      house: c.house,
      longitude: c.longitude,
      rasi: { index: c.rasi.index, sanskrit: c.rasi.sanskrit, english: c.rasi.english },
      rasiDegree: c.rasiDegree,
      nakshatra: { index: c.nakshatra.index, name: c.nakshatra.name },
      signLord: c.signLord,
      starLord: c.starLord,
      subLord: c.subLord,
      subSubLord: c.subSubLord,
      subStableSeconds: null,
    })),
    houses: chart.significators.houses.map((h) => ({ house: h.house, lord: h.lord, levels: h.levels })),
    planetHouses: chart.significators.planets.map((p) => ({ graha: p.graha, houses: p.houses })),
    rulingPlanets: chart.rulingPlanets,
    dasha: {
      birthLord: chart.dasha.birthLord,
      balanceYears: chart.dasha.balanceYears,
      yearDays: chart.dasha.yearDays,
      mahadashas: chart.dasha.mahadashas.map((m) => period(m, 2)),
    },
    current,
    warnings: [],
  };
}
