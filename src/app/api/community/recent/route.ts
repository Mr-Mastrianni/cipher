/**
 * `/api/community/recent`
 *
 * The world's notification surface: the newest message in each accessible
 * Collective room, plus the member's recent direct-message threads. The 2D
 * rooms remain the record; this route only reads. Unread counts are computed
 * against the browser's read markers so this route does not need a new table.
 */

import { handleAuthError, requireMember, userHasTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { COLLECTIVE_ROOMS } from "@/lib/community/rooms";
import type {
  CommunityChannelSummary,
  CommunityDmSummary,
  CommunityLatest,
} from "@/lib/community/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicName(
  user: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null,
): string {
  if (!user) return "Member";
  return (
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Member"
  );
}

export async function GET(): Promise<Response> {
  try {
    const user = await requireMember();
    const store = getStore();
    const rooms = new Map(COLLECTIVE_ROOMS.map((room) => [room.slug, room]));
    const allChannels = await store.listChannels();

    const channels: CommunityChannelSummary[] = [];
    for (const channel of allChannels) {
      const room = rooms.get(channel.slug);
      if (!room) continue;
      if (channel.tierRequired && !userHasTier(user, channel.tierRequired)) continue;
      const page = await store.listMessages(channel.id, { limit: 1 });
      const message = page.items[0] ?? null;
      let latest: CommunityLatest | null = null;
      if (message) {
        const author = await store.getUserById(message.authorId);
        latest = {
          id: message.id,
          body: message.body.slice(0, 240),
          authorId: message.authorId,
          authorName: publicName(author),
          createdAt: message.createdAt.toISOString(),
        };
      }
      channels.push({
        slug: channel.slug,
        name: room.name,
        description: room.description,
        tierRequired: channel.tierRequired ?? null,
        latest,
        href: `/dashboard/community/${channel.slug}`,
      });
    }
    channels.sort((a, b) => {
      const at = a.latest ? Date.parse(a.latest.createdAt) : 0;
      const bt = b.latest ? Date.parse(b.latest.createdAt) : 0;
      return bt - at || a.name.localeCompare(b.name);
    });

    const dms: CommunityDmSummary[] = [];
    const threads = await store.listDirectThreadsForUser(user.id);
    for (const thread of threads) {
      const page = await store.listDirectMessages(thread.id, { limit: 1 });
      const message = page.items[0] ?? null;
      if (!message) continue;
      const otherId = thread.userAId === user.id ? thread.userBId : thread.userAId;
      const other = await store.getUserById(otherId);
      dms.push({
        id: thread.id,
        otherName: publicName(other),
        latest: {
          id: message.id,
          body: message.body.slice(0, 240),
          authorId: message.authorId,
          authorName: publicName(other),
          createdAt: message.createdAt.toISOString(),
        },
        href: `/dashboard/messages?thread=${thread.id}`,
      });
    }
    dms.sort((a, b) => {
      const at = a.latest ? Date.parse(a.latest.createdAt) : 0;
      const bt = b.latest ? Date.parse(b.latest.createdAt) : 0;
      return bt - at;
    });

    return Response.json(
      { ok: true, channels, dms: dms.slice(0, 8), fetchedAt: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load the Collective." }, { status: 500 })
    );
  }
}
