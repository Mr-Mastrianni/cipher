/**
 * Shared types for the astrology engine.
 */

export type ZodiacSign =
  | "Aries"
  | "Taurus"
  | "Gemini"
  | "Cancer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Scorpio"
  | "Sagittarius"
  | "Capricorn"
  | "Aquarius"
  | "Pisces";

export type Element = "Fire" | "Earth" | "Air" | "Water";
export type Modality = "Cardinal" | "Fixed" | "Mutable";

/** The bodies the engine resolves. */
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
  | "chiron"
  | "northNode"
  | "southNode"
  | "lilith";

export type PointKey =
  | BodyKey
  | "ascendant"
  | "midheaven"
  | "descendant"
  | "imumCoeli"
  | "vertex";

/** Precision tier for a computed position, surfaced honestly in the UI. */
export type Precision = "high" | "approximate" | "derived";

export interface Position {
  key: PointKey;
  /** Ecliptic longitude in degrees, [0, 360). */
  longitude: number;
  /** Ecliptic latitude in degrees, when meaningful. */
  latitude: number;
  /** Distance in AU, when meaningful. */
  distance?: number;
  /** Daily motion in longitude, degrees per day. Negative = retrograde. */
  speed: number;
  retrograde: boolean;
  sign: ZodiacSign;
  /** Degrees within the sign, [0, 30). */
  signDegree: number;
  house: number | null;
  precision: Precision;
}

export type HouseSystem =
  | "placidus"
  | "koch"
  | "porphyry"
  | "whole-sign"
  | "equal"
  | "regiomontanus"
  | "campanus";

export interface HouseCusps {
  system: HouseSystem;
  /** The system actually used, if a fallback was required. */
  requestedSystem: HouseSystem;
  fallback: boolean;
  fallbackReason?: string;
  /** Twelve cusp longitudes, index 0 = 1st house. */
  cusps: number[];
}

export interface AspectDefinition {
  key: string;
  name: string;
  angle: number;
  /** Default orb in degrees. */
  orb: number;
  major: boolean;
  harmonic: number;
  glyph: string;
}

export interface Aspect {
  from: PointKey;
  to: PointKey;
  definition: AspectDefinition;
  /** Exact angular separation in degrees. */
  separation: number;
  /** Signed deviation from exact, in degrees. */
  orb: number;
  applying: boolean;
  /** Strength 0–1, where 1 is exact. */
  strength: number;
}

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
  /** IANA zone, e.g. "America/New_York". */
  timeZone: string;
  latitude: number;
  longitude: number;
  /** Optional place label for display. */
  placeName?: string;
}

export interface NatalChart {
  input: BirthInput;
  /** Resolved UTC instant. */
  utc: string;
  julianDayUT: number;
  julianDayTT: number;
  deltaTSeconds: number;
  positions: Position[];
  houses: HouseCusps;
  aspects: Aspect[];
  /** Counts for the dominant-element / modality readout. */
  balance: {
    elements: Record<Element, number>;
    modalities: Record<Modality, number>;
    hemispheres: { above: number; below: number; east: number; west: number };
  };
  /** Non-fatal issues worth surfacing to the user. */
  warnings: string[];
}
