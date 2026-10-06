/**
 * KP horary (Prashna).
 *
 * The number method: the querent gives a number from 1 to 249. The horary
 * Lagna is placed at the commencement of that row of the KP sub table; the
 * other eleven Placidus cusps are raised for the place of judgement with the
 * sidereal time at which that Lagna rises there. The grahas, the ruling
 * planets and the horary dasha belong to the actual moment of judgement.
 *
 * A time-based variant is supported too ("let the moment choose"): the Lagna
 * is simply the real Lagna at the moment and place of the question.
 *
 * Judgement follows the standard KP procedure and shows every step:
 * 1. The question's category names the deciding cusp and the houses that
 *    favour it. The negating houses are derived as the 12th from each
 *    favourable house (the house of its loss), never hand-listed.
 * 2. The deciding cusp's sub lord is judged by the houses it signifies,
 *    through its star lord first (the star lord's occupation and ownership),
 *    then through itself.
 * 3. Significators of the favourable houses that are also ruling planets at
 *    the moment of judgement are the fruitful significators; their upcoming
 *    periods in the horary Vimshottari dasha are offered as candidate windows.
 */

import { kpAyanamsaTrue, trueObliquity } from "./ayanamsa";
import { GRAHA_DISPLAY_ORDER, type Graha } from "./constants";
import {
  HORARY_CATEGORY_BY_ID,
  negatingHouses,
  type HoraryJudgement,
  type HoraryVerdict,
} from "./horary-categories";

export {
  HORARY_CATEGORIES,
  HORARY_CATEGORY_BY_ID,
  negatingHouses,
  type HoraryCategory,
  type HoraryJudgement,
  type HoraryVerdict,
} from "./horary-categories";
import { vimshottari, type DashaPeriod, type DashaResult } from "./dasha";
import { kpLords, kpSubTable, normalizeDegrees, type KpLords } from "./lords";
import { KpHouseError, houseOf, kpCusps, siderealPositions, type NodeType } from "./positions";
import { rulingPlanets, type RulingPlanets } from "./ruling-planets";
import { computeSignificators, type HouseSignificators, type PlanetSignification } from "./significators";
import { ascendant, placidusCusps } from "../astronomy/houses";

/* ────────────────────────────────────────────────────────────────────────────
 * Question categories
 * ──────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
 * The horary chart
 * ──────────────────────────────────────────────────────────────────────────── */

export interface HoraryInput {
  /** 1–249, or `null` for the time-based method. */
  number: number | null;
  at: Date;
  latitude: number;
  longitude: number;
  timeZone: string;
  nodeType?: NodeType;
}

export interface HoraryChart {
  method: "number" | "time";
  number: number | null;
  at: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  nodeType: NodeType;
  ayanamsa: number;
  cusps: Array<KpLords & { house: number }>;
  planets: Array<KpLords & { graha: Graha; house: number; retrograde: boolean; speed: number }>;
  significators: { houses: HouseSignificators[]; planets: PlanetSignification[] };
  rulingPlanets: RulingPlanets;
  dasha: DashaResult;
}

function wrap180(deg: number): number {
  const n = normalizeDegrees(deg);
  return n > 180 ? n - 360 : n;
}

/**
 * The RAMC at which the tropical Ascendant equals `target` at a latitude.
 * The Ascendant advances monotonically through 360° as RAMC does, so a coarse
 * scan brackets the root and bisection refines it to ~1e-10°.
 */
export function ramcForAscendant(target: number, obliquity: number, latitude: number): number {
  const f = (ramc: number) => wrap180(ascendant(ramc, obliquity, latitude) - target);
  let lo = 0;
  let hi = 0;
  let found = false;
  for (let r = 0; r < 360; r += 0.5) {
    const a = f(r);
    const b = f(r + 0.5);
    // A genuine root crosses from − to + near zero, not across the ±180 seam.
    if (a <= 0 && b >= 0 && b - a < 90) {
      lo = r;
      hi = r + 0.5;
      found = true;
      break;
    }
  }
  if (!found) throw new KpHouseError(latitude);
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return normalizeDegrees((lo + hi) / 2);
}

export function horaryChart(input: HoraryInput): HoraryChart {
  const nodeType = input.nodeType ?? "mean";
  const ayanamsa = kpAyanamsaTrue(input.at);
  const obliquity = trueObliquity(input.at);

  let siderealCusps: number[];
  if (input.number === null) {
    siderealCusps = kpCusps(input.at, input.latitude, input.longitude).cusps;
  } else {
    if (!Number.isInteger(input.number) || input.number < 1 || input.number > 249) {
      throw new RangeError("A KP horary number runs from 1 to 249.");
    }
    const row = kpSubTable()[input.number - 1];
    const lagnaSidereal = row.start;
    const ramc = ramcForAscendant(normalizeDegrees(lagnaSidereal + ayanamsa), obliquity, input.latitude);
    const tropical = placidusCusps(ramc, obliquity, input.latitude);
    if (!tropical) throw new KpHouseError(input.latitude);
    siderealCusps = tropical.map((c) => normalizeDegrees(c - ayanamsa));
    // Pin cusp 1 exactly to the sub's commencement (removes solver round-off).
    siderealCusps[0] = lagnaSidereal;
  }

  const cusps = siderealCusps.map((longitude, i) => ({ ...kpLords(longitude), house: i + 1 }));
  const positions = siderealPositions(input.at, nodeType);
  const planets = GRAHA_DISPLAY_ORDER.map((graha) => {
    const p = positions.find((x) => x.graha === graha);
    if (!p) throw new Error(`missing ${graha}`);
    return {
      ...kpLords(p.longitude),
      graha,
      house: houseOf(p.longitude, siderealCusps),
      retrograde: p.retrograde,
      speed: p.speed,
    };
  });
  const by = <T,>(pick: (p: (typeof planets)[number]) => T) =>
    Object.fromEntries(planets.map((p) => [p.graha, pick(p)])) as Record<Graha, T>;
  const significators = computeSignificators({
    houseOf: by((p) => p.house),
    starLordOf: by((p) => p.starLord),
    signLordOf: by((p) => p.signLord),
    cuspSignLords: cusps.map((c) => c.signLord),
  });
  const moon = planets.find((p) => p.graha === "moon");

  return {
    method: input.number === null ? "time" : "number",
    number: input.number,
    at: input.at.toISOString(),
    latitude: input.latitude,
    longitude: input.longitude,
    timeZone: input.timeZone,
    nodeType,
    ayanamsa,
    cusps,
    planets,
    significators,
    rulingPlanets: rulingPlanets(input.at, input.latitude, input.longitude, input.timeZone, nodeType),
    dasha: vimshottari(moon?.longitude ?? 0, input.at, 3),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Judgement
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Houses a graha signifies by itself: the house it occupies and the houses
 * whose cusps fall in its signs. Rahu and Ketu own no signs; as agents they
 * also carry the occupation and ownership of their sign lord.
 */
function occupiesAndOwns(chart: HoraryChart, graha: Graha): number[] {
  const planet = chart.planets.find((p) => p.graha === graha);
  const own = (g: Graha) => {
    const occupied = chart.planets.find((p) => p.graha === g)?.house;
    return [...(occupied ? [occupied] : []), ...chart.cusps.filter((c) => c.signLord === g).map((c) => c.house)];
  };
  const houses = [...own(graha)];
  if ((graha === "rahu" || graha === "ketu") && planet) houses.push(...own(planet.signLord));
  return [...new Set(houses)].sort((a, b) => a - b);
}

const NAME: Record<Graha, string> = {
  sun: "Sun", moon: "Moon", mars: "Mars", mercury: "Mercury", jupiter: "Jupiter",
  venus: "Venus", saturn: "Saturn", rahu: "Rahu", ketu: "Ketu",
};

export function judgeHorary(chart: HoraryChart, categoryId: string, horizonYears = 3): HoraryJudgement {
  const category = HORARY_CATEGORY_BY_ID.get(categoryId);
  if (!category) throw new RangeError(`Unknown horary category "${categoryId}".`);
  const favourable = [...category.favourable].sort((a, b) => a - b);
  const negating = negatingHouses(favourable);

  const cusp = chart.cusps[category.decidingCusp - 1];
  const subLord = cusp.subLord;
  const starOfSubLord = chart.planets.find((p) => p.graha === subLord)?.starLord ?? subLord;
  const viaStarLord = occupiesAndOwns(chart, starOfSubLord);
  const viaSelf = occupiesAndOwns(chart, subLord);
  // KP reads the star lord's houses as the result, the sub lord's own as modification.
  const signified = new Set([...viaStarLord, ...viaSelf]);
  const favourableHits = favourable.filter((h) => signified.has(h));
  const negatingHits = negating.filter((h) => signified.has(h));
  const starFavourable = favourable.filter((h) => viaStarLord.includes(h));
  const starNegating = negating.filter((h) => viaStarLord.includes(h));

  let verdict: HoraryVerdict;
  if (favourableHits.length === 0) verdict = "denied";
  else if (starFavourable.length > 0 && starNegating.length === 0) verdict = "promised";
  else verdict = "mixed";

  const sub = NAME[subLord];
  const star = NAME[starOfSubLord];
  const list = (hs: number[]) => (hs.length ? hs.join(", ") : "none");
  const explanation =
    `The ${category.decidingCusp}${["th", "st", "nd", "rd"][category.decidingCusp] ?? "th"} cusp's sub lord is ${sub}, in the star of ${star}. ` +
    `Through ${star} it signifies houses ${list(viaStarLord)}; through itself, ${list(viaSelf)}. ` +
    `Favourable houses for this question are ${favourable.join(", ")}; the negating houses (12th from each) are ${list(negating)}. ` +
    (verdict === "promised"
      ? `The star lord connects ${sub} to favourable houses (${starFavourable.join(", ")}) and to none of the negating ones, so the matter is promised.`
      : verdict === "denied"
        ? `${sub} signifies none of the favourable houses, so the matter is not promised.`
        : `${sub} touches favourable houses (${favourableHits.join(", ")}) but also negating ones (${list(negatingHits)})${starFavourable.length === 0 ? ", and only through itself rather than its star lord" : ""}, so the promise is qualified: expect it with obstacles, delay or partially.`);

  // Fruitful significators: significators of favourable houses that are ruling planets.
  const favSignificators = new Set(
    chart.significators.houses.filter((h) => favourable.includes(h.house)).flatMap((h) => h.all),
  );
  const rp = new Set(chart.rulingPlanets.set);
  const fruitful = GRAHA_DISPLAY_ORDER.filter((g) => favSignificators.has(g) && rp.has(g));

  // Candidate windows, within the horizon: bhuktis ruled by a fruitful
  // significator, and the antaras inside them also ruled by one.
  const windows: HoraryJudgement["windows"] = [];
  if (verdict !== "denied" && fruitful.length > 0) {
    const from = Date.parse(chart.at);
    const until = from + horizonYears * 365.25 * 86_400_000;
    const inRange = (p: DashaPeriod) => p.end.getTime() > from && p.start.getTime() < until;
    const clip = (p: DashaPeriod) => ({
      start: new Date(Math.max(p.start.getTime(), from)).toISOString(),
      end: p.end.toISOString(),
    });
    for (const maha of chart.dasha.mahadashas.filter(inRange)) {
      for (const bhukti of (maha.children ?? []).filter(inRange)) {
        if (!fruitful.includes(bhukti.lord)) continue;
        windows.push({ level: "bhukti", lords: [maha.lord, bhukti.lord], ...clip(bhukti) });
        for (const antara of (bhukti.children ?? []).filter(inRange)) {
          if (fruitful.includes(antara.lord)) {
            windows.push({ level: "antara", lords: [maha.lord, bhukti.lord, antara.lord], ...clip(antara) });
          }
        }
      }
    }
  }

  return {
    category,
    favourable,
    negating,
    cusp: { house: category.decidingCusp, subLord, starOfSubLord },
    viaStarLord,
    viaSelf,
    favourableHits,
    negatingHits,
    verdict,
    explanation,
    fruitful,
    windows: windows.slice(0, 12),
  };
}
