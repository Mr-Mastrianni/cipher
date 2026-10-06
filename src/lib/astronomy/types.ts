/**
 * Shared input and astronomy types.
 *
 * This folder is pure astronomy — positions, time scales and house geometry —
 * shared by the KP engine (`@/lib/kp`) and the Human Design engine. It contains
 * no astrology of its own: there is no Western or tropical chart anywhere in
 * the platform.
 */

/** The bodies the Human Design engine reads directly from the ephemeris. */
export type BodyKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto"
  | "northNode"
  | "southNode";

/** Precision tier for a computed position. */
export type Precision = "high" | "approximate" | "derived";

/** A wall-clock birth moment at a place. */
export interface BirthInput {
  /** Local calendar date at the place of birth. */
  year: number;
  month: number;
  /** 1–31 */
  day: number;
  /** 0–23, local clock time. */
  hour: number;
  minute: number;
  second?: number;
  /** IANA zone, e.g. "Asia/Kolkata". */
  timeZone: string;
  latitude: number;
  /** East positive. */
  longitude: number;
  /** Optional place label for display. */
  placeName?: string;
}
