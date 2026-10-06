/**
 * KP significators.
 *
 * House significators, in KP's four levels of strength (strongest first):
 *   A. planets in the star of an occupant of the house
 *   B. occupants of the house
 *   C. planets in the star of the house's lord
 *   D. the house's lord (sign lord of its cusp)
 * If a house is unoccupied, levels A and B are empty and C/D carry it.
 *
 * Rahu and Ketu are agents: in addition to their own occupation and star
 * relationships, a node signifies what its sign lord signifies. That agency is
 * applied here, flagged per entry so the UI can show why a node appears.
 *
 * Planet significations are the same table read the other way: the houses a
 * planet signifies through its star lord's occupation and ownership (levels A
 * and C) and through its own (levels B and D).
 */

import { GRAHA_DISPLAY_ORDER, type Graha } from "./constants";

export type SignificatorLevel = "A" | "B" | "C" | "D";

export interface HouseSignificators {
  house: number;
  /** Sign lord of the cusp. */
  lord: Graha;
  occupants: Graha[];
  levels: Record<SignificatorLevel, Graha[]>;
  /** Every significator once, strongest level first. */
  all: Graha[];
}

export interface PlanetSignification {
  graha: Graha;
  /** Houses signified, per level, ascending. */
  levels: Record<SignificatorLevel, number[]>;
  /** Every house signified, ascending. */
  houses: number[];
  /** True when the node also carries its sign lord's houses (agency). */
  viaAgency: boolean;
}

export interface SignificatorInput {
  /** House each graha occupies, 1–12. */
  houseOf: Record<Graha, number>;
  /** Star (nakshatra) lord of each graha. */
  starLordOf: Record<Graha, Graha>;
  /** Sign lord of each graha's position. */
  signLordOf: Record<Graha, Graha>;
  /** Sign lord of each cusp, index 0 = house 1. */
  cuspSignLords: Graha[];
}

const unique = <T,>(list: T[]): T[] => [...new Set(list)];

export function computeSignificators(input: SignificatorInput): {
  houses: HouseSignificators[];
  planets: PlanetSignification[];
} {
  const grahas = GRAHA_DISPLAY_ORDER;
  const occupantsOf = (house: number) => grahas.filter((g) => input.houseOf[g] === house);
  const inStarOf = (lords: Graha[]) => grahas.filter((g) => lords.includes(input.starLordOf[g]));

  const houses: HouseSignificators[] = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const lord = input.cuspSignLords[i];
    const occupants = occupantsOf(house);
    const levels: Record<SignificatorLevel, Graha[]> = {
      A: inStarOf(occupants),
      B: occupants,
      C: inStarOf([lord]),
      D: [lord],
    };
    return { house, lord, occupants, levels, all: unique([...levels.A, ...levels.B, ...levels.C, ...levels.D]) };
  });

  // Nodes as agents of their sign lords: a node appears at every level where
  // its sign lord appears (classical KP does not demote the agent's level).
  for (const node of ["rahu", "ketu"] as const) {
    const principal = input.signLordOf[node];
    for (const entry of houses) {
      for (const level of ["A", "B", "C", "D"] as const) {
        if (entry.levels[level].includes(principal) && !entry.levels[level].includes(node)) {
          entry.levels[level] = [...entry.levels[level], node];
        }
      }
      entry.all = unique([...entry.levels.A, ...entry.levels.B, ...entry.levels.C, ...entry.levels.D]);
    }
  }

  const planets: PlanetSignification[] = grahas.map((graha) => {
    const levels: Record<SignificatorLevel, number[]> = { A: [], B: [], C: [], D: [] };
    for (const entry of houses) {
      for (const level of ["A", "B", "C", "D"] as const) {
        if (entry.levels[level].includes(graha)) levels[level].push(entry.house);
      }
    }
    const houseList = unique([...levels.A, ...levels.B, ...levels.C, ...levels.D]).sort((a, b) => a - b);
    return {
      graha,
      levels,
      houses: houseList,
      viaAgency: graha === "rahu" || graha === "ketu",
    };
  });

  return { houses, planets };
}
