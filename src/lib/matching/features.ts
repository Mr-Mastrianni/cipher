/**
 * Matching features for one member, read from their stored chart snapshots or,
 * when a snapshot is missing, computed from their verified birth data.
 *
 * Server-only (it may run the KP engine). Results are cached per profile
 * version, so a list of candidates is cheap after the first request.
 */

import type { BirthProfile, User } from "../db/schema";
import { channelKey } from "../human-design/constants";
import { computeHumanDesign } from "../human-design";
import { computeKpChart, type KpBirthInput } from "../kp/chart";
import type { Graha } from "../kp/constants";
import type { MatchFeatures } from "./score";

export interface StoredKp {
  birth?: { input?: Partial<KpBirthInput> };
  system?: { nodeType?: "mean" | "true" };
  planets?: Array<{ graha?: string; nakshatra?: { name?: string }; starLord?: string }>;
  cusps?: Array<{ rasi?: { sanskrit?: string } }>;
  dasha?: { mahadashas?: Array<{ lord?: string; start?: string; end?: string }> };
}

const cache = new Map<string, Omit<MatchFeatures, "interests"> & { mahadashas: Array<{ lord: Graha; start: number; end: number }> }>();
const MAX_CACHE = 5000;

/** The verified birth input stored on a profile, or `null` if it cannot be parsed. */
export function birthInput(profile: BirthProfile, stored: StoredKp | null): KpBirthInput | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthDate);
  const time = /^(\d{2}):(\d{2}):(\d{2})/.exec(profile.birthTime);
  if (!date || !time) return null;
  return {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2]),
    second: Number(time[3]),
    timeZone: profile.birthTimeZone,
    latitude: profile.birthLatitude,
    longitude: profile.birthLongitude,
    fold: stored?.birth?.input?.fold,
  };
}

function extract(profile: BirthProfile) {
  const stored = (profile.kpChart as StoredKp | null) ?? null;
  let kp: { moonNakshatra: string; moonStarLord: Graha; lagnaRasi: string } | null = null;
  let mahadashas: Array<{ lord: Graha; start: number; end: number }> = [];
  let hd: MatchFeatures["hd"] = null;

  const moon = stored?.planets?.find((p) => p.graha === "moon");
  if (moon?.nakshatra?.name && moon.starLord && stored?.cusps?.[0]?.rasi?.sanskrit) {
    kp = {
      moonNakshatra: moon.nakshatra.name,
      moonStarLord: moon.starLord as Graha,
      lagnaRasi: stored.cusps[0].rasi.sanskrit,
    };
    mahadashas = (stored.dasha?.mahadashas ?? [])
      .filter((m) => m.lord && m.start && m.end)
      .map((m) => ({ lord: m.lord as Graha, start: Date.parse(m.start as string), end: Date.parse(m.end as string) }));
  }

  if (profile.bodygraph?.gates?.length) {
    hd = {
      type: profile.bodygraph.type,
      profile: profile.bodygraph.profile,
      gates: [...new Set(profile.bodygraph.gates.map((g) => g.gate))],
      channels: profile.bodygraph.channels.map((c) => channelKey(c.gates[0], c.gates[1])),
    };
  }

  // Fill whatever the snapshots lacked from the birth data itself.
  if (!kp || !hd) {
    const input = birthInput(profile, stored);
    if (input) {
      try {
        const chart = computeKpChart(input, { nodeType: stored?.system?.nodeType });
        if (!kp) {
          const m = chart.planets.find((p) => p.graha === "moon");
          if (m) kp = { moonNakshatra: m.nakshatra.name, moonStarLord: m.starLord, lagnaRasi: chart.cusps[0].rasi.sanskrit };
          mahadashas = chart.dasha.mahadashas.map((p) => ({ lord: p.lord, start: p.start.getTime(), end: p.end.getTime() }));
        }
        if (!hd) {
          const graph = computeHumanDesign(new Date(chart.birth.utc));
          hd = {
            type: graph.type,
            profile: graph.profile,
            gates: [...new Set(graph.activations.map((a) => a.gate))],
            channels: graph.channels.map((c) => c.key),
          };
        }
      } catch {
        // An unresolvable birth moment contributes no chart features.
      }
    }
  }

  return { userId: profile.userId, hd, kp: kp ? { ...kp, mahadasha: null } : null, mahadashas };
}

/** Matching features for a member at `now`. */
export function featuresFor(user: User, profile: BirthProfile | null, now: Date = new Date()): MatchFeatures {
  if (!profile) return { userId: user.id, interests: user.interests ?? [], hd: null, kp: null };
  const key = `${profile.id}:${profile.updatedAt.getTime()}`;
  let entry = cache.get(key);
  if (!entry) {
    if (cache.size >= MAX_CACHE) cache.clear();
    entry = extract(profile);
    cache.set(key, entry);
  }
  const running = entry.mahadashas.find((m) => m.start <= now.getTime() && now.getTime() < m.end)?.lord ?? null;
  return {
    userId: user.id,
    interests: user.interests ?? [],
    hd: entry.hd,
    kp: entry.kp ? { ...entry.kp, mahadasha: running } : null,
  };
}
