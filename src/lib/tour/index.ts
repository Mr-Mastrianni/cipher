/**
 * Persistence for the first-run tour.
 *
 * The tour is a UI nicety, not a permission, so it is stored **on the device**
 * (localStorage) rather than in Postgres: no migration, no API route, and no
 * server round trip before the dashboard can paint. The cost is that a member
 * who signs in on a second device sees the tour once more, which is a far
 * cheaper mistake than a database write on a render path.
 *
 * The key carries a version so that a materially different tour can be shown
 * again by bumping it, without an ad-hoc migration of stored flags.
 *
 * Every read and write is try/catch-guarded: Safari private mode and some
 * embedded webviews throw on `localStorage`, and a tour that throws is worse
 * than a tour that cannot remember it ran.
 */

/** Bump the suffix to show the tour again after changing the steps. */
export const TOUR_STORAGE_KEY = "cipher:tour:v1";

/**
 * Window event asking a mounted tour to run again.
 *
 * `useBrowserValue` reads localStorage without subscribing to it, so a same-page
 * "Replay the tour" cannot rely on a storage event. The settings panel clears
 * the key and dispatches this instead.
 */
export const TOUR_RESTART_EVENT = "cipher:tour-restart";

/** Whether this device has already seen the tour. Fails closed (no nagging). */
export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}

/** Record that the tour has been seen. Never throws. */
export function markTourSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    /* The tour will simply offer itself again on the next visit. */
  }
}

/**
 * Forget the tour and tell any mounted tour to start.
 *
 * The caller is responsible for navigating to a route the tour can run on
 * (`/dashboard`); clearing the flag alone does nothing on another page.
 */
export function restartTour(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* Ignore: the event below still asks this session's tour to run. */
  }
  window.dispatchEvent(new Event(TOUR_RESTART_EVENT));
}
