/**
 * Krishnamurti Paddhati — canonical reference data.
 *
 * Everything here is fixed structure: the nine grahas, the twelve sidereal
 * rasis and their lords, the 27 nakshatras and their Vimshottari lords, and
 * the Vimshottari periods that set the width of every sub.
 *
 * The zodiac is **sidereal** throughout. A KP longitude is the apparent
 * geocentric longitude minus the KP (Krishnamurti) ayanamsa; see `ayanamsa.ts`.
 */

/** The nine grahas used by KP, in Vimshottari order starting from Ketu. */
export type Graha =
  | "ketu"
  | "venus"
  | "sun"
  | "moon"
  | "mars"
  | "rahu"
  | "jupiter"
  | "saturn"
  | "mercury";

/** Vimshottari order. Nakshatra lords, sub lords and dashas all follow it. */
export const VIMSHOTTARI_ORDER: readonly Graha[] = [
  "ketu",
  "venus",
  "sun",
  "moon",
  "mars",
  "rahu",
  "jupiter",
  "saturn",
  "mercury",
] as const;

/** Vimshottari mahadasha length of each graha, in years. They sum to 120. */
export const DASHA_YEARS: Readonly<Record<Graha, number>> = {
  ketu: 7,
  venus: 20,
  sun: 6,
  moon: 10,
  mars: 7,
  rahu: 18,
  jupiter: 16,
  saturn: 19,
  mercury: 17,
};

/** The full Vimshottari cycle, in years. */
export const VIMSHOTTARI_TOTAL_YEARS = 120;

/** Display order for chart tables: the seven visible grahas, then the nodes. */
export const GRAHA_DISPLAY_ORDER: readonly Graha[] = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
] as const;

export const GRAHA_LABEL: Readonly<Record<Graha, { english: string; sanskrit: string; short: string }>> = {
  sun: { english: "Sun", sanskrit: "Surya", short: "Su" },
  moon: { english: "Moon", sanskrit: "Chandra", short: "Mo" },
  mars: { english: "Mars", sanskrit: "Mangala", short: "Ma" },
  mercury: { english: "Mercury", sanskrit: "Budha", short: "Me" },
  jupiter: { english: "Jupiter", sanskrit: "Guru", short: "Ju" },
  venus: { english: "Venus", sanskrit: "Shukra", short: "Ve" },
  saturn: { english: "Saturn", sanskrit: "Shani", short: "Sa" },
  rahu: { english: "Rahu", sanskrit: "Rahu", short: "Ra" },
  ketu: { english: "Ketu", sanskrit: "Ketu", short: "Ke" },
};

/** Width of one sidereal rasi (sign). */
export const RASI_ARC = 30;

/** Width of one nakshatra: 360 / 27 = 13°20′. */
export const NAKSHATRA_ARC = 360 / 27;

/** Width of one pada (quarter of a nakshatra): 3°20′. */
export const PADA_ARC = NAKSHATRA_ARC / 4;

export interface Rasi {
  /** 1 (Mesha) – 12 (Meena). */
  index: number;
  sanskrit: string;
  english: string;
  lord: Graha;
}

/** The twelve sidereal rasis with their (traditional, seven-graha) lords. */
export const RASIS: readonly Rasi[] = [
  { index: 1, sanskrit: "Mesha", english: "Aries", lord: "mars" },
  { index: 2, sanskrit: "Vrishabha", english: "Taurus", lord: "venus" },
  { index: 3, sanskrit: "Mithuna", english: "Gemini", lord: "mercury" },
  { index: 4, sanskrit: "Karka", english: "Cancer", lord: "moon" },
  { index: 5, sanskrit: "Simha", english: "Leo", lord: "sun" },
  { index: 6, sanskrit: "Kanya", english: "Virgo", lord: "mercury" },
  { index: 7, sanskrit: "Tula", english: "Libra", lord: "venus" },
  { index: 8, sanskrit: "Vrischika", english: "Scorpio", lord: "mars" },
  { index: 9, sanskrit: "Dhanu", english: "Sagittarius", lord: "jupiter" },
  { index: 10, sanskrit: "Makara", english: "Capricorn", lord: "saturn" },
  { index: 11, sanskrit: "Kumbha", english: "Aquarius", lord: "saturn" },
  { index: 12, sanskrit: "Meena", english: "Pisces", lord: "jupiter" },
] as const;

export interface Nakshatra {
  /** 1 (Ashwini) – 27 (Revati). */
  index: number;
  name: string;
  lord: Graha;
}

/** The 27 nakshatras from 0° sidereal Aries. Lords cycle in Vimshottari order. */
export const NAKSHATRAS: readonly Nakshatra[] = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
].map((name, i) => ({ index: i + 1, name, lord: VIMSHOTTARI_ORDER[i % 9] }));

/** Weekday lords, Sunday first — the KP "day lord" of the ruling planets. */
export const WEEKDAY_LORDS: readonly Graha[] = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
] as const;
