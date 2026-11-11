/**
 * `/api/world/token` — a short-lived pass into the WebSocket room.
 *
 * The room server has no accounts of its own. When `WORLD_TOKEN_SECRET` is set
 * on both the app and the room server, the client asks here for a token before
 * every connect; the server checks its signature and uses the member's opaque
 * world id as their identity, so a name can't be borrowed and a terrace can't be
 * reclaimed by someone else typing the same name.
 *
 * 404 means tokens are not configured (local development), and the client
 * connects without one.
 */

import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { memberWorldId } from "@/lib/world/room";
import { ROOM_TOKEN_TTL_MS, roomTokenSecret, signRoomToken } from "@/lib/world/room-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET(): Promise<Response> {
  const secret = roomTokenSecret();
  if (!secret) {
    return Response.json({ ok: false, error: "Room tokens are not configured." }, { status: 404, headers: noStore });
  }
  if (!clerkConfigured) {
    return Response.json({ ok: false, error: "Sign-in is not configured." }, { status: 503, headers: noStore });
  }
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return Response.json({ ok: false, error: "Sign in to join the room." }, { status: 401, headers: noStore });
  }
  const id = memberWorldId(user.id);
  const now = Date.now();
  return Response.json(
    { ok: true, id, token: signRoomToken(secret, id, now), expiresAt: now + ROOM_TOKEN_TTL_MS },
    { headers: noStore },
  );
}
