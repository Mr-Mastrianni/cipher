/**
 * The member's running Vimshottari periods, read from their stored KP chart
 * snapshot (dates as ISO strings) or recomputed from their birth data.
 */

import type { BirthProfile } from "../db/schema";
import { birthInput, type StoredKp } from "../matching/features";
import { computeKpChart } from "./chart";
import type { Graha } from "./constants";

export interface RunningPeriod {
  lord: Graha;
  start: Date;
  end: Date;
}

export interface MemberTiming {
  /** Mahadasha, bhukti (and antara when available) running at `now`. */
  running: RunningPeriod[];
  /** The bhukti after the running one, if known. */
  nextBhukti: RunningPeriod | null;
}

interface StoredPeriod {
  lord?: string;
  start?: string;
  end?: string;
  children?: StoredPeriod[];
}

function toPeriod(p: StoredPeriod): RunningPeriod | null {
  if (!p.lord || !p.start || !p.end) return null;
  return { lord: p.lord as Graha, start: new Date(p.start), end: new Date(p.end) };
}

export function memberTiming(profile: BirthProfile, now: Date = new Date()): MemberTiming | null {
  const stored = (profile.kpChart as (StoredKp & { dasha?: { mahadashas?: StoredPeriod[] } }) | null) ?? null;
  let mahadashas: StoredPeriod[] | undefined = stored?.dasha?.mahadashas;
  if (!mahadashas?.length) {
    const input = birthInput(profile, stored);
    if (!input) return null;
    try {
      mahadashas = JSON.parse(
        JSON.stringify(computeKpChart(input, { nodeType: stored?.system?.nodeType }).dasha.mahadashas),
      ) as StoredPeriod[];
    } catch {
      return null;
    }
  }
  const t = now.getTime();
  const within = (p: StoredPeriod) => Date.parse(p.start ?? "") <= t && t < Date.parse(p.end ?? "");
  const running: RunningPeriod[] = [];
  let level: StoredPeriod[] | undefined = mahadashas;
  let bhukties: StoredPeriod[] | undefined;
  let bhuktiIndex = -1;
  let maha: StoredPeriod | undefined;
  while (level?.length) {
    const index = level.findIndex(within);
    if (index < 0) break;
    const period = toPeriod(level[index]);
    if (period) running.push(period);
    if (running.length === 1) maha = level[index];
    if (running.length === 2) {
      bhukties = level;
      bhuktiIndex = index;
    }
    level = level[index].children;
  }
  let nextBhukti: RunningPeriod | null = null;
  if (bhukties && bhuktiIndex >= 0) {
    nextBhukti = bhukties[bhuktiIndex + 1] ? toPeriod(bhukties[bhuktiIndex + 1]) : null;
    if (!nextBhukti && maha) {
      const mahaIndex = mahadashas.indexOf(maha);
      const following = mahadashas[mahaIndex + 1];
      nextBhukti = following?.children?.[0] ? toPeriod(following.children[0]) : following ? toPeriod(following) : null;
    }
  }
  return { running, nextBhukti };
}
