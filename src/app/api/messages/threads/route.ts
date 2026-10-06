import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember, requireTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { User } from "@/lib/db/schema";

/**
 * `/api/messages/threads`
 *
 * - `GET`  — the caller's DM threads, most recently active first. Passing a
 *   `?q=` also returns member matches for the "start a conversation" picker.
 * - `POST` — find or create the canonical thread with another member.
 *
 * Every projection here is the *public* member summary: id, display name and
 * avatar. Applicants and denied accounts are never searchable, so the picker
 * cannot be used to enumerate the membership pipeline.
 */

/** The fields of another member a peer is allowed to see. */
interface MemberSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  tier: string;
}

/** Reduce a user row to the peer-visible summary. */
function toMemberSummary(user: User): MemberSummary {
  const name =
    user.displayName ?? [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    id: user.id,
    name: name || "Member",
    imageUrl: user.imageUrl ?? null,
    tier: user.tier,
  };
}

/** A thread as the messages surface consumes it. */
interface ThreadSummary {
  id: string;
  other: MemberSummary;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    authorId: string;
  } | null;
  lastMessageAt: string | null;
}

const startSchema = z.object({
  userId: z.string().min(1),
});

/**
 * List the caller's conversations, optionally searching members.
 *
 * @param request - The incoming request; `q` is an optional member search.
 * @returns Threads plus (when `q` is present) matching members.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireMember();
    const store = getStore();

    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    const threads = await store.listDirectThreadsForUser(user.id);
    const summaries: ThreadSummary[] = [];
    for (const thread of threads) {
      const otherId = thread.userAId === user.id ? thread.userBId : thread.userAId;
      const other = await store.getUserById(otherId);
      if (!other) continue;
      const latest = await store.listDirectMessages(thread.id, { limit: 1 });
      const last = latest.items[0] ?? null;
      summaries.push({
        id: thread.id,
        other: toMemberSummary(other),
        lastMessage: last
          ? {
              id: last.id,
              body: last.deletedAt ? "" : last.body,
              createdAt: last.createdAt.toISOString(),
              authorId: last.authorId,
            }
          : null,
        lastMessageAt: (thread.lastMessageAt ?? thread.createdAt).toISOString(),
      });
    }

    let members: MemberSummary[] = [];
    if (query.length > 0) {
      const page = await store.listUsers({
        search: query,
        membershipStatus: "approved",
        pageSize: 12,
      });
      members = page.items
        .filter((candidate) => candidate.id !== user.id && !candidate.deletedAt)
        .map(toMemberSummary);
    }

    return Response.json({
      ok: true,
      me: toMemberSummary(user),
      threads: summaries,
      members,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load conversations." }, { status: 500 })
    );
  }
}

/**
 * Find or create a direct thread with another member.
 *
 * @param request - JSON body `{ userId: string }`.
 * @returns The canonical thread id and the other member's summary.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireMember();
    // Direct messages are an Initiate feature; reading old threads is not gated.
    requireTier(user, "initiate", "Direct messages");
    const store = getStore();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const parsed = startSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "A member id is required." }, { status: 400 });
    }

    const otherId = parsed.data.userId;
    if (otherId === user.id) {
      return Response.json(
        { ok: false, error: "You cannot start a conversation with yourself." },
        { status: 400 },
      );
    }

    const other = await store.getUserById(otherId);
    if (!other || other.deletedAt) {
      return Response.json({ ok: false, error: "Member not found." }, { status: 404 });
    }
    if (other.role !== "admin" && other.membershipStatus !== "approved") {
      return Response.json(
        { ok: false, error: "That member cannot receive messages yet." },
        { status: 403 },
      );
    }

    const thread = await store.findOrCreateDirectThread(user.id, otherId);
    return Response.json(
      { ok: true, threadId: thread.id, other: toMemberSummary(other) },
      { status: 201 },
    );
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not start the conversation." }, { status: 500 })
    );
  }
}
