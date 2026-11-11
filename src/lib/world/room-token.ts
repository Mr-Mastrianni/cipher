/**
 * The app's side of the WebSocket room token (see `server/room-token.mjs`).
 *
 * `/api/world/token` signs one of these for the signed-in member; the room
 * server verifies it with the same `WORLD_TOKEN_SECRET`. Short-lived on
 * purpose: the client asks for a fresh one on every connect.
 */

import { createHmac } from "node:crypto";

export const ROOM_TOKEN_TTL_MS = 2 * 60 * 1000;

export function roomTokenSecret(): string {
  return process.env.WORLD_TOKEN_SECRET ?? "";
}

export function signRoomToken(
  secret: string,
  sub: string,
  now = Date.now(),
  ttlMs = ROOM_TOKEN_TTL_MS,
): string {
  if (!secret) throw new Error("A token secret is required.");
  if (!/^m-[a-f0-9]{20}$/.test(sub)) throw new Error("A member world id is required.");
  const part = Buffer.from(JSON.stringify({ v: 1, sub, exp: now + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret).update(part).digest("base64url");
  return `${part}.${sig}`;
}
