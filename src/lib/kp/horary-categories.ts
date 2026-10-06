/**
 * KP horary question categories and judgement types — data only, safe to
 * import from client components (the engine lives in `horary.ts`).
 */

import type { Graha } from "./constants";

export interface HoraryCategory {
  id: string;
  label: string;
  /** The cusp whose sub lord decides the matter. */
  decidingCusp: number;
  /** Houses that support the matter (standard KP groupings). */
  favourable: number[];
}

export const HORARY_CATEGORIES: readonly HoraryCategory[] = [
  { id: "marriage", label: "Marriage", decidingCusp: 7, favourable: [2, 7, 11] },
  { id: "job", label: "Getting a job or promotion", decidingCusp: 10, favourable: [2, 6, 10, 11] },
  { id: "business", label: "Business or partnership success", decidingCusp: 7, favourable: [2, 7, 10, 11] },
  { id: "property", label: "Buying property or a home", decidingCusp: 4, favourable: [4, 11, 12] },
  { id: "travel-abroad", label: "Travel or settlement abroad", decidingCusp: 12, favourable: [3, 9, 12] },
  { id: "recovery", label: "Recovery from illness", decidingCusp: 1, favourable: [1, 5, 11] },
  { id: "exam", label: "Success in an exam or admission", decidingCusp: 4, favourable: [4, 9, 11] },
  { id: "childbirth", label: "Childbirth", decidingCusp: 5, favourable: [2, 5, 11] },
  { id: "litigation", label: "Winning a dispute or lawsuit", decidingCusp: 6, favourable: [1, 6, 11] },
  { id: "lost-article", label: "Recovering a lost article", decidingCusp: 2, favourable: [2, 6, 11] },
  { id: "finance", label: "Receiving money or a loan", decidingCusp: 11, favourable: [2, 6, 11] },
] as const;

export const HORARY_CATEGORY_BY_ID: ReadonlyMap<string, HoraryCategory> = new Map(
  HORARY_CATEGORIES.map((c) => [c.id, c]),
);

/** The 12th from each favourable house, excluding any that are themselves favourable. */
export function negatingHouses(favourable: readonly number[]): number[] {
  const set = new Set(favourable);
  return [...new Set(favourable.map((h) => ((h + 10) % 12) + 1))]
    .filter((h) => !set.has(h))
    .sort((a, b) => a - b);
}

export type HoraryVerdict = "promised" | "mixed" | "denied";

export interface HoraryJudgement {
  category: HoraryCategory;
  favourable: number[];
  negating: number[];
  cusp: { house: number; subLord: Graha; starOfSubLord: Graha };
  /** Houses the sub lord signifies through its star lord (occupation, ownership). */
  viaStarLord: number[];
  /** Houses the sub lord signifies through itself. */
  viaSelf: number[];
  favourableHits: number[];
  negatingHits: number[];
  verdict: HoraryVerdict;
  explanation: string;
  /** Significators of the favourable houses that are also ruling planets. */
  fruitful: Graha[];
  /** Upcoming horary dasha periods ruled by fruitful significators. */
  windows: Array<{ level: "bhukti" | "antara"; lords: Graha[]; start: string; end: string }>;
}
