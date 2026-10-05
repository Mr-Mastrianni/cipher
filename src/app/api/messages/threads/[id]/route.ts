import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { DirectMessage, User } from "@/lib/db/schema";

/**
 * `/api/messages/threads/[id]`
 *
 * - `GET`  — a cursor page of the thread's messages. The caller must be one of
 *   the two participants; anything else is a 404, not a 403, so thread ids
 *   cannot be probed for existence.
 * - `POST` — append a message to the thread.
 */

/** The wire shape of a direct message with its author's public summary. */
interface ThreadMessage {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: { id: string; name: string; imageUrl: string | null };
}

/** The public projection of a member. */
function summary(user: User | null, fallbackId: string) {
  const name =
    user?.displayName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  return {
    id: user?.id ?? fallbackId,
    name: name || "Member",
    imageUrl: user?.imageUrl ?? null,
  };
}

/** Attach author summaries, de-duplicating lookups within one page. */
async function enrich(rows: DirectMessage[]): Promise<ThreadMessage[]> {
  const store = getStore();
  const cache = new Map<string, User | null>();
  const out: ThreadMessage[] = [];
  for (const row of rows) {
    if (!cache.has(row.authorId)) {
      cache.set(row.authorId, await store.getUserById(row.authorId));
    }
    out.push({
      id: row.id,
      authorId: row.authorId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt ? row.editedAt.toISOString() : null,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      author: summary(cache.get(row.authorId) ?? null, row.authorId),
    });
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Rate limiting (per instance — see the community route for the caveat)
 * ------------------------------------------------------------------------- */

const WINDOW_MS = 10_000;
const MAX_SENDS = 10;
const recentSends = new Map<string, number[]>();

/**
 * Sliding-window send limiter.
 *
 * @param userId - The sender.
 * @returns `true` when the send is allowed.
 */
function allowSend(userId: string): boolean {
  const now = Date.now();
  const history = (recentSends.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (history.length >= MAX_SENDS) {
    recentSends.set(userId, history);
    return false;
  }
  history.push(now);
  recentSends.set(userId, history);
  return true;
}

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
});

/**
 * Load a thread only when the caller participates in it.
 *
 * @param threadId - The thread uuid.
 * @param userId - The caller.
 * @returns The thread, or `null` when it does not exist or is not theirs.
 */
async function participantThread(threadId: string, userId: string) {
  const store = getStore();
  const thread = await store.getDirectThreadById(threadId);
  if (!thread) return null;
  if (thread.userAId !== userId && thread.userBId !== userId) return null;
  return thread;
}

/**
 * Read a conversation's history.
 *
 * @param request - The incoming request; `cursor` and `limit` are query params.
 * @param context - Route context carrying the thread `id`.
 * @returns The page of messages plus the other participant.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/messages/threads/[id]">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    const thread = await participantThread(id, user.id);
    if (!thread) {
      return Response.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 },
      );
    }

    const otherId = thread.userAId === user.id ? thread.userBId : thread.userAId;
    const other = await store.getUserById(otherId);

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 50;

    const page = await store.listDirectMessages(id, { cursor, limit });
    const ordered = [...page.items].reverse();

    return Response.json({
      ok: true,
      me: summary(user, user.id),
      other: summary(other, otherId),
      messages: await enrich(ordered),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json(
        { ok: false, error: "Could not load the conversation." },
        { status: 500 },
      )
    );
  }
}

/**
 * Send a direct message.
 *
 * @param request - JSON body `{ body: string }`.
 * @param context - Route context carrying the thread `id`.
 * @returns The created message, enriched with its author.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/messages/threads/[id]">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    if (!allowSend(user.id)) {
      return Response.json(
        { ok: false, error: "You are sending too quickly. Wait a moment." },
        { status: 429 },
      );
    }

    const thread = await participantThread(id, user.id);
    if (!thread) {
      return Response.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const parsed = sendSchema.safeParse(payload);
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

    const created = await store.createDirectMessage({
      threadId: id,
      authorId: user.id,
      body,
    });

    const [enriched] = await enrich([created]);
    return Response.json({ ok: true, message: enriched }, { status: 201 });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not send the message." }, { status: 500 })
    );
  }
}
