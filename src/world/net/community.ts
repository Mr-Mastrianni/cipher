/**
 * The world's window onto the persistent Collective.
 *
 * The 2D rooms own the messages and the read markers; this module only asks the
 * summary route what is newest, then compares it with the markers in
 * localStorage. It never copies a room into the room document.
 */

import type { CommunitySummary } from "@/lib/community/summary";
import { countCommunityUnread, readCommunityReads } from "@/lib/community/read-state";
import { getStore } from "../state";

let inflight: Promise<void> | null = null;

export async function refreshCommunity(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch("/api/community/recent", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { ok?: boolean } & Partial<CommunitySummary>;
      if (!data.ok || !Array.isArray(data.channels) || !Array.isArray(data.dms)) return;
      const summary: CommunitySummary = {
        channels: data.channels,
        dms: data.dms,
        fetchedAt: data.fetchedAt ?? new Date().toISOString(),
      };
      getStore().set({
        community: summary,
        communityUnread: countCommunityUnread(summary, readCommunityReads()),
      });
    } catch {
      /* a dropped summary poll is not worth surfacing */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Recompute the badge after a local read marker changes. */
export function recomputeCommunityUnread(): void {
  const state = getStore().get();
  if (!state.community) return;
  getStore().set({
    communityUnread: countCommunityUnread(state.community, readCommunityReads()),
  });
}
