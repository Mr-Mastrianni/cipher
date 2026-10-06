/**
 * KP lordship of a sidereal longitude: sign lord, star (nakshatra) lord, sub
 * lord and sub-sub lord.
 *
 * Each nakshatra (13°20′ = 48 000″) is divided into nine subs in Vimshottari
 * proportion, starting with the nakshatra's own lord: a sub of a graha with a
 * Y-year dasha is exactly 400·Y arcseconds wide. Each sub is divided again the
 * same way, starting with the sub lord, for the sub-sub lord.
 *
 * Because sign boundaries (every 30°) do not line up with nakshatra or sub
 * boundaries, six subs straddle a sign change; counting those halves
 * separately gives the classical 249-row KP sub table. Computing sign and sub
 * independently, as here, reproduces that table exactly.
 *
 * All arithmetic is done in arcseconds from a half-open `[start, end)` floor,
 * so a longitude exactly on a boundary belongs to the later division.
 */

import {
  DASHA_YEARS,
  NAKSHATRAS,
  NAKSHATRA_ARC,
  PADA_ARC,
  RASIS,
  VIMSHOTTARI_ORDER,
  VIMSHOTTARI_TOTAL_YEARS,
  type Graha,
  type Nakshatra,
  type Rasi,
} from "./constants";

const ARCSEC_PER_DEGREE = 3600;
const NAKSHATRA_ARCSEC = NAKSHATRA_ARC * ARCSEC_PER_DEGREE; // 48 000

export interface KpLords {
  /** Sidereal longitude in [0, 360). */
  longitude: number;
  rasi: Rasi;
  /** Degrees into the rasi, [0, 30). */
  rasiDegree: number;
  signLord: Graha;
  nakshatra: Nakshatra;
  /** 1–4. */
  pada: number;
  starLord: Graha;
  subLord: Graha;
  subSubLord: Graha;
  /**
   * Degrees to the nearest sub boundary (either side). Under ~0.004° (15″) the
   * sub lord can change with a few seconds of birth-time error.
   */
  toSubBoundary: number;
  /** Degrees to the nearest sub-sub boundary. */
  toSubSubBoundary: number;
}

export function normalizeDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Walk the Vimshottari sequence from `first` over a span, returning the slice containing `offset`. */
function divide(
  first: Graha,
  span: number,
  offset: number,
): { lord: Graha; start: number; width: number } {
  const startIndex = VIMSHOTTARI_ORDER.indexOf(first);
  let start = 0;
  for (let i = 0; i < 9; i += 1) {
    const lord = VIMSHOTTARI_ORDER[(startIndex + i) % 9];
    const width = (span * DASHA_YEARS[lord]) / VIMSHOTTARI_TOTAL_YEARS;
    if (offset < start + width || i === 8) return { lord, start, width };
    start += width;
  }
  /* c8 ignore next */
  throw new Error("unreachable");
}

/** Sign, star, sub and sub-sub lords of a sidereal longitude. */
export function kpLords(siderealLongitude: number): KpLords {
  const longitude = normalizeDegrees(siderealLongitude);
  const rasi = RASIS[Math.min(11, Math.floor(longitude / 30))];
  const nakshatraIndex = Math.min(26, Math.floor(longitude / NAKSHATRA_ARC));
  const nakshatra = NAKSHATRAS[nakshatraIndex];

  const inNakshatra = longitude * ARCSEC_PER_DEGREE - nakshatraIndex * NAKSHATRA_ARCSEC;
  const sub = divide(nakshatra.lord, NAKSHATRA_ARCSEC, inNakshatra);
  const inSub = inNakshatra - sub.start;
  const subSub = divide(sub.lord, sub.width, inSub);
  const inSubSub = inSub - subSub.start;

  return {
    longitude,
    rasi,
    rasiDegree: longitude - (rasi.index - 1) * 30,
    signLord: rasi.lord,
    nakshatra,
    pada: Math.min(4, Math.floor((longitude - nakshatraIndex * NAKSHATRA_ARC) / PADA_ARC) + 1),
    starLord: nakshatra.lord,
    subLord: sub.lord,
    subSubLord: subSub.lord,
    toSubBoundary: Math.min(inSub, sub.width - inSub) / ARCSEC_PER_DEGREE,
    toSubSubBoundary: Math.min(inSubSub, subSub.width - inSubSub) / ARCSEC_PER_DEGREE,
  };
}

/** Format a sidereal longitude within its rasi as `12°34′56″`. */
export function formatRasiDegree(longitude: number): string {
  const totalSeconds = Math.round(normalizeDegrees(longitude) * 3600) % (360 * 3600);
  const within = totalSeconds % (30 * 3600);
  const d = Math.floor(within / 3600);
  const m = Math.floor((within % 3600) / 60);
  const s = within % 60;
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
}

/**
 * The 249-row KP sub table, generated from first principles: every contiguous
 * stretch of the zodiac with one (sign lord, star lord, sub lord) triple.
 * Exposed for tests and for the reference table in the UI.
 */
let subTableCache: ReturnType<typeof buildSubTable> | null = null;

export function kpSubTable(): ReturnType<typeof buildSubTable> {
  subTableCache ??= buildSubTable();
  return subTableCache;
}

function buildSubTable(): Array<{
  number: number;
  start: number;
  end: number;
  signLord: Graha;
  starLord: Graha;
  subLord: Graha;
}> {
  const edges = new Set<number>();
  for (let n = 0; n < 27; n += 1) {
    const base = n * NAKSHATRA_ARCSEC;
    const startIndex = VIMSHOTTARI_ORDER.indexOf(NAKSHATRAS[n].lord);
    let cursor = 0;
    for (let i = 0; i < 9; i += 1) {
      edges.add(Math.round((base + cursor) * 1000) / 1000);
      cursor += (NAKSHATRA_ARCSEC * DASHA_YEARS[VIMSHOTTARI_ORDER[(startIndex + i) % 9]]) / 120;
    }
  }
  for (let s = 0; s < 12; s += 1) edges.add(s * 30 * ARCSEC_PER_DEGREE);
  const sorted = [...edges].sort((a, b) => a - b);
  return sorted.map((start, i) => {
    const end = sorted[i + 1] ?? 360 * ARCSEC_PER_DEGREE;
    const mid = kpLords((start + end) / 2 / ARCSEC_PER_DEGREE);
    return {
      number: i + 1,
      start: start / ARCSEC_PER_DEGREE,
      end: end / ARCSEC_PER_DEGREE,
      signLord: mid.signLord,
      starLord: mid.starLord,
      subLord: mid.subLord,
    };
  });
}
