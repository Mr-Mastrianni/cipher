/**
 * Stored birth-profile snapshots.
 *
 * `profileInputFromReading` projects a computed reading (KP chart, Human
 * Design bodygraph, Aura Avatar, placement) onto the birth-profile columns.
 * `completeProfileSnapshots` fills in whatever a stored profile is missing —
 * profiles saved before the KP engine existed, or seeded with birth data only —
 * from the member's verified birth data, once.
 */

import { cache } from "react";
import { computeReading } from "./compute-reading";
import type { ShareableBirth } from "./share-code";
import type { Bodygraph as StoredBodygraph, BirthProfile } from "../db/schema";
import { getStore, type Store, type UpsertBirthProfileInput } from "../db/store";
import { CHANNEL_BY_GATES, type CenterKey } from "../human-design";
import { birthInput, type StoredKp } from "../matching/features";

/** Zero-pad a number for a date/time string. */
function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/**
 * Project a freshly computed reading onto the birth-profile columns.
 *
 * @param userId - The member's id.
 * @param input - The birth input that produced the reading.
 * @param reading - The computed reading.
 * @returns An input for `store.upsertBirthProfile`.
 */
export function profileInputFromReading(
  userId: string,
  input: ShareableBirth,
  reading: ReturnType<typeof computeReading>,
): UpsertBirthProfileInput {
  const graph = reading.bodygraph;
  const centerKeys = Object.keys(graph.centers) as CenterKey[];
  const definedCenters = centerKeys.filter((key) => graph.centers[key].defined);
  const openCenters = centerKeys.filter((key) => !graph.centers[key].defined);

  const bodygraph: StoredBodygraph = {
    type: graph.type,
    authority: graph.authority,
    profile: graph.profile,
    definition: graph.definition.label,
    definedCenters,
    openCenters,
    channels: graph.channels.map((channel) => ({
      gates: [channel.gates[0], channel.gates[1]],
      name: channel.name,
      circuit: CHANNEL_BY_GATES.get(channel.key)?.circuit,
    })),
    gates: graph.activations.map((activation) => ({
      gate: activation.gate,
      line: activation.line,
      color: activation.color,
      tone: activation.tone,
      base: activation.base,
      side: activation.source,
      planet: activation.body,
    })),
    variables: {
      determination: graph.variables.determination?.name,
      environment: graph.variables.environment?.name,
      motivation: graph.variables.motivation?.name,
      perspective: graph.variables.perspective?.name,
    },
  };

  return {
    userId,
    birthDate: `${input.year}-${pad(input.month)}-${pad(input.day)}`,
    birthTime: `${pad(input.hour)}:${pad(input.minute)}:${pad(input.second ?? 0)}`,
    birthTimeZone: input.timeZone,
    birthLatitude: input.latitude,
    birthLongitude: input.longitude,
    birthPlaceName: input.placeName ?? null,
    // JSON round-trip: the snapshot is stored as plain data.
    kpChart: JSON.parse(JSON.stringify(reading.kp)) as Record<string, unknown>,
    bodygraph,
    auraSeat: reading.avatar?.seat ?? "",
    auraFormat: reading.avatar?.format ?? "",
    auraLabel: reading.avatar?.label ?? "",
    strengths: reading.category.strengths,
    weaknesses: reading.category.growthEdges,
  };
}


/**
 * Compute and store any missing KP chart or bodygraph snapshot for a profile.
 * Returns the (possibly updated) profile. Never throws: a birth moment that
 * cannot be resolved simply leaves the profile as it was.
 */
export async function completeProfileSnapshots(
  store: Store,
  profile: BirthProfile | null,
): Promise<BirthProfile | null> {
  if (!profile || (profile.kpChart && profile.bodygraph)) return profile;
  const stored = (profile.kpChart as StoredKp | null) ?? null;
  const input = birthInput(profile, stored);
  if (!input) return profile;
  try {
    const birth: ShareableBirth = {
      ...input,
      placeName: profile.birthPlaceName ?? undefined,
      nodeType: stored?.system?.nodeType ?? "mean",
    };
    const reading = computeReading(birth);
    return await store.upsertBirthProfile({
      ...profileInputFromReading(profile.userId, birth, reading),
      birthPlaceName: profile.birthPlaceName,
      onboardingAnswers: profile.onboardingAnswers,
    });
  } catch {
    return profile;
  }
}

/**
 * The member's birth profile with any missing snapshots completed — memoised
 * per request, because a layout and its page render in parallel and must not
 * both compute (or race to store) the same snapshot.
 */
export const getCompleteProfile = cache(async (userId: string): Promise<BirthProfile | null> => {
  const store = getStore();
  return completeProfileSnapshots(store, await store.getBirthProfileByUser(userId));
});
