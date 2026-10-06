/**
 * Human Design — canonical reference data.
 *
 * These are the standard, published structural facts of the Human Design
 * system (the Rave Mandala gate order, the gate→centre mapping, and the 36
 * channels). They are pure structural data, identical on every bodygraph ever
 * printed, and independent of any particular calculator's editorialising.
 *
 * Accuracy notes:
 *  - `WHEEL_START_DEGREES` is the ecliptic longitude at which Gate 41 Line 1
 *    begins: 302.0°, which is exactly 2°00'00" Aquarius in the tropical zodiac.
 *    Every gate is 5.625° wide and every line is 0.9375°.
 *  - The zodiac is *tropical* (seasonal), not sidereal. Using a sidereal zodiac
 *    is the single most common way a bodygraph comes out wrong.
 *  - Lunar nodes must be the **true** node, not the mean node.
 */

/** Ecliptic longitude where Gate 41 begins, in degrees. 302° = 2° Aquarius. */
export const WHEEL_START_DEGREES = 302;

/** Width of one gate: 360 / 64. */
export const GATE_ARC = 360 / 64; // 5.625

/** Width of one line: 5.625 / 6. */
export const LINE_ARC = GATE_ARC / 6; // 0.9375

/** Width of one colour: 0.9375 / 6. */
export const COLOR_ARC = LINE_ARC / 6; // 0.15625

/** Width of one tone: 0.15625 / 6. */
export const TONE_ARC = COLOR_ARC / 6; // 0.0260416…

/** Width of one base: 0.0260416… / 5. */
export const BASE_ARC = TONE_ARC / 5; // 0.00520833…

/**
 * The 64 gates in zodiacal order, beginning with Gate 41 at 302°.
 * Index 0 spans 302.000°–307.625°, index 1 spans 307.625°–313.250°, and so on.
 */
export const GATE_WHEEL: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23,
  8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64,
  47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58,
  38, 54, 61, 60,
] as const;

/** The nine energy centres. */
export type CenterKey =
  | "head"
  | "ajna"
  | "throat"
  | "g"
  | "heart"
  | "spleen"
  | "solar"
  | "sacral"
  | "root";

export interface CenterMeta {
  key: CenterKey;
  name: string;
  /** Short label used in dense UI. */
  short: string;
  /** Which class of centre this is. */
  kind: "pressure" | "awareness" | "expression" | "motor" | "identity";
  /** Biological correlation, as taught in the system. */
  biology: string;
}

export const CENTERS: readonly CenterMeta[] = [
  {
    key: "head",
    name: "Head",
    short: "Head",
    kind: "pressure",
    biology: "Pineal gland",
  },
  {
    key: "ajna",
    name: "Ajna",
    short: "Ajna",
    kind: "awareness",
    biology: "Pituitary gland",
  },
  {
    key: "throat",
    name: "Throat",
    short: "Throat",
    kind: "expression",
    biology: "Thyroid and parathyroid",
  },
  {
    key: "g",
    name: "G Center",
    short: "G",
    kind: "identity",
    biology: "Liver and blood",
  },
  {
    key: "heart",
    name: "Heart",
    short: "Heart",
    kind: "motor",
    biology: "Heart, stomach, and gall bladder",
  },
  {
    key: "spleen",
    name: "Spleen",
    short: "Spleen",
    kind: "awareness",
    biology: "Spleen and lymphatic system",
  },
  {
    key: "solar",
    name: "Solar Plexus",
    short: "Solar",
    kind: "motor",
    biology: "Kidneys, prostate, and pancreas",
  },
  {
    key: "sacral",
    name: "Sacral",
    short: "Sacral",
    kind: "motor",
    biology: "Ovaries and testes",
  },
  {
    key: "root",
    name: "Root",
    short: "Root",
    kind: "pressure",
    biology: "Adrenal glands",
  },
] as const;

export const CENTER_MAP: Readonly<Record<CenterKey, CenterMeta>> =
  Object.fromEntries(CENTERS.map((c) => [c.key, c])) as Record<
    CenterKey,
    CenterMeta
  >;

/** The four motor centres. A motor wired to the Throat is what makes a Manifestor. */
export const MOTOR_CENTERS: readonly CenterKey[] = [
  "sacral",
  "heart",
  "solar",
  "root",
] as const;

/** Gate → centre. Every gate belongs to exactly one centre. */
export const GATE_TO_CENTER: Readonly<Record<number, CenterKey>> = {
  1: "g",
  2: "g",
  3: "sacral",
  4: "ajna",
  5: "sacral",
  6: "solar",
  7: "g",
  8: "throat",
  9: "sacral",
  10: "g",
  11: "ajna",
  12: "throat",
  13: "g",
  14: "sacral",
  15: "g",
  16: "throat",
  17: "ajna",
  18: "spleen",
  19: "root",
  20: "throat",
  21: "heart",
  22: "solar",
  23: "throat",
  24: "ajna",
  25: "g",
  26: "heart",
  27: "sacral",
  28: "spleen",
  29: "sacral",
  30: "solar",
  31: "throat",
  32: "spleen",
  33: "throat",
  34: "sacral",
  35: "throat",
  36: "solar",
  37: "solar",
  38: "root",
  39: "root",
  40: "heart",
  41: "root",
  42: "sacral",
  43: "ajna",
  44: "spleen",
  45: "throat",
  46: "g",
  47: "ajna",
  48: "spleen",
  49: "solar",
  50: "spleen",
  51: "heart",
  52: "root",
  53: "root",
  54: "root",
  55: "solar",
  56: "throat",
  57: "spleen",
  58: "root",
  59: "sacral",
  60: "root",
  61: "head",
  62: "throat",
  63: "head",
  64: "head",
} as const;

/** Gates grouped by the centre they belong to. Derived, so it can never drift. */
export const CENTER_TO_GATES: Readonly<Record<CenterKey, readonly number[]>> =
  CENTERS.reduce(
    (acc, centre) => {
      acc[centre.key] = Object.entries(GATE_TO_CENTER)
        .filter(([, c]) => c === centre.key)
        .map(([g]) => Number(g))
        .sort((a, b) => a - b);
      return acc;
    },
    {} as Record<CenterKey, number[]>,
  );

export interface ChannelMeta {
  /** Canonical order: lower gate first. */
  gates: readonly [number, number];
  name: string;
  /** Centre the channel connects from. */
  from: CenterKey;
  /** Centre the channel connects to. */
  to: CenterKey;
  circuit: "individual" | "tribal" | "collective";
  subcircuit: string;
  /** A one-line statement of what the channel does. */
  theme: string;
}

/**
 * The 36 channels — the complete set. A channel is *defined* only when both of
 * its gates carry an activation; a single activated gate is a "hanging gate".
 */
export const CHANNELS: readonly ChannelMeta[] = [
  // ── Individual ──────────────────────────────────────────────────────────
  { gates: [1, 8], name: "Inspiration", from: "g", to: "throat", circuit: "individual", subcircuit: "Knowing", theme: "Creative self-expression that models a new way simply by being it." },
  { gates: [2, 14], name: "The Beat", from: "g", to: "sacral", circuit: "individual", subcircuit: "Knowing", theme: "Direction and resources pointed at a destiny only you can see." },
  { gates: [3, 60], name: "Mutation", from: "sacral", to: "root", circuit: "individual", subcircuit: "Knowing", theme: "Melancholy that mutates into something the world has not had yet." },
  { gates: [4, 63], name: "Logic", from: "ajna", to: "head", circuit: "collective", subcircuit: "Logic", theme: "Pressure to make sense of things, and the doubt that keeps it honest." },
  { gates: [5, 15], name: "Rhythm", from: "sacral", to: "g", circuit: "collective", subcircuit: "Logic", theme: "Your own timing, which is neither early nor late but exactly yours." },
  { gates: [6, 59], name: "Mating", from: "solar", to: "sacral", circuit: "tribal", subcircuit: "Defense", theme: "Intimacy as a reproductive force that dissolves the barriers between people." },
  { gates: [7, 31], name: "The Alpha", from: "g", to: "throat", circuit: "collective", subcircuit: "Logic", theme: "Leadership that is conferred by a group rather than claimed by a person." },
  { gates: [9, 52], name: "Concentration", from: "sacral", to: "root", circuit: "collective", subcircuit: "Logic", theme: "Stillness and focus — the capacity to stay with one thing." },
  { gates: [10, 20], name: "Awakening", from: "g", to: "throat", circuit: "individual", subcircuit: "Integration", theme: "Living your own truth out loud, on the spot, without rehearsal." },
  { gates: [10, 34], name: "Exploration", from: "g", to: "sacral", circuit: "individual", subcircuit: "Centering", theme: "Following an inner conviction into action that needs no permission." },
  { gates: [10, 57], name: "Perfected Form", from: "g", to: "spleen", circuit: "individual", subcircuit: "Integration", theme: "Survival instinct made beautiful — the body knowing before the mind does." },
  { gates: [20, 34], name: "Charisma", from: "throat", to: "sacral", circuit: "individual", subcircuit: "Integration", theme: "Busyness that is genuinely productive, and undeniably magnetic." },
  { gates: [20, 57], name: "The Brain Wave", from: "throat", to: "spleen", circuit: "individual", subcircuit: "Integration", theme: "Splenic awareness that speaks the truth the instant it sees it." },
  { gates: [23, 43], name: "Structuring", from: "throat", to: "ajna", circuit: "individual", subcircuit: "Knowing", theme: "Individual insight turned into language other people can actually use." },
  { gates: [24, 61], name: "Awareness", from: "ajna", to: "head", circuit: "individual", subcircuit: "Knowing", theme: "Inspiration that arrives without warning and demands to be thought about." },
  { gates: [25, 51], name: "Initiation", from: "g", to: "heart", circuit: "individual", subcircuit: "Centering", theme: "The shock that pushes you into your own authority in order to be tested." },
  { gates: [28, 38], name: "Struggle", from: "spleen", to: "root", circuit: "individual", subcircuit: "Knowing", theme: "Fighting for meaning when the fight is genuinely worth having." },
  { gates: [34, 57], name: "Power", from: "sacral", to: "spleen", circuit: "individual", subcircuit: "Integration", theme: "Raw vital force that is only wise when the body says yes." },
  { gates: [39, 55], name: "Emoting", from: "root", to: "solar", circuit: "individual", subcircuit: "Knowing", theme: "Melancholy that becomes creative spirit when the mood is honoured." },
  { gates: [12, 22], name: "Openness", from: "throat", to: "solar", circuit: "individual", subcircuit: "Knowing", theme: "Social grace that only works when the mood is genuinely right." },

  // ── Tribal ──────────────────────────────────────────────────────────────
  { gates: [21, 45], name: "Money", from: "heart", to: "throat", circuit: "tribal", subcircuit: "Ego", theme: "Material stewardship — resources held for the good of the whole." },
  { gates: [26, 44], name: "Surrender", from: "heart", to: "spleen", circuit: "tribal", subcircuit: "Ego", theme: "Instinct for the deal — remembering who can help, and who to help." },
  { gates: [27, 50], name: "Preservation", from: "sacral", to: "spleen", circuit: "tribal", subcircuit: "Defense", theme: "Custodianship: care for the tribe that also cares for you." },
  { gates: [32, 54], name: "Transformation", from: "spleen", to: "root", circuit: "tribal", subcircuit: "Ego", theme: "Ambition that raises the tribe, or is consumed by it." },
  { gates: [37, 40], name: "Community", from: "solar", to: "heart", circuit: "tribal", subcircuit: "Ego", theme: "Belonging held together by agreements that are actually kept." },
  { gates: [19, 49], name: "Synthesis", from: "root", to: "solar", circuit: "tribal", subcircuit: "Ego", theme: "Principles about who is taken in and who is turned away." },

  // ── Collective ──────────────────────────────────────────────────────────
  { gates: [11, 56], name: "Curiosity", from: "ajna", to: "throat", circuit: "collective", subcircuit: "Abstract", theme: "Storytelling that turns ideas into something people can feel." },
  { gates: [13, 33], name: "The Prodigal", from: "g", to: "throat", circuit: "collective", subcircuit: "Abstract", theme: "Keeping the memory of what the tribe has already survived." },
  { gates: [16, 48], name: "The Wavelength", from: "throat", to: "spleen", circuit: "collective", subcircuit: "Logic", theme: "Depth of skill that needs repetition, and the talent to demonstrate it." },
  { gates: [17, 62], name: "Acceptance", from: "ajna", to: "throat", circuit: "collective", subcircuit: "Logic", theme: "Precision with detail that makes an argument impossible to dismiss." },
  { gates: [18, 58], name: "Judgement", from: "spleen", to: "root", circuit: "collective", subcircuit: "Logic", theme: "Insight into what is not working, paired with the drive to fix it." },
  { gates: [29, 46], name: "Discovery", from: "sacral", to: "g", circuit: "collective", subcircuit: "Abstract", theme: "Saying yes to the experience and landing in the right place." },
  { gates: [30, 41], name: "Recognition", from: "solar", to: "root", circuit: "collective", subcircuit: "Abstract", theme: "Desire and fantasy that seed a whole new cycle of experience." },
  { gates: [35, 36], name: "Transitoriness", from: "throat", to: "solar", circuit: "collective", subcircuit: "Abstract", theme: "Hunger for experience, and the emotional weather that comes with it." },
  { gates: [42, 53], name: "Maturation", from: "sacral", to: "root", circuit: "collective", subcircuit: "Abstract", theme: "Cycles that must run to completion before they produce something of worth." },
  { gates: [47, 64], name: "Abstraction", from: "ajna", to: "head", circuit: "collective", subcircuit: "Abstract", theme: "Making sense of the past by turning confusion into pattern." },
] as const;

/** Canonical, order-independent key for a pair of gates. */
export function channelKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Fast lookup from a `"a-b"` key (lower gate first) to its channel. */
export const CHANNEL_BY_GATES: ReadonlyMap<string, ChannelMeta> = new Map(
  CHANNELS.map((c) => [channelKey(c.gates[0], c.gates[1]), c]),
);

/** The gates on the other side of each gate — used to render the bodygraph. */
export const GATE_CONNECTIONS: Readonly<Record<number, readonly number[]>> =
  Object.fromEntries(
    Array.from({ length: 64 }, (_, i) => i + 1).map((gate) => [
      gate,
      CHANNELS.filter((c) => c.gates.includes(gate))
        .map((c) => (c.gates[0] === gate ? c.gates[1] : c.gates[0]))
        .sort((a, b) => a - b),
    ]),
  );

/** The six lines of the hexagram, with their archetypal role. */
export const LINE_ROLES: readonly {
  line: number;
  name: string;
  theme: string;
}[] = [
  { line: 1, name: "Investigator", theme: "Security through foundations — needs the ground solid before building." },
  { line: 2, name: "Hermit", theme: "Natural talent that emerges when left alone and then called out." },
  { line: 3, name: "Martyr", theme: "Discovery through trial, error, and the bonds that break along the way." },
  { line: 4, name: "Opportunist", theme: "Influence through friendship, networks, and the doors those open." },
  { line: 5, name: "Heretic", theme: "Practical projection — the universal fix people expect you to deliver." },
  { line: 6, name: "Role Model", theme: "Wisdom earned by living it, then lived as an example." },
] as const;

/**
 * The twelve profiles. The key is `personalityLine/designLine` — the conscious
 * Sun line first, the unconscious (Design) Sun line second, which is the
 * conventional way a profile is written.
 */
export const PROFILES: readonly {
  key: string;
  name: string;
  angle: "right" | "juxtaposition" | "left";
  theme: string;
}[] = [
  { key: "1/3", name: "Investigator / Martyr", angle: "right", theme: "Research and discovery by doing it wrong first. A life of experimentation." },
  { key: "1/4", name: "Investigator / Opportunist", angle: "right", theme: "Foundations built in order to be shared through friendship and network." },
  { key: "2/4", name: "Hermit / Opportunist", angle: "right", theme: "Natural gift, called out by the people who already trust you." },
  { key: "2/5", name: "Hermit / Heretic", angle: "right", theme: "A private talent that gets projected onto and called to save the day." },
  { key: "3/5", name: "Martyr / Heretic", angle: "right", theme: "Trial and error turned into practical, universal solutions." },
  { key: "3/6", name: "Martyr / Role Model", angle: "right", theme: "A first life of hard-won experience that becomes wisdom for others." },
  { key: "4/1", name: "Opportunist / Investigator", angle: "juxtaposition", theme: "Fixed fate — influence that must rest on its own solid foundation." },
  { key: "4/6", name: "Opportunist / Role Model", angle: "right", theme: "Personal destiny — the network that carries a message outward." },
  { key: "5/1", name: "Heretic / Investigator", angle: "left", theme: "Transpersonal leadership grounded in a foundation that can be trusted." },
  { key: "5/2", name: "Heretic / Hermit", angle: "left", theme: "A called-out natural gift carrying the weight of others' projections." },
  { key: "6/2", name: "Role Model / Hermit", angle: "left", theme: "Natural talent observed from a distance, then lived as an example." },
  { key: "6/3", name: "Role Model / Martyr", angle: "left", theme: "Wisdom built through experiment, and held at a useful distance." },
] as const;

/** Profile lookup, keyed by `"personalityLine/designLine"`. */
export const PROFILE_BY_KEY: ReadonlyMap<string, (typeof PROFILES)[number]> =
  new Map(PROFILES.map((p) => [p.key, p]));

/**
 * The cross angle follows the profile, not the personality line alone. The
 * seven profiles 1/3, 1/4, 2/4, 2/5, 3/5, 3/6 and 4/6 are Right Angle; 4/1 is
 * the single Juxtaposition; 5/1, 5/2, 6/2 and 6/3 are Left Angle.
 */
export function crossAngleForProfile(
  personalityLine: number,
  designLine: number,
): "right" | "juxtaposition" | "left" {
  if (personalityLine === 4 && designLine === 1) return "juxtaposition";
  if (personalityLine >= 5) return "left";
  return "right";
}

/** The four variables, in the order they read around the bodygraph. */
export const VARIABLE_POSITIONS = [
  "determination",
  "environment",
  "motivation",
  "perspective",
] as const;
export type VariablePosition = (typeof VARIABLE_POSITIONS)[number];

/**
 * Determination reads from the Design Sun colour. The tone then picks the
 * Left (tones 1–3) or Right (tones 4–6) sub-type, listed here as `[left, right]`.
 */
export const DETERMINATION_BY_COLOR: readonly string[] = [
  "Appetite",
  "Taste",
  "Thirst",
  "Touch",
  "Sound",
  "Light",
] as const;

/** Determination sub-type by colour, as `[left, right]`. */
export const DETERMINATION_SUBTYPES: readonly (readonly [string, string])[] = [
  ["Consecutive", "Alternating"],
  ["Open", "Closed"],
  ["Hot", "Cold"],
  ["Calm", "Nervous"],
  ["High", "Low"],
  ["Direct", "Indirect"],
] as const;

/** Environment reads from the Design Nodes colour. */
export const ENVIRONMENT_BY_COLOR: readonly string[] = [
  "Caves",
  "Markets",
  "Kitchens",
  "Mountains",
  "Valleys",
  "Shores",
] as const;

/** Motivation reads from the Personality Sun colour. */
export const MOTIVATION_BY_COLOR: readonly string[] = [
  "Fear",
  "Hope",
  "Desire",
  "Need",
  "Guilt",
  "Innocence",
] as const;

/** Perspective (View) reads from the Personality Nodes colour. */
export const PERSPECTIVE_BY_COLOR: readonly string[] = [
  "Survival",
  "Possibility",
  "Power",
  "Wanting",
  "Probability",
  "Personal",
] as const;

/** Type metadata, keyed by type. */
export const TYPE_META = {
  Generator: {
    strategy: "Wait to respond",
    signature: "Satisfaction",
    notSelf: "Frustration",
    aura: "Open and enveloping",
    theme:
      "The life force of the planet. Your power is in the response, never the initiation.",
  },
  "Manifesting Generator": {
    strategy: "Respond, then inform",
    signature: "Satisfaction and peace",
    notSelf: "Frustration and anger",
    aura: "Open, enveloping, and impactive",
    theme:
      "Fast, multi-passionate, and built to skip steps. Respond first, then move — and tell people on the way out.",
  },
  Manifestor: {
    strategy: "Inform before acting",
    signature: "Peace",
    notSelf: "Anger",
    aura: "Closed and repelling",
    theme:
      "You initiate. The resistance you meet is not rejection — it is the price of not informing.",
  },
  Projector: {
    strategy: "Wait for the invitation",
    signature: "Success",
    notSelf: "Bitterness",
    aura: "Focused and absorbing",
    theme:
      "You see the other. Your gift lands when it is recognised and invited, and evaporates when it is pushed.",
  },
  Reflector: {
    strategy: "Wait a lunar cycle",
    signature: "Surprise",
    notSelf: "Disappointment",
    aura: "Resistant and sampling",
    theme:
      "A mirror for the community. You are here to sample the world, not to be defined by it.",
  },
} as const;

export type HumanDesignType = keyof typeof TYPE_META;

/** Authority, in the order the hierarchy resolves. */
export const AUTHORITY_ORDER = [
  "Emotional",
  "Sacral",
  "Splenic",
  "Ego",
  "Self-Projected",
  "Mental",
  "Lunar",
] as const;
export type Authority = (typeof AUTHORITY_ORDER)[number];

export const AUTHORITY_META: Readonly<Record<Authority, { how: string }>> = {
  Emotional: {
    how: "There is no truth in the now for you. Ride the wave — clarity arrives only after the emotional high and the low have both passed.",
  },
  Sacral: {
    how: "A gut yes or no, available in the moment. It arrives as sound and impulse before it arrives as a sentence.",
  },
  Splenic: {
    how: "A quiet, instantaneous, once-only knowing. It never repeats itself and it never argues.",
  },
  Ego: {
    how: "Truth arrives through what you actually want and what you have the will to back. Ask: do I want this, and do I have the energy for it?",
  },
  "Self-Projected": {
    how: "You hear your own truth by saying it out loud to someone who does not need to respond. The answer is in your voice, not theirs.",
  },
  Mental: {
    how: "You have no inner authority. Your clarity comes from talking it through, in the right environment, with the right people, over time.",
  },
  Lunar: {
    how: "You have no consistent inner authority at all. Give every significant decision a full lunar cycle — about 28 days — before you move.",
  },
} as const;

/** Definition (graph connectivity) metadata. */
export const DEFINITION_META: Readonly<Record<string, string>> = {
  None: "No centres are defined. You are a Reflector — a true mirror for the people around you.",
  Single: "All your defined centres form one continuous circuit. You process life at one consistent speed.",
  Split: "Your definition forms two separate areas. You are built to seek out the other half — and that search is the point.",
  "Triple Split": "Three separate areas. You need time and the right company to bridge them, and bridging them is your genius.",
  "Quadruple Split": "Four separate areas. Rare, and deeply dependent on environment and the right people to feel whole.",
} as const;
