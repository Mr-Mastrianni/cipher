import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { Message, User } from "@/lib/db/schema";

/**
 * `/api/community/[slug]/messages`
 *
 * The channel message stream.
 *
 * - `GET`  — newest-first cursor page, enriched with author summaries.
 * - `POST` — post a message. Zod-validated, length-limited, rate-limited.
 *
 * Authorisation is re-checked here rather than trusted from the client: the
 * channel is resolved by slug, then the member's tier is compared against the
 * channel's `tierRequired` floor. Nothing from another member is returned
 * beyond the public author projection the community surface already shows.
 */

/** Minimum tier required to read or post, in ascending order. */
const TIER_RANK: Readonly<Record<string, number>> = {
  free: 0,
  initiate: 1,
  adept: 2,
  oracle: 3,
};

/** The wire shape of a message, with its author's public summary attached. */
interface CommunityMessage {
  id: string;
  channelId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}

/** Reduce a user row to the fields other members are allowed to see. */
function publicAuthor(user: User | null, fallbackId: string) {
  const name =
    user?.displayName ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ??
    "";
  return {
    id: user?.id ?? fallbackId,
    name: name || "Member",
    imageUrl: user?.imageUrl ?? null,
  };
}

/** Attach author summaries, de-duplicating lookups across a page of messages. */
async function enrich(
  rows: Message[],
): Promise<CommunityMessage[]> {
  const store = getStore();
  const cache = new Map<string, User | null>();
  const out: CommunityMessage[] = [];
  for (const row of rows) {
    if (!cache.has(row.authorId)) {
      cache.set(row.authorId, await store.getUserById(row.authorId));
    }
    out.push({
      id: row.id,
      channelId: row.channelId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt ? row.editedAt.toISOString() : null,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      author: publicAuthor(cache.get(row.authorId) ?? null, row.authorId),
    });
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Rate limiting
 * ------------------------------------------------------------------------- */

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_POSTS = 8;
/** Per-process sliding window keyed by user id. See the note below. */
const recentPosts = new Map<string, number[]>();

/**
 * A tiny in-memory sliding-window limiter.
 *
 * This is per Node instance: behind several serverless instances a determined
 * member could exceed it by fanning out. It is a cheap abuse damper, not a
 * security boundary — a durable limiter belongs in the database or at the edge
 * when a database is configured.
 *
 * @param userId - The member posting.
 * @returns `true` when the post is allowed.
 */
function allowPost(userId: string): boolean {
  const now = Date.now();
  const history = (recentPosts.get(userId) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );
  if (history.length >= RATE_LIMIT_MAX_POSTS) {
    recentPosts.set(userId, history);
    return false;
  }
  history.push(now);
  recentPosts.set(userId, history);
  return true;
}

const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

/**
 * List a channel's messages, newest first.
 *
 * @param request - The incoming request; `cursor` and `limit` are query params.
 * @param context - Route context carrying the `slug` path parameter.
 * @returns A cursor page of messages plus the channel summary.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/community/[slug]/messages">,
) {
  try {
    const user = await requireMember();
    const { slug } = await context.params;
    const store = getStore();

    const channel = await store.getChannelBySlug(slug);
    if (!channel) {
      return Response.json({ ok: false, error: "Channel not found." }, { status: 404 });
    }

    const required = channel.tierRequired;
    if (required && (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[required] ?? 0)) {
      return Response.json(
        { ok: false, error: `This channel needs the ${required} tier.` },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "40", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 40;

    const page = await store.listMessages(channel.id, { cursor, limit });
    // The store returns newest-first; the UI reads oldest-first so the newest
    // message sits at the bottom of the log.
    const ordered = [...page.items].reverse();

    return Response.json({
      ok: true,
      channel: {
        id: channel.id,
        slug: channel.slug,
        name: channel.name,
        description: channel.description,
        kind: channel.kind,
        tierRequired: channel.tierRequired,
      },
      me: { id: user.id, name: publicAuthor(user, user.id).name, role: user.role },
      messages: await enrich(ordered),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load messages." }, { status: 500 })
    );
  }
}

/**
 * Post a message to a channel.
 *
 * @param request - JSON body `{ body: string }`.
 * @param context - Route context carrying the `slug` path parameter.
 * @returns The created message, enriched with its author.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/community/[slug]/messages">,
) {
  try {
    const user = await requireMember();
    const { slug } = await context.params;
    const store = getStore();

    if (!allowPost(user.id)) {
      return Response.json(
        { ok: false, error: "You are posting too quickly. Wait a moment." },
        { status: 429 },
      );
    }

    const channel = await store.getChannelBySlug(slug);
    if (!channel) {
      return Response.json({ ok: false, error: "Channel not found." }, { status: 404 });
    }

    const required = channel.tierRequired;
    if (required && (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[required] ?? 0)) {
      return Response.json(
        { ok: false, error: `This channel needs the ${required} tier.` },
        { status: 403 },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        { ok: false, error: "Expected a JSON body." },
        { status: 400 },
      );
    }

    const parsed = createMessageSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "A message must be between 1 and 4000 characters." },
        { status: 400 },
      );
    }

    const body = parsed.data.body.trim();
    if (body.length === 0) {
      return Response.json(
        { ok: false, error: "A message cannot be only whitespace." },
        { status: 400 },
      );
    }

    const created = await store.createMessage({
      channelId: channel.id,
      authorId: user.id,
      body,
    });

    const [enriched] = await enrich([created]);
    return Response.json({ ok: true, message: enriched }, { status: 201 });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not post the message." }, { status: 500 })
    );
  }
}
