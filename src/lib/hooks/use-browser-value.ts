"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Read a browser-only value (localStorage, `Intl`, `navigator`…) without the
 * mount-effect-then-setState dance: the server render and hydration use
 * `serverValue`, and the client switches to `read()` without a cascading render.
 *
 * `read` must return a stable value between calls (a primitive, or a cached
 * object), because React compares snapshots by identity.
 */
export function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
