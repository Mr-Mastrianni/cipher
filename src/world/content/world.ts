/**
 * The Cipher, as a place.
 *
 * This is the single content spine of the 3D world. Every landmark, graha,
 * nakshatra, build piece, avatar option and learning station is declared here
 * and read by the engine; nothing in the geometry is content-hard-coded twice.
 *
 * The editorial line matches the rest of the site: the astronomy is astronomy,
 * the Human Design structure is fixed reference material, and the meanings
 * attached to a graha, a nakshatra or a centre are offered as tradition rather
 * than as prediction. The world is a room for the Collective to meet in, not a
 * claim that the sky obeys anyone.
 */

import {
  NAKSHATRAS as KP_NAKSHATRAS,
  RASIS,
  type Graha,
} from "@/lib/kp/constants";
import { CENTERS, type CenterKey } from "@/lib/human-design/constants";
import { COLLECTIVE_ROOMS } from "@/lib/community/rooms";

/* ────────────────────────────────────────────────────────────────────────────
 * Grahas
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GrahaMeta {
  id: Graha;
  /** The name used in the world. */
  name: string;
  sanskrit: string;
  glyph: string;
  css: string;
  color: number;
  /** Root of the drone the graha's stone sounds, Hz. */
  root: number;
  note: string;
}

export const GRAHAS: readonly GrahaMeta[] = [
  {
    id: "sun",
    name: "Sun",
    sanskrit: "Surya",
    glyph: "\u2609",
    css: "#ffcf6a",
    color: 0xffcf6a,
    root: 126.22,
    note: "The self the chart is read from. In KP the Sun is the soul's significator and the lord of the day the chart was cast.",
  },
  {
    id: "moon",
    name: "Moon",
    sanskrit: "Chandra",
    glyph: "\u263d",
    css: "#cfd8ff",
    color: 0xcfd8ff,
    root: 210.42,
    note: "The mind and the felt weather. The Moon moves about 13° a day, so it is the planet most altered by a birth time that is only nearly right.",
  },
  {
    id: "mars",
    name: "Mars",
    sanskrit: "Mangala",
    glyph: "\u2642",
    css: "#ff6a5c",
    color: 0xff6a5c,
    root: 144.0,
    note: "Effort, heat and the courage to begin. In the world it lights the Studio, where things are actually made.",
  },
  {
    id: "mercury",
    name: "Mercury",
    sanskrit: "Budha",
    glyph: "\u263f",
    css: "#5ce1e6",
    color: 0x5ce1e6,
    root: 141.27,
    note: "Language, counting and the hinge between people. Mercury is the natural significator of learning and of the Cipher's courses.",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    sanskrit: "Guru",
    glyph: "\u2643",
    css: "#dfc06a",
    color: 0xdfc06a,
    root: 183.58,
    note: "The teacher and the widening of a life. The Amphitheatre keeps a lamp for Guru, where members take the floor for one another.",
  },
  {
    id: "venus",
    name: "Venus",
    sanskrit: "Shukra",
    glyph: "\u2640",
    css: "#ff8fd1",
    color: 0xff8fd1,
    root: 221.23,
    note: "Attraction, art and the pleasure of company. Venus is the patron of the Commons, where the Collective simply meets.",
  },
  {
    id: "saturn",
    name: "Saturn",
    sanskrit: "Shani",
    glyph: "\u2644",
    css: "#9b9bbd",
    color: 0x9b9bbd,
    root: 147.85,
    note: "Time, limit and the slow work that compounds. Saturn is why the Terraces persist: a place you return to has to be built.",
  },
  {
    id: "rahu",
    name: "Rahu",
    sanskrit: "Rahu",
    glyph: "\u260a",
    css: "#a98bff",
    color: 0xa98bff,
    root: 110.0,
    note: "The eclipse point of appetite and the unfamiliar. Rahu is read as an agent of its sign lord, never as a planet on its own.",
  },
  {
    id: "ketu",
    name: "Ketu",
    sanskrit: "Ketu",
    glyph: "\u260b",
    css: "#8fe3b0",
    color: 0x8fe3b0,
    root: 98.0,
    note: "The eclipse point of release and what is already known. Ketu is the shadow that makes the light legible.",
  },
] as const;

export const GRAHA_BY_ID: ReadonlyMap<string, GrahaMeta> = new Map(
  GRAHAS.map((graha) => [graha.id, graha]),
);

/** Display size and extras for a graha in the Sky Wheel. */
export const GRAHA_LOOK: Record<string, { size: number; ring?: boolean; shadow?: boolean }> = {
  sun: { size: 15 },
  moon: { size: 5.2 },
  mars: { size: 4.2 },
  mercury: { size: 4.6 },
  jupiter: { size: 9.4, ring: true },
  venus: { size: 6.8 },
  saturn: { size: 8.2, ring: true },
  rahu: { size: 5.6, shadow: true },
  ketu: { size: 5, shadow: true },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Nakshatras and rasis
 * ──────────────────────────────────────────────────────────────────────────── */

export interface NakshatraMeta {
  index: number;
  name: string;
  lord: string;
  /** The nakshatra's ruling graha, as a world colour. */
  css: string;
}

/** 27 equal mansions of 13°20′, from 0° sidereal Aries. */
export const NAKSHATRAS: readonly NakshatraMeta[] = KP_NAKSHATRAS.map((nakshatra) => ({
  index: nakshatra.index,
  name: nakshatra.name,
  lord: nakshatra.lord,
  css: GRAHA_BY_ID.get(nakshatra.lord)?.css ?? "#d4ff3f",
}));

export const NAKSHATRA_ARC = 360 / 27;

export interface RasiMeta {
  index: number;
  name: string;
  glyph: string;
  lord: Graha;
}

const RASI_GLYPHS = ["\u2648", "\u2649", "\u264a", "\u264b", "\u264c", "\u264d", "\u264e", "\u264f", "\u2650", "\u2651", "\u2652", "\u2653"];

export const RASIS_META: readonly RasiMeta[] = RASIS.map((rasi) => ({
  index: rasi.index,
  name: rasi.english,
  glyph: RASI_GLYPHS[rasi.index - 1] ?? "",
  lord: rasi.lord,
}));

/* ────────────────────────────────────────────────────────────────────────────
 * Human Design centres
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CentreMeta {
  key: CenterKey;
  name: string;
  short: string;
  kind: string;
  biology: string;
  css: string;
  note: string;
}

const CENTRE_COLOR: Record<CenterKey, string> = {
  head: "#e9d76a",
  ajna: "#5ce1e6",
  throat: "#b45cff",
  g: "#d4ff3f",
  heart: "#ff5c8a",
  spleen: "#9bdc5c",
  solar: "#ffb15c",
  sacral: "#ff6a4d",
  root: "#8f9bb3",
};

const CENTRE_NOTE: Record<CenterKey, string> = {
  head: "Pressure to make sense of things. Defined or open, it is a way of holding questions.",
  ajna: "The conceptual mind: how a person turns a question into a shape.",
  throat: "Expression and manifestation. What is said and what is made pass through here.",
  g: "Identity and direction. The G Centre is the still point the rest of the chart turns around.",
  heart: "Will, value and the promise to do a thing. A motor, and a small one.",
  spleen: "Intuition and the quiet signal that keeps a body well. It speaks once.",
  solar: "Emotional wave and clarity over time. The most common authority in the charts Cipher casts.",
  sacral: "Response and sustained work. The motor that answers yes or no before the mind does.",
  root: "Pressure and the fuel underneath everything. Adrenaline, and the drive to begin.",
};

export const CENTRES: readonly CentreMeta[] = CENTERS.map((centre) => ({
  key: centre.key,
  name: centre.name,
  short: centre.short,
  kind: centre.kind,
  biology: centre.biology,
  css: CENTRE_COLOR[centre.key],
  note: CENTRE_NOTE[centre.key],
}));

export const CENTRE_BY_KEY: ReadonlyMap<CenterKey, CentreMeta> = new Map(
  CENTRES.map((centre) => [centre.key, centre]),
);

/* ────────────────────────────────────────────────────────────────────────────
 * Places
 * ──────────────────────────────────────────────────────────────────────────── */

export type PlaceId =
  | "axis"
  | "observatory"
  | "amphitheatre"
  | "studio"
  | "sanctuary"
  | "terraces"
  | "commons"
  | "lake"
  | "skygate"
  | "space";

export type InteractKind =
  | "axis"
  | "observatory"
  | "amphitheatre"
  | "studio"
  | "sanctuary"
  | "terraces"
  | "commons"
  | "lake"
  | "skygate"
  | "graha"
  | "nakshatra"
  | "centre"
  | "plot";

export interface Place {
  id: PlaceId;
  name: string;
  kicker: string;
  blurb: string;
  /** Ground position. `y` is only used for the flown place. */
  x: number;
  z: number;
  y?: number;
  /** Radius of the interaction bubble. */
  radius: number;
  css: string;
  color: number;
  /** The key a member presses, phrased for the HUD. */
  action: string;
}

export const PLACES: readonly Place[] = [
  {
    id: "axis",
    name: "The Axis",
    kicker: "The centre of the world",
    blurb:
      "An engraved wheel of the twenty-seven mansions, nine graha stones, and the Meridian. Every path in the Cipher begins here.",
    x: 0,
    z: -6,
    radius: 30,
    css: "#d4ff3f",
    color: 0xd4ff3f,
    action: "Read the Axis",
  },
  {
    id: "observatory",
    name: "The Observatory",
    kicker: "Your chart, above the floor",
    blurb:
      "A domed hall over a still basin. Your KP chart is cast as an astrolabe of light, with the grahas at their true sidereal longitudes and the bodygraph beside it.",
    x: 0,
    z: -150,
    radius: 26,
    css: "#5ce1e6",
    color: 0x5ce1e6,
    action: "Open your chart",
  },
  {
    id: "amphitheatre",
    name: "The Amphitheatre",
    kicker: "Where members teach one another",
    blurb:
      "Tiered stone around a speaking floor. Take the floor to start a live session; everyone in the world sees it and can walk over, or join in a click.",
    x: -148,
    z: 28,
    radius: 30,
    css: "#dfc06a",
    color: 0xdfc06a,
    action: "Take the floor",
  },
  {
    id: "studio",
    name: "The Studio",
    kicker: "Co-creation, in the open",
    blurb:
      "A lit grid of plinths under an open sky. Ten pieces, eight materials, placed by anyone in the room and shared the instant they land.",
    x: 150,
    z: 36,
    radius: 34,
    css: "#ff6a5c",
    color: 0xff6a5c,
    action: "Open the bench",
  },
  {
    id: "sanctuary",
    name: "The Sanctuary",
    kicker: "Sound, breath, and the slower work",
    blurb:
      "A ring of tuning stones above the shore. Each graha has a root tone; standing close to a stone lets the valley sing it. Nothing is promised from hearing one.",
    x: 122,
    z: -166,
    radius: 26,
    css: "#a98bff",
    color: 0xa98bff,
    action: "Attune",
  },
  {
    id: "terraces",
    name: "The Terraces",
    kicker: "A place of your own",
    blurb:
      "Twelve plots cut into the western rise, each with a pedestal, a banner and a beacon. Claim one, name it, colour it, and build inside it. It persists.",
    x: -188,
    z: -36,
    radius: 42,
    css: "#ff8fd1",
    color: 0xff8fd1,
    action: "Claim a plot",
  },
  {
    id: "commons",
    name: "The Commons",
    kicker: "The Collective, in pavilions",
    blurb:
      "Eight pavilions, one for each room of the Starseed Collective. Walk up to a banner and the room's conversation opens beside you.",
    x: 0,
    z: 136,
    radius: 62,
    css: "#5ce1a0",
    color: 0x5ce1a0,
    action: "Open the room",
  },
  {
    id: "lake",
    name: "The Lake of Mirrors",
    kicker: "Still water under a moving sky",
    blurb:
      "A real basin in the terrain, not a blue disc. The far shore holds a single stone; the sky is doubled on the water at dusk.",
    x: -252,
    z: 138,
    radius: 40,
    css: "#8fe3ff",
    color: 0x8fe3ff,
    action: "Look out",
  },
  {
    id: "skygate",
    name: "The Sky Gate",
    kicker: "The instruction is literal",
    blurb:
      "A ringed gate on the northern rise. Stand in it, hold Space to gather the body, then press F. The wheel is at 1,800 metres and there is no floor there.",
    x: 0,
    z: -268,
    radius: 16,
    css: "#e9d76a",
    color: 0xe9d76a,
    action: "Open the gate",
  },
  {
    id: "space",
    name: "The Sky Wheel",
    kicker: "1,800 metres · no floor",
    blurb:
      "The nine grahas on the nakshatra ring at their true sidereal longitudes, inside the mansions they actually occupy. Meru is the axis. Fly it.",
    x: 0,
    z: 0,
    y: 1800,
    radius: 120,
    css: "#cfd8ff",
    color: 0xcfd8ff,
    action: "Read the wheel",
  },
] as const;

export const PLACE_BY_ID: ReadonlyMap<PlaceId, Place> = new Map(
  PLACES.map((place) => [place.id, place]),
);

/* ────────────────────────────────────────────────────────────────────────────
 * Collective pavilions
 * ──────────────────────────────────────────────────────────────────────────── */

export interface Pavilion {
  slug: string;
  name: string;
  description: string;
  x: number;
  z: number;
  css: string;
  tierRequired: string | null;
}

const PAVILION_COLOR = [
  "#5ce1a0",
  "#a98bff",
  "#5ce1e6",
  "#ffcf6a",
  "#ff8fd1",
  "#ff6a5c",
  "#d4ff3f",
  "#8fe3ff",
];

/** Eight pavilions in a shallow arc south of the Axis. */
export const PAVILIONS: readonly Pavilion[] = COLLECTIVE_ROOMS.map((room, index) => {
  const offset = index - (COLLECTIVE_ROOMS.length - 1) / 2;
  return {
    slug: room.slug,
    name: room.name,
    description: room.description,
    x: offset * 20,
    z: 140 + Math.abs(offset) * 4,
    css: PAVILION_COLOR[index % PAVILION_COLOR.length],
    tierRequired: room.tierRequired,
  };
});

/* ────────────────────────────────────────────────────────────────────────────
 * Terraces — member plots
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PlotSeed {
  index: number;
  x: number;
  z: number;
  /** Rotation of the banner toward the Axis. */
  ry: number;
}

/** Twelve plots around the terrace, each banner facing the centre. */
export const PLOTS: readonly PlotSeed[] = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
  const radius = 26;
  return {
    index,
    x: -188 + Math.cos(angle) * radius,
    z: -36 + Math.sin(angle) * radius,
    // Local +Z must point back at the centre.
    ry: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
  };
});

/** A plot may hold this many pieces; the Studio is unbounded up to the room cap. */
export const PLOT_PIECE_LIMIT = 24;

/* ────────────────────────────────────────────────────────────────────────────
 * Build palette
 * ──────────────────────────────────────────────────────────────────────────── */

export type BuildShape = "box" | "cylinder" | "octa" | "torus" | "arch" | "stair";

export interface BuildPieceType {
  id: string;
  name: string;
  /** Half-extents in metres: [x, y, z]. */
  size: [number, number, number];
  shape: BuildShape;
  glyph: string;
  note: string;
}

export const BUILD_PIECES: readonly BuildPieceType[] = [
  { id: "plinth", name: "Plinth", size: [0.9, 0.22, 0.9], shape: "box", glyph: "\u25a7", note: "A low block: a step, a seat, a foundation." },
  { id: "pillar", name: "Pillar", size: [0.3, 1.8, 0.3], shape: "cylinder", glyph: "\u2502", note: "Vertical line. Build in rows for a colonnade." },
  { id: "arch", name: "Gate", size: [1.1, 1.5, 0.28], shape: "arch", glyph: "\u2229", note: "Two legs and a lintel. A door you can walk through." },
  { id: "wall", name: "Wall", size: [1.4, 0.75, 0.16], shape: "box", glyph: "\u25ac", note: "The plain enclosure. Turn it to make a room." },
  { id: "orb", name: "Orb", size: [0.5, 0.5, 0.5], shape: "octa", glyph: "\u25c6", note: "A faceted light. The one piece that glows in every material." },
  { id: "ring", name: "Ring", size: [0.9, 0.16, 0.9], shape: "torus", glyph: "\u25cb", note: "A circle laid flat. A boundary, or a place to stand." },
  { id: "stair", name: "Stair", size: [1.0, 0.16, 0.5], shape: "stair", glyph: "\u2261", note: "A shallow step. Stack and rotate them to climb." },
  { id: "banner", name: "Banner", size: [0.5, 1.4, 0.06], shape: "box", glyph: "\u2691", note: "A tall thin plane. Mark a place as yours." },
  { id: "prism", name: "Prism", size: [0.6, 0.9, 0.6], shape: "box", glyph: "\u25b3", note: "A tall block. Rotate it 45° for a diamond." },
  { id: "altar", name: "Altar", size: [0.8, 0.5, 0.5], shape: "stair", glyph: "\u25a4", note: "A two-step altar. Put an orb on it." },
] as const;

export interface BuildMaterial {
  id: string;
  name: string;
  color: number;
  css: string;
  roughness: number;
  metalness: number;
  emissive: number;
  emissiveIntensity: number;
  note: string;
}

export const BUILD_MATERIALS: readonly BuildMaterial[] = [
  { id: "cipher", name: "Cipher stone", color: 0xc9c2e8, css: "#c9c2e8", roughness: 0.82, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0, note: "Pale stone with a violet cast, cut from the valley." },
  { id: "basalt", name: "Basalt", color: 0x2b2733, css: "#2b2733", roughness: 0.95, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0, note: "Dark volcanic rock. Reads as silhouette at dusk." },
  { id: "gold", name: "Electrum", color: 0xd4b25e, css: "#d4b25e", roughness: 0.24, metalness: 1, emissive: 0x2a1f08, emissiveIntensity: 0.4, note: "The Axis metal. Warm without being bright." },
  { id: "verdigris", name: "Verdigris", color: 0x4e9b86, css: "#4e9b86", roughness: 0.42, metalness: 0.7, emissive: 0x061a15, emissiveIntensity: 0.3, note: "Oxidised copper, the colour of the lake in shade." },
  { id: "violet", name: "Violet glass", color: 0x8a5cff, css: "#8a5cff", roughness: 0.12, metalness: 0.2, emissive: 0x24105e, emissiveIntensity: 0.9, note: "Translucent in spirit, solid in geometry. Catches the bloom." },
  { id: "lime", name: "Signal lime", color: 0xd4ff3f, css: "#d4ff3f", roughness: 0.3, metalness: 0.3, emissive: 0x5a7a00, emissiveIntensity: 1.4, note: "The Cipher accent, lit from inside. Use it sparingly." },
  { id: "bone", name: "Bone", color: 0xf0ead9, css: "#f0ead9", roughness: 0.7, metalness: 0.04, emissive: 0x000000, emissiveIntensity: 0, note: "Warm white. The default for anything meant to be read." },
  { id: "obsidian", name: "Obsidian", color: 0x0b0a12, css: "#0b0a12", roughness: 0.18, metalness: 0.55, emissive: 0x000000, emissiveIntensity: 0, note: "Black glass. Reflects the sky and disappears at night." },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Avatars
 * ──────────────────────────────────────────────────────────────────────────── */

export type AvatarForm = "cloak" | "orb" | "wanderer";

export interface AvatarFormMeta {
  id: AvatarForm;
  name: string;
  blurb: string;
}

export const AVATAR_FORMS: readonly AvatarFormMeta[] = [
  { id: "cloak", name: "The Cloaked", blurb: "A travelling cloak with a coloured hem. Quiet, and readable against the valley." },
  { id: "orb", name: "The Luminous", blurb: "A faceted core inside two rings. You are a small sky that moves." },
  { id: "wanderer", name: "The Wanderer", blurb: "A robed figure with a staff. The oldest shape a person takes in a new place." },
] as const;

export const AVATAR_COLORS: readonly { css: string; name: string }[] = [
  { css: "#d4ff3f", name: "Signal" },
  { css: "#5ce1e6", name: "Cyan" },
  { css: "#b45cff", name: "Violet" },
  { css: "#ff8fd1", name: "Rose" },
  { css: "#dfc06a", name: "Electrum" },
  { css: "#8fe3b0", name: "Verdant" },
  { css: "#ff6a5c", name: "Ember" },
  { css: "#cfd8ff", name: "Moonlight" },
  { css: "#f0ead9", name: "Bone" },
  { css: "#8f9bb3", name: "Steel" },
] as const;

export const AVATAR_CRESTS: readonly { glyph: string; name: string }[] = [
  { glyph: "\u2609", name: "Sun" },
  { glyph: "\u263d", name: "Moon" },
  { glyph: "\u2642", name: "Mars" },
  { glyph: "\u263f", name: "Mercury" },
  { glyph: "\u2643", name: "Jupiter" },
  { glyph: "\u2640", name: "Venus" },
  { glyph: "\u2644", name: "Saturn" },
  { glyph: "\u260a", name: "Rahu" },
  { glyph: "\u260b", name: "Ketu" },
  { glyph: "\u2726", name: "Star" },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Learning
 * ──────────────────────────────────────────────────────────────────────────── */

export interface LearningTrack {
  id: string;
  title: string;
  kicker: string;
  blurb: string;
  bullets: readonly string[];
  href: string;
  /** Place whose interaction opens this track. */
  place: PlaceId;
  css: string;
  minutes: number;
}

/**
 * Six doors into the material the site already carries. The world does not
 * re-teach the courses; it gives a body somewhere to stand while it does.
 */
export const LEARNING_TRACKS: readonly LearningTrack[] = [
  {
    id: "kp-foundations",
    title: "The KP method",
    kicker: "Course · foundation",
    blurb:
      "Why a cusp, a star lord and a sub lord are a different instrument from a Western chart — and why the exact second is not optional.",
    bullets: [
      "The KP ayanamsa, and why the sidereal frame matters.",
      "Sub lords: the 249-row table, and how a yes or no is actually read.",
      "What a one-minute birth-time error moves, and what it leaves alone.",
    ],
    href: "/dashboard/courses/kp-foundations",
    place: "observatory",
    css: "#5ce1e6",
    minutes: 42,
  },
  {
    id: "bodygraph",
    title: "The bodygraph",
    kicker: "Course · foundation",
    blurb:
      "Nine centres, thirty-six channels, twenty-six activations. The bodygraph is a circuit diagram of a person, not a personality test.",
    bullets: [
      "Type, authority and definition, read from the centres.",
      "Design is 88° of solar arc, not 88 days.",
      "Why an open centre is a place to learn, not a defect.",
    ],
    href: "/dashboard/courses/human-design-foundations",
    place: "axis",
    css: "#b45cff",
    minutes: 38,
  },
  {
    id: "prashna",
    title: "The Prashna Well",
    kicker: "Practice · horary",
    blurb:
      "A question is cast at the moment it is asked. Bring a real one, note the second, and judge it with the ruling planets together.",
    bullets: [
      "The moment of the question, to the second.",
      "Ruling planets, and why the Moon's star lord leads.",
      "What horary can answer, and what it cannot.",
    ],
    href: "/dashboard/horary",
    place: "commons",
    css: "#dfc06a",
    minutes: 25,
  },
  {
    id: "lines-and-places",
    title: "Lines & places",
    kicker: "Practice · astrocartography",
    blurb:
      "Your chart is also a map. Rising, setting, culminating and nadir lines for each graha, and what it is like to stand on one.",
    bullets: [
      "The four angles, drawn from right ascension and declination.",
      "Relocation: the same instant, a different horizon.",
      "A travel note is evidence, not proof.",
    ],
    href: "/dashboard/map",
    place: "lake",
    css: "#8fe3ff",
    minutes: 20,
  },
  {
    id: "starseed-archive",
    title: "The Starseed Archive",
    kicker: "Story · the Collective",
    blurb:
      "Where members feel they come from, told as story and held without doctrine. The archive is written by the people in it.",
    bullets: [
      "Origins as narrative, not genealogy.",
      "How to listen to a story you do not share.",
      "Add your own entry in the 2D Commons.",
    ],
    href: "/dashboard/community/starseed-origins",
    place: "terraces",
    css: "#ff8fd1",
    minutes: 15,
  },
  {
    id: "signal-studio",
    title: "The Signal Studio",
    kicker: "Craft · making",
    blurb:
      "Creative work made from a chart: a practice, a business, a body of work. The Studio is where the making happens; this is the method.",
    bullets: [
      "Find the craft in the definition, not the labels.",
      "Ship something small this week.",
      "Teach one thing you learned to one person.",
    ],
    href: "/dashboard/courses/signal-and-transmission",
    place: "studio",
    css: "#ff6a5c",
    minutes: 30,
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Regions, for the HUD
 * ──────────────────────────────────────────────────────────────────────────── */

export interface Region {
  id: PlaceId;
  title: string;
  sub: string;
  x: number;
  z: number;
  radius: number;
}

export const REGIONS: readonly Region[] = [
  { id: "axis", title: "The Axis", sub: "the centre of the Cipher", x: 0, z: 0, radius: 62 },
  { id: "observatory", title: "The Observatory", sub: "your chart, above the floor", x: 0, z: -150, radius: 44 },
  { id: "amphitheatre", title: "The Amphitheatre", sub: "where members teach one another", x: -148, z: 28, radius: 48 },
  { id: "studio", title: "The Studio", sub: "co-creation, in the open", x: 150, z: 36, radius: 50 },
  { id: "sanctuary", title: "The Sanctuary", sub: "sound, breath, and the slower work", x: 122, z: -166, radius: 36 },
  { id: "terraces", title: "The Terraces", sub: "a place of your own", x: -188, z: -36, radius: 56 },
  { id: "commons", title: "The Commons", sub: "the Collective, in pavilions", x: 0, z: 136, radius: 74 },
  { id: "lake", title: "The Lake of Mirrors", sub: "still water under a moving sky", x: -252, z: 138, radius: 70 },
  { id: "skygate", title: "The Sky Gate", sub: "hold Space, then F", x: 0, z: -268, radius: 34 },
  { id: "space", title: "The Sky Wheel", sub: "1,800 metres · no floor", x: 0, z: 0, radius: 900 },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Help
 * ──────────────────────────────────────────────────────────────────────────── */

export const CONTROLS: readonly { keys: string; what: string }[] = [
  { keys: "W A S D", what: "walk" },
  { keys: "Shift", what: "run" },
  { keys: "Space", what: "jump · four times before landing" },
  { keys: "Mouse", what: "look (click to capture)" },
  { keys: "F", what: "fly / land" },
  { keys: "Space / Ctrl", what: "climb / descend while flying" },
  { keys: "E", what: "use what is in front of you" },
  { keys: "B", what: "build mode" },
  { keys: "1–9, 0", what: "choose a piece" },
  { keys: "[ ]", what: "material" },
  { keys: "R", what: "rotate 15°" },
  { keys: "Wheel", what: "scale (build mode)" },
  { keys: "LMB / RMB", what: "place / remove a piece" },
  { keys: "Q", what: "send a signal" },
  { keys: "V", what: "first / third person" },
  { keys: "T", what: "talk" },
  { keys: "J", what: "the Codex" },
  { keys: "Tab", what: "the Atlas" },
  { keys: "P", what: "photo mode" },
  { keys: "Esc", what: "close a panel, or pause" },
  { keys: "Arrow keys", what: "look when the pointer cannot be captured" },
] as const;

export const CODEX_TABS = [
  { id: "grahas", label: "Grahas" },
  { id: "nakshatras", label: "Nakshatras" },
  { id: "centres", label: "Centres" },
  { id: "places", label: "Places" },
  { id: "controls", label: "Controls" },
] as const;

export type CodexTab = (typeof CODEX_TABS)[number]["id"];


/* ────────────────────────────────────────────────────────────────────────────
 * Attunements — the stones that sound
 * ──────────────────────────────────────────────────────────────────────────── */

export interface Attunement {
  id: string;
  title: string;
  /** The utterance the formant voice sings. A graha name, not a spell. */
  mantra: string;
  transliteration: string;
  meaning: string;
  tradition: string;
  note: string;
  x: number;
  z: number;
  y?: number;
  color: number;
  css: string;
  root: number;
  syllables: string[];
  space?: boolean;
}

/**
 * The Sanctuary is a ring of nine graha stones; the Axis keeps one older stone.
 * Each sounds its own name through the procedural formant choir. The names are
 * Sanskrit names of the grahas, offered as sound and as tradition; no outcome is
 * promised from hearing one.
 */
export const ATTUNEMENTS: readonly Attunement[] = [
  {
    id: "axis-om",
    title: "The Still Point",
    mantra: "O\u1e43",
    transliteration: "Om",
    meaning: "The sound before speech; the whole of what is, held in one syllable.",
    tradition: "Vedic / Hindu",
    note: "The Axis keeps it. Stand at the centre and the stone hums it back.",
    x: 0,
    z: -18,
    color: 0xd4ff3f,
    css: "#d4ff3f",
    root: 110,
    syllables: ["o", "m"],
  },
  ...GRAHAS.map((graha, index) => {
    const angle = (index / GRAHAS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: `graha-${graha.id}`,
      title: `${graha.sanskrit} \u00b7 ${graha.name}`,
      mantra: graha.sanskrit,
      transliteration: graha.sanskrit,
      meaning: graha.note,
      tradition: "Jyotish",
      note: `The ${graha.name} stone in the Sanctuary ring. Each graha has a root tone; the choir sings the Sanskrit name around it.`,
      x: 122 + Math.cos(angle) * 15,
      z: -166 + Math.sin(angle) * 15,
      color: graha.color,
      css: graha.css,
      root: graha.root,
      syllables: graha.sanskrit.toLowerCase().split(""),
    };
  }),
  {
    id: "lake-soham",
    title: "The Lake Stone",
    mantra: "So Ham",
    transliteration: "So Ham",
    meaning: "\"That I am\" \u2014 the breath's own sentence, heard on the inhale and the exhale.",
    tradition: "Vedic / yogic",
    note: "On still evenings the lake returns it a half-beat late. The stone is on the far shore.",
    x: -228,
    z: 150,
    color: 0x8fe3ff,
    css: "#8fe3ff",
    root: 98,
    syllables: ["so", "ha", "m"],
  },
];
