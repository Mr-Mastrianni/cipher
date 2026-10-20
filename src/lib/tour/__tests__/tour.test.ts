/**
 * First-run tour persistence.
 *
 * The rules that matter are small but user-visible: a member sees the tour once,
 * a reload does not re-offer it, "Replay" clears it, and a storage API that
 * throws (Safari private mode, some webviews) must never nag or crash.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  hasSeenTour,
  markTourSeen,
  restartTour,
  TOUR_RESTART_EVENT,
  TOUR_STORAGE_KEY,
} from "../index";

/* ── A minimal localStorage + window stand-in ─────────────────────────────── */

interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStorage(): FakeStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

/**
 * Run `fn` with a `window` in scope.
 *
 * @param storage - The storage to expose, or a thunk that throws to emulate a
 *   browser that denies access.
 * @param fn - The body under test.
 * @returns Whatever `fn` returns.
 */
function withWindow<T>(storage: FakeStorage, fn: (events: string[]) => T): T {
  const scope = globalThis as unknown as { window?: unknown };
  const previous = scope.window;
  const events: string[] = [];

  scope.window = {
    localStorage: storage,
    dispatchEvent: (event: Event) => {
      events.push(event.type);
      return true;
    },
  };

  try {
    return fn(events);
  } finally {
    scope.window = previous;
  }
}

/** A storage whose every method throws, like a locked-down webview. */
function denyingStorage(): FakeStorage {
  const deny = (): never => {
    throw new Error("SecurityError: localStorage is not available");
  };
  return { getItem: deny, setItem: deny, removeItem: deny };
}

/* ── Tests ────────────────────────────────────────────────────────────────── */

test("a device that has never seen the tour is offered it", () => {
  const storage = memoryStorage();
  assert.equal(
    withWindow(storage, () => hasSeenTour()),
    false,
  );
});

test("marking the tour seen is what stops it being offered again", () => {
  const storage = memoryStorage();

  withWindow(storage, () => markTourSeen());

  assert.equal(storage.dump()[TOUR_STORAGE_KEY], "done");
  assert.equal(withWindow(storage, () => hasSeenTour()), true);
});

test("restarting clears the flag and asks a mounted tour to run", () => {
  const storage = memoryStorage();
  withWindow(storage, () => markTourSeen());
  assert.equal(withWindow(storage, () => hasSeenTour()), true);

  const events = withWindow(storage, (captured) => {
    restartTour();
    return captured;
  });

  assert.deepEqual(events, [TOUR_RESTART_EVENT]);
  assert.equal(storage.dump()[TOUR_STORAGE_KEY], undefined);
  assert.equal(withWindow(storage, () => hasSeenTour()), false);
});

test("a storage that throws fails closed and never throws at the caller", () => {
  // Every entry point must survive a browser that refuses localStorage.
  withWindow(denyingStorage(), () => {
    assert.doesNotThrow(() => markTourSeen());
    assert.doesNotThrow(() => restartTour());
    // Fails closed: an unreadable flag means "do not nag".
    assert.equal(hasSeenTour(), true);
  });
});

test("a browser that denies the localStorage getter itself also fails closed", () => {
  // Chrome throws on the *property access*, not on the method call, when site
  // data is blocked — so the guard has to cover the lookup too.
  const scope = globalThis as unknown as { window?: unknown };
  const previous = scope.window;
  const locked: Record<string, unknown> = { dispatchEvent: () => true };
  Object.defineProperty(locked, "localStorage", {
    get() {
      throw new Error("SecurityError: access denied");
    },
  });
  scope.window = locked;

  try {
    assert.doesNotThrow(() => markTourSeen());
    assert.doesNotThrow(() => restartTour());
    assert.equal(hasSeenTour(), true);
  } finally {
    scope.window = previous;
  }
});
