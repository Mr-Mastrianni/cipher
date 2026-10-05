import type { AspectDefinition, PointKey } from "./types";

/** Astrological glyphs for the bodies and points. */
export const POINT_GLYPH: Readonly<Record<PointKey, string>> = {
  sun: "☉",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
  chiron: "⚷",
  northNode: "☊",
  southNode: "☋",
  lilith: "⚸",
  ascendant: "AC",
  midheaven: "MC",
  descendant: "DC",
  imumCoeli: "IC",
  vertex: "Vx",
};

/** Display names, in the order they should appear in a table. */
export const POINT_NAME: Readonly<Record<PointKey, string>> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  chiron: "Chiron",
  northNode: "North Node",
  southNode: "South Node",
  lilith: "Lilith",
  ascendant: "Ascendant",
  midheaven: "Midheaven",
  descendant: "Descendant",
  imumCoeli: "Imum Coeli",
  vertex: "Vertex",
};

/** Canonical ordering for the position table. */
export const POINT_ORDER: readonly PointKey[] = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
  "northNode",
  "southNode",
  "lilith",
  "ascendant",
  "midheaven",
  "descendant",
  "imumCoeli",
  "vertex",
] as const;

/** The ten bodies that matter for element/modality balance. */
export const BALANCE_BODIES: readonly PointKey[] = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;

/**
 * Colour for an aspect line. Major aspects read as structural, minor aspects as
 * texture — so they get different opacity and weight as well as different hue.
 */
export const ASPECT_COLOR: Readonly<Record<string, string>> = {
  conjunction: "var(--c-gold)",
  opposition: "var(--c-danger)",
  trine: "var(--c-teal)",
  square: "var(--c-rose)",
  sextile: "var(--c-purple)",
  quincunx: "var(--c-warn)",
  semisextile: "var(--c-info)",
  semisquare: "var(--c-earth)",
  sesquiquadrate: "var(--c-earth)",
  quintile: "var(--c-water)",
  biquintile: "var(--c-water)",
  decile: "var(--c-water)",
};

export function aspectColor(definition: AspectDefinition): string {
  return ASPECT_COLOR[definition.key] ?? "var(--c-line)";
}

/** Stroke weight for an aspect line, thinner for minor aspects. */
export function aspectWeight(definition: AspectDefinition): number {
  return definition.major ? 1.15 : 0.6;
}
