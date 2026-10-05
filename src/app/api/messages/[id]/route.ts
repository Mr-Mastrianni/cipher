import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { DirectMessage } from "@/lib/db/schema";

/**
 * `/api/messages/[id]`
 *
 * - `PATCH`  — edit a direct message. The store enforces author-only edits.
 * - `DELETE` — soft-delete the caller's own message, or any message if admin.
 *
 * As with channel messages, the `Store` interface has no `getDirectMessageById`,
 * so ownership is resolved by scanning only the threads the caller already
 * participates in. A member therefore cannot reach another pair's messages.
 */

const editSchema = z.object({
  body: z.string().min(1).max(4000),
});

/**
 * Find a direct message inside one of the caller's own threads.
 *
 * @param userId - The caller.
 * @param messageId - The direct message uuid.
 * @returns The message row, or `null` when it is not in one of their threads.
 */
async function findOwnDirectMessage(
  userId: string,
  messageId: string,
): Promise<DirectMessage | null> {
  const store = getStore();
  const threads = await store.listDirectThreadsForUser(userId);
  for (const thread of threads) {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const result = await store.listDirectMessages(thread.id, { cursor, limit: 100 });
      const hit = result.items.find((message) => message.id === messageId);
      if (hit) return hit;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
  }
  return null;
}

/**
 * Edit a direct message.
 *
 * @param request - JSON body `{ body: string }`.
 * @param context - Route context carrying the direct message `id`.
 * @returns The updated message, or a 403 when the caller is not its author.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/messages/[id]">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const parsed = editSchema.safeParse(payload);
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

    const updated = await store.editDirectMessage(id, body, user.id);
    if (!updated) {
      return Response.json(
        { ok: false, error: "Message not found, or you are not its author." },
        { status: 403 },
      );
    }

    await store.recordAuditLog({
      actorUserId: user.id,
      action: "direct.message.edit",
      targetType: "direct_message",
      targetId: id,
      after: { body },
    });

    return Response.json({
      ok: true,
      message: {
        id: updated.id,
        body: updated.body,
        editedAt: updated.editedAt ? updated.editedAt.toISOString() : null,
      },
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not edit the message." }, { status: 500 })
    );
  }
}

/**
 * Soft-delete a direct message.
 *
 * @param _request - Unused.
 * @param context - Route context carrying the direct message `id`.
 * @returns `{ ok: true }` once the row is tombstoned.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/messages/[id]">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    const message = await findOwnDirectMessage(user.id, id);
    if (!message) {
      return Response.json({ ok: false, error: "Message not found." }, { status: 404 });
    }
    if (message.authorId !== user.id && user.role !== "admin") {
      return Response.json(
        { ok: false, error: "You can only delete your own messages." },
        { status: 403 },
      );
    }

    const deleted = await store.softDeleteDirectMessage(id);
    if (!deleted) {
      return Response.json({ ok: false, error: "Message not found." }, { status: 404 });
    }

    await store.recordAuditLog({
      actorUserId: user.id,
      action: "direct.message.delete",
      targetType: "direct_message",
      targetId: id,
      before: { authorId: message.authorId, body: message.body },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not delete the message." }, { status: 500 })
    );
  }
}
