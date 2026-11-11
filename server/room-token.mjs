/**
 * Room tokens: the WebSocket room's proof of membership.
 *
 * The Next app knows who is signed in (Clerk); the room server does not, and
 * should not need Clerk to find out. So `/api/world/token` signs a short-lived
 * token for the signed-in member and the room server checks the signature with
 * the same secret (`WORLD_TOKEN_SECRET`). The token carries only the member's
 * opaque world id (`m-` + a hash of the user id, the same id the HTTP room uses),
 * never an email or a Clerk id.
 *
 *   token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payload part))
 *   payload = { v: 1, sub: "m-…", exp: <unix ms> }
 *
 * Kept dependency-free so the room server image needs nothing beyond `ws`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const ROOM_TOKEN_TTL_MS = 2 * 60 * 1000;
const MEMBER_ID_RE = /^m-[a-f0-9]{20}$/;

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function signPart(secret, part) {
  return createHmac("sha256", secret).update(part).digest();
}

/**
 * Sign a token for a member world id. The app has its own TypeScript signer;
 * this one exists for tests and tooling, and both must produce tokens the other
 * accepts.
 *
 * @param {string} secret
 * @param {string} sub
 * @param {number} [now]
 * @param {number} [ttlMs]
 */
export function signRoomToken(secret, sub, now = Date.now(), ttlMs = ROOM_TOKEN_TTL_MS) {
  if (!secret) throw new Error("A token secret is required.");
  if (!MEMBER_ID_RE.test(sub)) throw new Error("A member world id is required.");
  const part = b64url(JSON.stringify({ v: 1, sub, exp: now + ttlMs }));
  return `${part}.${b64url(signPart(secret, part))}`;
}

/**
 * Check a token. Returns the member's world id, or null with a reason.
 *
 * @param {string} secret
 * @param {unknown} token
 * @param {number} [now]
 * @returns {{ ok: true, sub: string } | { ok: false, reason: string }}
 */
export function verifyRoomToken(secret, token, now = Date.now()) {
  if (!secret) return { ok: false, reason: "no secret" };
  if (typeof token !== "string" || token.length > 512) return { ok: false, reason: "missing" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return { ok: false, reason: "malformed" };
  const part = token.slice(0, dot);
  let given;
  try {
    given = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expected = signPart(secret, part);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature" };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload || payload.v !== 1) return { ok: false, reason: "version" };
  if (typeof payload.sub !== "string" || !MEMBER_ID_RE.test(payload.sub)) {
    return { ok: false, reason: "subject" };
  }
  if (typeof payload.exp !== "number" || payload.exp < now) return { ok: false, reason: "expired" };
  return { ok: true, sub: payload.sub };
}
