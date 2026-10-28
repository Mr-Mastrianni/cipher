/**
 * Theme identity, shared by the server and the client.
 *
 * The theme is persisted in a **cookie** so the server can render the correct
 * `data-theme` on `<html>` in the HTML it sends. That removes the need for a
 * pre-paint bootstrap `<script>`, which React refuses to treat as a component
 * ("Scripts inside React components are never executed when rendering on the
 * client") and which therefore logged a console error on every page.
 *
 * `localStorage` is still written alongside it: it is what a member's browser
 * keeps if the cookie is cleared by a privacy setting, and `readStoredTheme`
 * remains the last-resort fallback on the client.
 */

export const THEMES = ["dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

/** The cookie the server reads to render `data-theme`. */
export const THEME_COOKIE = "cipher_theme";

/** A year, in seconds: a theme choice should outlive a session. */
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

/** Whether an arbitrary value names a theme. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** The theme to render when nothing has been chosen. */
export const DEFAULT_THEME: Theme = "dark";
