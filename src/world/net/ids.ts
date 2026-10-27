/**
 * The browser's stable world id.
 *
 * The HTTP room uses it until Clerk gives the member an opaque member hash; the
 * WebSocket room uses it as the socket identity so a host who refreshes the page
 * can still run the session they scheduled. It is not an account and grants
 * nothing outside a room the member already has the link to.
 */

const PLAYER_KEY = "cipher:world:player";

export function readWorldPlayerId(): string {
  try {
    const stored = window.localStorage.getItem(PLAYER_KEY);
    if (stored && /^[mw]-[a-z0-9-]{6,40}$/.test(stored)) return stored;
  } catch {
    /* storage may be blocked */
  }
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const id = `w-${random.slice(0, 20)}`;
  rememberWorldPlayerId(id);
  return id;
}

export function rememberWorldPlayerId(id: string): void {
  if (!/^[mw]-[a-z0-9-]{6,40}$/.test(id)) return;
  try {
    window.localStorage.setItem(PLAYER_KEY, id);
  } catch {
    /* storage may be blocked; the id survives for this session */
  }
}
