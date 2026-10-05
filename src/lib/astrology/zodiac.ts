import type { Element, Modality, ZodiacSign } from "./types";

export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export const SIGN_ELEMENT: Readonly<Record<ZodiacSign, Element>> = {
  Aries: "Fire",
  Leo: "Fire",
  Sagittarius: "Fire",
  Taurus: "Earth",
  Virgo: "Earth",
  Capricorn: "Earth",
  Gemini: "Air",
  Libra: "Air",
  Aquarius: "Air",
  Cancer: "Water",
  Scorpio: "Water",
  Pisces: "Water",
};

export const SIGN_MODALITY: Readonly<Record<ZodiacSign, Modality>> = {
  Aries: "Cardinal",
  Cancer: "Cardinal",
  Libra: "Cardinal",
  Capricorn: "Cardinal",
  Taurus: "Fixed",
  Leo: "Fixed",
  Scorpio: "Fixed",
  Aquarius: "Fixed",
  Gemini: "Mutable",
  Virgo: "Mutable",
  Sagittarius: "Mutable",
  Pisces: "Mutable",
};

export const SIGN_GLYPH: Readonly<Record<ZodiacSign, string>> = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
};

/** Traditional rulers, used for the "who is running this chart" readout. */
export const SIGN_RULER: Readonly<Record<ZodiacSign, string>> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars (traditional) / Pluto (modern)",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn (traditional) / Uranus (modern)",
  Pisces: "Jupiter (traditional) / Neptune (modern)",
};

export function signOf(longitude: number): ZodiacSign {
  const index = Math.floor(normalize(longitude) / 30) % 12;
  return ZODIAC_SIGNS[index];
}

export function signDegreeOf(longitude: number): number {
  return normalize(longitude) % 30;
}

export function normalize(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Format as `12°34' Aries`. */
export function formatLongitude(longitude: number, withSign = true): string {
  const lon = normalize(longitude);
  const deg = Math.floor(lon % 30);
  const min = Math.floor(((lon % 30) - deg) * 60);
  const sec = Math.round(((((lon % 30) - deg) * 60) - min) * 60);
  const sign = signOf(lon);
  const base = `${deg}°${String(min).padStart(2, "0")}'`;
  const withSec = sec > 0 ? `${base}${String(sec).padStart(2, "0")}"` : base;
  return withSign ? `${withSec} ${sign}` : withSec;
}

/** Short form: `12°34′ ♈`. */
export function formatLongitudeShort(longitude: number): string {
  const lon = normalize(longitude);
  const deg = Math.floor(lon % 30);
  const min = Math.floor(((lon % 30) - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}′ ${SIGN_GLYPH[signOf(lon)]}`;
}

/**
 * The absolute longitude at which a given sign begins.
 */
export function signStart(sign: ZodiacSign): number {
  return ZODIAC_SIGNS.indexOf(sign) * 30;
}

/**
 * Signed angular separation in degrees, in (-180, 180].
 */
export function separation(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/** Unsigned angular separation in degrees, in [0, 180]. */
export function angularSeparation(a: number, b: number): number {
  return Math.abs(separation(a, b));
}
