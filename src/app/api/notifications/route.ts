import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { Notification } from "@/lib/db/schema";

/**
 * `/api/notifications`
 *
 * - `GET`   — the caller's notifications, newest first, with an unread count.
 * - `PATCH` — mark one notification read (`{ id }`), or all of them
 *   (`{ all: true }`).
 *
 * A notification belongs to exactly one member, so both verbs scope every read
 * and write to the caller. The store's `markNotificationRead` takes only an id,
 * so ownership is proved against the caller's own list before it is called —
 * otherwise any member could clear another member's bell.
 */

const patchSchema = z
  .object({
    id: z.string().min(1).optional(),
    all: z.literal(true).optional(),
  })
  .refine((value) => Boolean(value.id) || value.all === true, {
    message: "Provide a notification id or { all: true }.",
  });

/** The wire shape of a notification. */
interface NotificationWire {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Project a notification row onto the wire. */
function toWire(row: Notification): NotificationWire {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * List the caller's notifications.
 *
 * @param request - The incoming request; `limit` caps the page size.
 * @returns Notifications plus the unread count.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireMember();
    const store = getStore();

    const limitParam = Number.parseInt(
      new URL(request.url).searchParams.get("limit") ?? "30",
      10,
    );
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 30;

    const rows = await store.listNotifications(user.id, limit);
    return Response.json({
      ok: true,
      notifications: rows.map(toWire),
      unreadCount: rows.filter((row) => row.readAt === null).length,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load notifications." }, { status: 500 })
    );
  }
}

/**
 * Mark notifications read.
 *
 * @param request - JSON body `{ id }` or `{ all: true }`.
 * @returns The refreshed unread count.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireMember();
    const store = getStore();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "Provide a notification id or { all: true }." },
        { status: 400 },
      );
    }

    // Ownership proof: only ids present in the caller's own list can be touched.
    const mine = await store.listNotifications(user.id, 100);

    if (parsed.data.all === true) {
      for (const row of mine) {
        if (row.readAt === null) await store.markNotificationRead(row.id);
      }
    } else if (parsed.data.id) {
      const target = mine.find((row) => row.id === parsed.data.id);
      if (!target) {
        return Response.json(
          { ok: false, error: "Notification not found." },
          { status: 404 },
        );
      }
      await store.markNotificationRead(target.id);
    }

    const refreshed = await store.listNotifications(user.id, 100);
    return Response.json({
      ok: true,
      unreadCount: refreshed.filter((row) => row.readAt === null).length,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not update notifications." }, { status: 500 })
    );
  }
}
