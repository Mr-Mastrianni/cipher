import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { Message } from "@/lib/db/schema";

/**
 * `/api/community/messages/[id]`
 *
 * - `PATCH`  — edit a message body. The store enforces author-only edits.
 * - `DELETE` — soft-delete. The author, or an admin, may remove a message.
 *
 * The `Store` interface deliberately exposes no `getMessageById` (channel
 * messages are always read through their channel), so ownership for a delete is
 * resolved by scanning the channels the caller can reach. The scan is bounded,
 * and the alternative — trusting an actor id from the client — would let any
 * member delete any post.
 */

const editSchema = z.object({
  body: z.string().min(1).max(4000),
});

/**
 * Find a message anywhere the store can see it.
 *
 * @param id - The message uuid.
 * @returns The message row, or `null` when it does not exist.
 */
async function findMessage(id: string): Promise<Message | null> {
  const store = getStore();
  const channels = await store.listChannels();
  for (const channel of channels) {
    let cursor: string | undefined;
    // 20 pages × 100 rows is far beyond any channel this app expects; the cap
    // exists so a pathological id cannot turn into an unbounded scan.
    for (let page = 0; page < 20; page += 1) {
      const result = await store.listMessages(channel.id, { cursor, limit: 100 });
      const hit = result.items.find((message) => message.id === id);
      if (hit) return hit;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
  }
  return null;
}

/**
 * Edit a message.
 *
 * @param request - JSON body `{ body: string }`.
 * @param context - Route context carrying the message `id`.
 * @returns The updated message, or a 403/404 error.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/community/messages/[id]">,
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

    // `editorId` makes this author-only inside the store.
    const updated = await store.editMessage(id, body, user.id);
    if (!updated) {
      return Response.json(
        { ok: false, error: "Message not found, or you are not its author." },
        { status: 403 },
      );
    }

    await store.recordAuditLog({
      actorUserId: user.id,
      action: "community.message.edit",
      targetType: "message",
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
 * Soft-delete a message.
 *
 * @param _request - Unused.
 * @param context - Route context carrying the message `id`.
 * @returns `{ ok: true }` once the row is tombstoned.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/community/messages/[id]">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    const message = await findMessage(id);
    if (!message) {
      return Response.json({ ok: false, error: "Message not found." }, { status: 404 });
    }
    if (message.authorId !== user.id && user.role !== "admin") {
      return Response.json(
        { ok: false, error: "You can only delete your own messages." },
        { status: 403 },
      );
    }

    const deleted = await store.softDeleteMessage(id);
    if (!deleted) {
      return Response.json({ ok: false, error: "Message not found." }, { status: 404 });
    }

    await store.recordAuditLog({
      actorUserId: user.id,
      action: "community.message.delete",
      targetType: "message",
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
