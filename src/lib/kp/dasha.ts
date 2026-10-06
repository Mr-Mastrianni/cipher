/**
 * Vimshottari dasha.
 *
 * The birth dasha is ruled by the Moon's nakshatra lord; the fraction of the
 * nakshatra the Moon has yet to traverse is the fraction of that mahadasha
 * still to run. Bhuktis (antardashas) and antaras (pratyantardashas) subdivide
 * each period in the same Vimshottari proportions, starting with the period's
 * own lord.
 *
 * Year length: 365.25 days (the Julian year), the convention of KP
 * ephemerides and most KP software. It is reported with the result.
 */

import {
  DASHA_YEARS,
  NAKSHATRAS,
  NAKSHATRA_ARC,
  VIMSHOTTARI_ORDER,
  VIMSHOTTARI_TOTAL_YEARS,
  type Graha,
} from "./constants";
import { normalizeDegrees } from "./lords";

export const DASHA_YEAR_DAYS = 365.25;
const MS_PER_YEAR = DASHA_YEAR_DAYS * 86_400_000;

export interface DashaPeriod {
  lord: Graha;
  start: Date;
  end: Date;
  /** Sub-periods, when requested. */
  children?: DashaPeriod[];
}

export interface DashaResult {
  /** Mahadasha running at birth. */
  birthLord: Graha;
  /** Years of the birth mahadasha left at birth. */
  balanceYears: number;
  yearDays: number;
  /** Mahadashas from the (backdated) start of the birth dasha, for 120 years. */
  mahadashas: DashaPeriod[];
}

function sequenceFrom(lord: Graha): Graha[] {
  const start = VIMSHOTTARI_ORDER.indexOf(lord);
  return Array.from({ length: 9 }, (_, i) => VIMSHOTTARI_ORDER[(start + i) % 9]);
}

/** Subdivide a period into its nine sub-periods. */
function subdivide(parent: DashaPeriod, depth: number): DashaPeriod[] {
  const span = parent.end.getTime() - parent.start.getTime();
  let cursor = parent.start.getTime();
  return sequenceFrom(parent.lord).map((lord) => {
    const length = (span * DASHA_YEARS[lord]) / VIMSHOTTARI_TOTAL_YEARS;
    const period: DashaPeriod = { lord, start: new Date(cursor), end: new Date(cursor + length) };
    cursor += length;
    if (depth > 1) period.children = subdivide(period, depth - 1);
    return period;
  });
}

/**
 * Vimshottari dashas from the Moon's sidereal longitude.
 *
 * @param depth 1 = mahadashas, 2 = + bhuktis, 3 = + antaras.
 */
export function vimshottari(moonSidereal: number, birth: Date, depth: 1 | 2 | 3 = 3): DashaResult {
  const longitude = normalizeDegrees(moonSidereal);
  const index = Math.min(26, Math.floor(longitude / NAKSHATRA_ARC));
  const birthLord = NAKSHATRAS[index].lord;
  const elapsedFraction = (longitude - index * NAKSHATRA_ARC) / NAKSHATRA_ARC;
  const balanceYears = DASHA_YEARS[birthLord] * (1 - elapsedFraction);

  // Backdate the first mahadasha to its notional start so every period has its
  // full length; the birth falls `elapsedFraction` of the way through it.
  let cursor = birth.getTime() - DASHA_YEARS[birthLord] * elapsedFraction * MS_PER_YEAR;
  const mahadashas = sequenceFrom(birthLord).map((lord) => {
    const length = DASHA_YEARS[lord] * MS_PER_YEAR;
    const period: DashaPeriod = { lord, start: new Date(cursor), end: new Date(cursor + length) };
    cursor += length;
    if (depth > 1) period.children = subdivide(period, depth - 1);
    return period;
  });

  return { birthLord, balanceYears, yearDays: DASHA_YEAR_DAYS, mahadashas };
}

/** The chain of periods (maha → bhukti → antara) running at `at`. */
export function runningPeriods(result: DashaResult, at: Date): DashaPeriod[] {
  const chain: DashaPeriod[] = [];
  let level: DashaPeriod[] | undefined = result.mahadashas;
  while (level) {
    const current: DashaPeriod | undefined = level.find(
      (period) => period.start.getTime() <= at.getTime() && at.getTime() < period.end.getTime(),
    );
    if (!current) break;
    chain.push(current);
    level = current.children;
  }
  return chain;
}
