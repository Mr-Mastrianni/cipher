/**
 * Read markers for community continuity.
 *
 * These are intentionally local: the world and the 2D site share the same
 * browser origin, so a marker written on `/dashboard/community/...` is visible
 * in `/world` on the next poll. No new table or migration is needed. A marker is
 * the timestamp of the newest message the member has actually seen; unread means
 * the room's newest message is later than that.
 *
 * The trade-off is honest: this is not cross-device read state. A member who
 * reads on a phone and opens the world on a laptop will see the recent rooms as
 * unread again. Durable unread counts belong in `channel_members` when that is
 * worth the schema work.
 */

import type { CommunitySummary } from "./summary";

const READ_KEY = "cipher:community:read:v1";

export type CommunityReads = Record<string, number>;

export function channelReadKey(slug: string): string {
  return `channel:${slug}`;
}

export function dmReadKey(threadId: string): string {
  return `dm:${threadId}`;
}

export function readCommunityReads(): CommunityReads {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: CommunityReads = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const at = Number(value);
      if (Number.isFinite(at) && at > 0) out[key] = at;
    }
    return out;
  } catch {
    return {};
  }
}

/** Record that the member has seen a room up to `at`; never moves backwards. */
export function markCommunityRead(key: string, at: number): void {
  if (!Number.isFinite(at) || at <= 0) return;
  try {
    const reads = readCommunityReads();
    if ((reads[key] ?? 0) >= at) return;
    reads[key] = at;
    window.localStorage.setItem(READ_KEY, JSON.stringify(reads));
    window.dispatchEvent(new CustomEvent("cipher-community-read", { detail: { key, at } }));
  } catch {
    /* storage may be blocked; the badge simply stays unread */
  }
}

export function latestTime(latest: { createdAt: string } | null): number {
  if (!latest) return 0;
  const at = Date.parse(latest.createdAt);
  return Number.isFinite(at) ? at : 0;
}

export function isChannelUnread(
  slug: string,
  summary: CommunitySummary | null,
  reads: CommunityReads = readCommunityReads(),
): boolean {
  if (!summary) return false;
  const channel = summary.channels.find((entry) => entry.slug === slug);
  if (!channel?.latest) return false;
  return latestTime(channel.latest) > (reads[channelReadKey(slug)] ?? 0);
}

export function isDmUnread(
  id: string,
  summary: CommunitySummary | null,
  reads: CommunityReads = readCommunityReads(),
): boolean {
  if (!summary) return false;
  const thread = summary.dms.find((entry) => entry.id === id);
  if (!thread?.latest) return false;
  return latestTime(thread.latest) > (reads[dmReadKey(id)] ?? 0);
}

/** Counts rooms and threads with something unseen, not individual messages. */
export function countCommunityUnread(
  summary: CommunitySummary | null,
  reads: CommunityReads = readCommunityReads(),
): number {
  if (!summary) return 0;
  let count = 0;
  for (const channel of summary.channels) {
    if (channel.latest && latestTime(channel.latest) > (reads[channelReadKey(channel.slug)] ?? 0)) {
      count += 1;
    }
  }
  for (const dm of summary.dms) {
    if (dm.latest && latestTime(dm.latest) > (reads[dmReadKey(dm.id)] ?? 0)) count += 1;
  }
  return count;
}
