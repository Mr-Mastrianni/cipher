/** Rank the opted-in pool for one member. Shared by the API and the dashboard. */

import type { BirthProfile, User } from "../db/schema";
import type { Store } from "../db/store";
import { featuresFor } from "./features";
import { scoreMatch, type MatchReason } from "./score";

export interface RankedMatch {
  member: {
    id: string;
    name: string;
    imageUrl: string | null;
    bio: string | null;
    hd: { type: string; profile: string } | null;
    kp: { moonNakshatra: string; lagnaRasi: string } | null;
  };
  score: number;
  reasons: MatchReason[];
}

export function displayNameOf(user: User): string {
  return user.displayName ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || "Member");
}

export async function findMatches(
  store: Store,
  user: User,
  profile: BirthProfile,
  limit = 20,
  now: Date = new Date(),
): Promise<RankedMatch[]> {
  const mine = featuresFor(user, profile, now);
  const pool = await store.listMatchingProfiles();
  return pool
    .filter((entry) => entry.user.id !== user.id)
    .map((entry) => {
      const theirs = featuresFor(entry.user, entry.profile, now);
      const result = scoreMatch(mine, theirs);
      return {
        member: {
          id: entry.user.id,
          name: displayNameOf(entry.user),
          imageUrl: entry.user.imageUrl,
          bio: entry.user.bio,
          hd: theirs.hd ? { type: theirs.hd.type, profile: theirs.hd.profile } : null,
          kp: theirs.kp ? { moonNakshatra: theirs.kp.moonNakshatra, lagnaRasi: theirs.kp.lagnaRasi } : null,
        },
        score: result.score,
        reasons: result.reasons,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
