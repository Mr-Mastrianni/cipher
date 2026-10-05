/**
 * Human Design — the bodygraph.
 *
 * Two layers live here:
 *
 * 1. {@link computeActivations} — the **26 activations**: 13 conscious bodies at
 *    the birth instant and 13 unconscious bodies at the Design instant. Earth is
 *    the Sun's geometric opposition and the South Node is the North Node's, so
 *    neither is an ephemeris lookup.
 * 2. {@link buildBodygraph} — the mechanical graph over those activations:
 *    channels, defined centres, Type, Authority, Profile, Definition and the
 *    Incarnation Cross.
 *
 * ACCURACY CAVEATS
 * ----------------
 * - Gate, line and colour are stable for any birth time accurate to the minute.
 *   **Tone and base are not**, and neither is any reading sitting near a slice
 *   boundary. {@link Bodygraph.signals} lists every activation within 0.02° of a
 *   line or gate edge so the UI can say so rather than implying a precision the
 *   birth data cannot support.
 * - Type is resolved by a real breadth-first search over the defined-channel
 *   graph (motor → Throat), not by a hardcoded channel list. The Throat is only
 *   a valid starting point when a complete channel actually defines it.
 * - Authority precedence is Solar Plexus → Sacral → Spleen → Heart → G+Throat →
 *   Throat-only (**Mental**) → **Lunar** (Reflector). Mental and Lunar are the
 *   two documented **no-inner-authority** cases: a Mental Projector has clarity
 *   only through environment and sounding boards, and a Reflector must sample a
 *   full lunar cycle.
 */

import {
  AUTHORITY_META,
  CENTERS,
  CENTER_TO_GATES,
  CHANNELS,
  DEFINITION_META,
  DETERMINATION_BY_COLOR,
  ENVIRONMENT_BY_COLOR,
  GATE_CONNECTIONS,
  GATE_TO_CENTER,
  MOTIVATION_BY_COLOR,
  MOTOR_CENTERS,
  PERSPECTIVE_BY_COLOR,
  PROFILES,
  PROFILE_BY_KEY,
  TYPE_META,
  channelKey,
  crossAngleForProfile,
} from "./constants";
import type {
  Authority,
  CenterKey,
  HumanDesignType,
  VariablePosition,
} from "./constants";
import {
  BOUNDARY_WARNING_DEGREES,
  HD_BODY_LABEL,
  HD_BODY_ORDER,
  boundaryDistance,
  gateLineFromLongitude,
} from "./activation";
import type { Activation, ActivationSource, BodyKey } from "./activation";
import { solveDesignTime } from "./design-time";
import { bodyPosition, sunPosition, trueNode } from "../astrology/ephemeris";
import { normalize } from "../astrology/zodiac";

/**
 * One of the twelve profiles. The constants module derives this from its own
 * table so the two can never drift.
 */
export type ProfileMeta = (typeof PROFILES)[number];

/** A gate together with the line it was activated on. */
export interface GateLine {
  /** 1–64. */
  gate: number;
  /** 1–6. */
  line: number;
}

/** How a gate or channel was activated: consciously, unconsciously, or both. */
export type SourceCombination = ActivationSource | "both";

/** One activated gate, aggregated across both charts. */
export interface ActivatedGate {
  gate: number;
  /** The centre that gate belongs to. */
  center: CenterKey;
  /** Which chart(s) activated it, in canonical order. */
  sources: ActivationSource[];
  /** Highest line activated on this gate across both charts. */
  strongestLine: number;
  /** Every activation that landed in this gate. */
  activations: Activation[];
}

/** One defined (complete) channel — both gates activated. */
export interface DefinedChannel {
  gates: readonly [number, number];
  key: string;
  name: string;
  from: CenterKey;
  to: CenterKey;
  sources: SourceCombination;
  /** Always `true`; lets consumers render full and hanging gates uniformly. */
  full: true;
}

/** An activated gate whose partner gate is not activated. Defines nothing. */
export interface HangingGate {
  gate: number;
  center: CenterKey;
  /** Partner gates that are missing — the channels this gate would complete. */
  waitingOn: number[];
  sources: ActivationSource[];
  strongestLine: number;
}

/** The state of one of the nine centres. */
export interface CenterState {
  defined: boolean;
  /** Gates in this centre sitting on a complete channel. */
  gates: number[];
  /** Gates in this centre carrying any activation, defined or not. */
  activatedGates: number[];
}

/** A connected group of defined centres — one half of a split chart. */
export interface DefinitionRegion {
  centers: CenterKey[];
  channels: string[];
}

/** The five graph-connectivity labels; the keys of `DEFINITION_META`. */
export type DefinitionLabel =
  | "None"
  | "Single"
  | "Split"
  | "Triple Split"
  | "Quadruple Split";

/** Definition label plus the actual components behind it. */
export interface DefinitionResult {
  label: DefinitionLabel;
  componentCount: number;
  regions: DefinitionRegion[];
}

/** The Incarnation Cross — the quartet of the two Sun/Earth axes. */
export interface IncarnationCross {
  angle: "right" | "juxtaposition" | "left";
  personalitySun: GateLine;
  personalityEarth: GateLine;
  designSun: GateLine;
  designEarth: GateLine;
  /** Conventional printed quartet, e.g. `"19.2/33.2 | 44.4/24.4"`. */
  quartet: string;
  /** The canonical cross name, when the Personality Sun gate is in the lookup. */
  name: string | null;
  /** Human-readable label, e.g. `"Right Angle Cross of the Four Ways 4 (19.2/33.2 | 44.4/24.4)"`. */
  label: string;
}

/** One of the four Variable arrows. */
export interface VariableValue {
  position: VariablePosition;
  /** 1–6. */
  color: number;
  /** 1–6. */
  tone: number;
  /** The named transformation for this colour, from the constants table. */
  name: string;
  /**
   * Colour 1–3 reads Left, 4–6 reads Right. The arrow direction is *contested*
   * in the literature (colour vs tone); this reports the colour convention.
   */
  direction: "Left" | "Right";
  /** Which side of the chart supplies it. */
  side: "design" | "personality";
}

/** A birth-time-sensitivity warning for one activation. */
export interface BoundarySignal {
  kind: "line" | "gate";
  body: BodyKey;
  label: string;
  source: ActivationSource;
  gate: number;
  line: number;
  /** Degrees to the boundary; `0` means the activation sits exactly on it. */
  distance: number;
}

/** The full computed bodygraph. */
export interface Bodygraph {
  /** The natal instant the chart was cast for. */
  birthInstant: Date;
  /** The Design instant: 88° of solar arc before birth. */
  designInstant: Date;
  /** Elapsed days between the two instants; never exactly 88. */
  designIntervalDays: number;
  /** All 26 activations, Personality first. */
  activations: Activation[];
  /** Every activated gate, aggregated per gate. */
  gates: ActivatedGate[];
  /** Complete channels — both gates activated. */
  channels: DefinedChannel[];
  /** Activated gates whose partner is missing. */
  hangingGates: HangingGate[];
  /** All nine centres, defined and undefined. */
  centers: Record<CenterKey, CenterState>;
  /** The number of defined centres, 0–9. */
  definedCenterCount: number;
  type: HumanDesignType;
  typeMeta: (typeof TYPE_META)[HumanDesignType];
  authority: Authority;
  authorityMeta: (typeof AUTHORITY_META)[Authority];
  /** `"personalityLine/designLine"`, e.g. `"2/4"`. */
  profile: string;
  profileMeta: ProfileMeta | null;
  definition: DefinitionResult;
  definitionDescription: string;
  incarnationCross: IncarnationCross;
  variables: Record<VariablePosition, VariableValue>;
  /** Activations close enough to a slice boundary to be birth-time sensitive. */
  signals: BoundarySignal[];
  /** Non-fatal issues worth surfacing to the user. */
  warnings: string[];
}

/** Which activation sources contribute, merged to a single label. */
function mergeSources(sources: readonly ActivationSource[]): SourceCombination {
  const hasDesign = sources.includes("design");
  const hasPersonality = sources.includes("personality");
  if (hasDesign && hasPersonality) return "both";
  return hasDesign ? "design" : "personality";
}

/** Turn one instant into the 13 activations for one chart. */
export function activationsForChart(
  instant: Date,
  source: ActivationSource,
): Activation[] {
  const sunLongitude = sunPosition(instant).longitude;
  const nodeLongitude = trueNode(instant).longitude;

  const longitudeOf = (body: BodyKey): number => {
    switch (body) {
      case "sun":
        return sunLongitude;
      case "earth":
        return normalize(sunLongitude + 180);
      case "northNode":
        return nodeLongitude;
      case "southNode":
        return normalize(nodeLongitude + 180);
      default: {
        const position = bodyPosition(body, instant);
        if (!position) {
          throw new Error(
            `computeActivations: ephemeris returned no position for "${body}" at ${instant.toISOString()}`,
          );
        }
        return position.longitude;
      }
    }
  };

  return HD_BODY_ORDER.map((body) => {
    const longitude = longitudeOf(body);
    const position = gateLineFromLongitude(longitude);
    return {
      body,
      source,
      longitude,
      gate: position.gate,
      line: position.line,
      color: position.color,
      tone: position.tone,
      base: position.base,
      boundary: boundaryDistance(longitude),
    } satisfies Activation;
  });
}

/**
 * The 26 activations for a birth instant.
 *
 * The 13 **Personality** (conscious) activations are taken at `birthInstant`.
 * The 13 **Design** (unconscious) activations are taken at the instant the Sun
 * stood exactly 88° of solar arc earlier — see {@link solveDesignTime}, which
 * root-finds that instant on the Sun's longitude rather than subtracting 88
 * days (the true interval is ~86–92 days).
 *
 * Earth is `Sun + 180°` and the South Node is `North Node + 180°`; both go
 * through the same gate/line reader as every other body. The nodes use the
 * **true** (osculating) node, the convention Human Design uses.
 *
 * @param birthInstant The natal instant.
 * @returns 26 activations: all 13 Personality bodies, then all 13 Design bodies.
 * @throws If the ephemeris returns no position for a body, which would mean a
 *   dependency problem rather than a bad birth time.
 *
 * @remarks When the Design instant has already been solved (as
 *   {@link import("./index").computeHumanDesign} does), call
 *   {@link activationsForChart} twice instead — that avoids a second root-find.
 */
export function computeActivations(birthInstant: Date): Activation[] {
  const design = solveDesignTime(birthInstant);
  return [
    ...activationsForChart(birthInstant, "personality"),
    ...activationsForChart(design, "design"),
  ];
}

/** The published angle prefix for each cross type. */
const ANGLE_LABEL: Readonly<Record<IncarnationCross["angle"], string>> = {
  right: "Right Angle Cross of",
  juxtaposition: "Juxtaposition Cross of",
  left: "Left Angle Cross of",
};

/**
 * Canonical Incarnation Cross names, keyed by Personality Sun gate.
 *
 * The name is a **lookup**, not a formula. Values are the Jovian/IHDS names as
 * transcribed in `research/human-design-algorithm.md` §11.3 (192 rows = 64 gates
 * × 3 angles), cross-checked against `hd_research/cross_table.md`, with which
 * they agree on all 192 names modulo the trailing quarter numeral. The quartet
 * itself is derivable; only the name is not.
 */
const CROSS_NAMES: Readonly<
  Record<number, { right: string; juxtaposition: string; left: string }>
> = {
  1: { right: "the Sphinx 4", juxtaposition: "Self-Expression", left: "Defiance 2" },
  2: { right: "the Sphinx 2", juxtaposition: "the Driver", left: "Defiance 1" },
  3: { right: "Laws 1", juxtaposition: "Mutation", left: "Wishes 1" },
  4: { right: "Explanation 3", juxtaposition: "Formulization", left: "Revolution 1" },
  5: { right: "Consciousness 4", juxtaposition: "Habits", left: "Separation 2" },
  6: { right: "Eden 3", juxtaposition: "Conflict", left: "the Plane 1" },
  7: { right: "the Sphinx 3", juxtaposition: "Interaction", left: "Masks 1" },
  8: { right: "Contagion 2", juxtaposition: "Contribution", left: "Uncertainty 1" },
  9: { right: "Planning 4", juxtaposition: "Focus", left: "Identification 2" },
  10: { right: "the Vessel of Love 4", juxtaposition: "Behavior", left: "Prevention 2" },
  11: { right: "Eden 4", juxtaposition: "Ideas", left: "Education 2" },
  12: { right: "Eden 2", juxtaposition: "Articulation", left: "Education 1" },
  13: { right: "the Sphinx 1", juxtaposition: "Listening", left: "Masks 2" },
  14: { right: "Contagion 4", juxtaposition: "Empowering", left: "Uncertainty 2" },
  15: { right: "the Vessel of Love 2", juxtaposition: "Extremes", left: "Prevention 1" },
  16: { right: "Planning 2", juxtaposition: "Experimentation", left: "Identification 1" },
  17: { right: "Service 1", juxtaposition: "Opinions", left: "Upheaval 1" },
  18: { right: "Service 3", juxtaposition: "Correction", left: "Upheaval 2" },
  19: { right: "the Four Ways 4", juxtaposition: "Need", left: "Refinement 2" },
  20: { right: "the Sleeping Phoenix 2", juxtaposition: "the Now", left: "Duality 1" },
  21: { right: "Tension 1", juxtaposition: "Control", left: "Endeavor 1" },
  22: { right: "Rulership 1", juxtaposition: "Grace", left: "Informing 2" },
  23: { right: "Explanation 2", juxtaposition: "Assimilation", left: "Dedication 1" },
  24: { right: "the Four Ways 1", juxtaposition: "Rationalization", left: "Incarnation 1" },
  25: { right: "the Vessel of Love 1", juxtaposition: "Innocence", left: "Healing 2" },
  26: { right: "Rulership 4", juxtaposition: "the Trickster", left: "Confrontation 2" },
  27: { right: "the Unexpected 1", juxtaposition: "Caring", left: "Alignment 1" },
  28: { right: "the Unexpected 3", juxtaposition: "Risks", left: "Alignment 2" },
  29: { right: "Contagion 3", juxtaposition: "Commitment", left: "Industry 1" },
  30: { right: "Contagion 1", juxtaposition: "Fates", left: "Industry 2" },
  31: { right: "the Unexpected 2", juxtaposition: "Influence", left: "the Alpha 1" },
  32: { right: "Maya 3", juxtaposition: "Conservation", left: "Limitation 2" },
  33: { right: "the Four Ways 2", juxtaposition: "Retreat", left: "Refinement 1" },
  34: { right: "the Sleeping Phoenix 4", juxtaposition: "Power", left: "Duality 2" },
  35: { right: "Consciousness 2", juxtaposition: "Experience", left: "Separation 1" },
  36: { right: "Eden 1", juxtaposition: "Crisis", left: "the Plane 2" },
  37: { right: "Planning 1", juxtaposition: "Bargains", left: "Migration 2" },
  38: { right: "Tension 4", juxtaposition: "Opposition", left: "Individualism 2" },
  39: { right: "Tension 2", juxtaposition: "Provocation", left: "Individualism 1" },
  40: { right: "Planning 3", juxtaposition: "Denial", left: "Migration 1" },
  41: { right: "the Unexpected 4", juxtaposition: "Fantasy", left: "the Alpha 2" },
  42: { right: "Maya 1", juxtaposition: "Completion", left: "Limitation 1" },
  43: { right: "Explanation 4", juxtaposition: "Insight", left: "Dedication 2" },
  44: { right: "the Four Ways 3", juxtaposition: "Alertness", left: "Incarnation 2" },
  45: { right: "Rulership 2", juxtaposition: "Possession", left: "Confrontation 1" },
  46: { right: "the Vessel of Love 3", juxtaposition: "Serendipity", left: "Healing 1" },
  47: { right: "Rulership 3", juxtaposition: "Oppression", left: "Informing 1" },
  48: { right: "Tension 3", juxtaposition: "Depth", left: "Endeavor 2" },
  49: { right: "Explanation 1", juxtaposition: "Principles", left: "Revolution 2" },
  50: { right: "Laws 3", juxtaposition: "Values", left: "Wishes 2" },
  51: { right: "Penetration 1", juxtaposition: "Shock", left: "the Clarion 1" },
  52: { right: "Service 2", juxtaposition: "Stillness", left: "Demands 1" },
  53: { right: "Penetration 2", juxtaposition: "Beginnings", left: "Cycles 1" },
  54: { right: "Penetration 4", juxtaposition: "Ambition", left: "Cycles 2" },
  55: { right: "the Sleeping Phoenix 1", juxtaposition: "Moods", left: "Spirit 2" },
  56: { right: "Laws 2", juxtaposition: "Stimulation", left: "Distraction 1" },
  57: { right: "Penetration 3", juxtaposition: "Intuition", left: "the Clarion 2" },
  58: { right: "Service 4", juxtaposition: "Vitality", left: "Demands 2" },
  59: { right: "the Sleeping Phoenix 3", juxtaposition: "Strategy", left: "Spirit 1" },
  60: { right: "Laws 4", juxtaposition: "Limitation", left: "Distraction 2" },
  61: { right: "Maya 4", juxtaposition: "Thinking", left: "Obscuration 2" },
  62: { right: "Maya 2", juxtaposition: "Detail", left: "Obscuration 1" },
  63: { right: "Consciousness 1", juxtaposition: "Doubts", left: "Dominion 2" },
  64: { right: "Consciousness 3", juxtaposition: "Confusion", left: "Dominion 1" },
};

/** Build the `Record<CenterKey, CenterState>` skeleton, all undefined. */
function emptyCenters(): Record<CenterKey, CenterState> {
  return Object.fromEntries(
    CENTERS.map((c) => [
      c.key,
      { defined: false, gates: [], activatedGates: [] },
    ]),
  ) as unknown as Record<CenterKey, CenterState>;
}

/** Format a `{gate, line}` as the conventional `"19.2"`. */
function formatGateLine(gl: GateLine): string {
  return `${gl.gate}.${gl.line}`;
}

/** Find one activation by body and source. */
function findActivation(
  activations: readonly Activation[],
  source: ActivationSource,
  body: BodyKey,
): Activation {
  const found = activations.find((a) => a.source === source && a.body === body);
  if (!found) {
    throw new Error(`buildBodygraph: missing ${source} activation for ${body}`);
  }
  return found;
}

/** The four Variable arrows, read off their four specific activations. */
function computeVariables(
  activations: readonly Activation[],
): Record<VariablePosition, VariableValue> {
  const designSun = findActivation(activations, "design", "sun");
  const designNodes = findActivation(activations, "design", "northNode");
  const personalitySun = findActivation(activations, "personality", "sun");
  const personalityNodes = findActivation(activations, "personality", "northNode");

  const build = (
    position: VariablePosition,
    color: number,
    tone: number,
    names: readonly string[],
    side: "design" | "personality",
  ): VariableValue => ({
    position,
    color,
    tone,
    name: names[color - 1] ?? names[0],
    direction: color <= 3 ? "Left" : "Right",
    side,
  });

  return {
    determination: build(
      "determination",
      designSun.color,
      designSun.tone,
      DETERMINATION_BY_COLOR,
      "design",
    ),
    environment: build(
      "environment",
      designNodes.color,
      designNodes.tone,
      ENVIRONMENT_BY_COLOR,
      "design",
    ),
    motivation: build(
      "motivation",
      personalitySun.color,
      personalitySun.tone,
      MOTIVATION_BY_COLOR,
      "personality",
    ),
    perspective: build(
      "perspective",
      personalityNodes.color,
      personalityNodes.tone,
      PERSPECTIVE_BY_COLOR,
      "personality",
    ),
  };
}

/** The two instants the chart was cast for, echoed onto the result. */
export interface BuildBodygraphOptions {
  /** The natal instant, echoed onto the result. */
  birthInstant: Date;
  /** The Design instant, echoed onto the result. */
  designInstant: Date;
}

/**
 * Build the complete graph from a set of 26 activations.
 *
 * @param activations The output of {@link computeActivations} — exactly one
 *   activation per body per source, 26 in total.
 * @param options The two instants the activations were sampled at, echoed onto
 *   the result and used for the Design interval.
 * @returns A fully resolved bodygraph.
 *
 * @remarks
 * - A centre is **defined** when at least one *complete* channel touches it.
 *   Hanging gates colour the chart but define nothing.
 * - **Type** precedence: Reflector (no defined centre) → Manifestor (no Sacral,
 *   Throat connected to a motor by a graph path) → Manifesting Generator
 *   (Sacral defined, Throat connected to a motor) → Generator (Sacral defined)
 *   → Projector. The motor check is a breadth-first search, so Sacral→G→Throat
 *   via `2-14` + `7-31` correctly yields a Manifesting Generator.
 * - **Definition** is the connected-component count over the graph whose edges
 *   are complete channels and whose nodes are defined centres: 0 → None,
 *   1 → Single, 2 → Split, 3 → Triple Split, 4+ → Quadruple Split.
 * - **Tone and base are not reliable** without a to-the-second birth time; see
 *   {@link Bodygraph.signals}.
 */
export function buildBodygraph(
  activations: readonly Activation[],
  options: BuildBodygraphOptions,
): Bodygraph {
  if (activations.length !== 26) {
    throw new Error(
      `buildBodygraph: expected 26 activations, received ${activations.length}`,
    );
  }

  const warnings: string[] = [];

  // ── Per-gate aggregation ────────────────────────────────────────────────
  const byGate = new Map<number, Activation[]>();
  for (const activation of activations) {
    const bucket = byGate.get(activation.gate);
    if (bucket) bucket.push(activation);
    else byGate.set(activation.gate, [activation]);
  }

  const gates: ActivatedGate[] = [...byGate.entries()]
    .map(([gate, list]) => {
      const sources = [
        ...new Set(list.map((a) => a.source)),
      ].sort() as ActivationSource[];
      return {
        gate,
        center: GATE_TO_CENTER[gate],
        sources,
        strongestLine: Math.max(...list.map((a) => a.line)),
        activations: list,
      } satisfies ActivatedGate;
    })
    .sort((a, b) => a.gate - b.gate);

  const activatedGates = new Set(byGate.keys());

  // ── Complete channels ───────────────────────────────────────────────────
  const channels: DefinedChannel[] = [];
  const completedKeys = new Set<string>();
  for (const channel of CHANNELS) {
    const [a, b] = channel.gates;
    if (!activatedGates.has(a) || !activatedGates.has(b)) continue;
    completedKeys.add(channelKey(a, b));
    channels.push({
      gates: channel.gates,
      key: channelKey(a, b),
      name: channel.name,
      from: channel.from,
      to: channel.to,
      sources: mergeSources([
        ...(byGate.get(a)?.map((x) => x.source) ?? []),
        ...(byGate.get(b)?.map((x) => x.source) ?? []),
      ]),
      full: true,
    });
  }

  // ── Hanging gates: activated, but on no complete channel ────────────────
  const hangingGates: HangingGate[] = gates
    .filter((g) =>
      (GATE_CONNECTIONS[g.gate] ?? []).every(
        (partner) => !completedKeys.has(channelKey(g.gate, partner)),
      ),
    )
    .map((g) => ({
      gate: g.gate,
      center: g.center,
      waitingOn: (GATE_CONNECTIONS[g.gate] ?? []).filter(
        (partner) => !activatedGates.has(partner),
      ),
      sources: g.sources,
      strongestLine: g.strongestLine,
    }));

  // ── Centres ─────────────────────────────────────────────────────────────
  const centers = emptyCenters();
  for (const centre of CENTERS) {
    centers[centre.key] = {
      defined: false,
      gates: [],
      activatedGates: (CENTER_TO_GATES[centre.key] ?? []).filter((gate) =>
        activatedGates.has(gate),
      ),
    };
  }
  for (const channel of channels) {
    for (const centre of [channel.from, channel.to]) {
      const state = centers[centre];
      state.defined = true;
      for (const gate of channel.gates) {
        if (GATE_TO_CENTER[gate] === centre && !state.gates.includes(gate)) {
          state.gates.push(gate);
        }
      }
      state.gates.sort((a, b) => a - b);
    }
  }

  const definedCenters = CENTERS.map((c) => c.key).filter(
    (key) => centers[key].defined,
  );
  const definedCenterSet = new Set(definedCenters);

  // ── Adjacency over complete channels, for the graph walks ───────────────
  const adjacency = new Map<CenterKey, CenterKey[]>();
  for (const centre of definedCenters) adjacency.set(centre, []);
  for (const channel of channels) {
    adjacency.get(channel.from)?.push(channel.to);
    adjacency.get(channel.to)?.push(channel.from);
  }

  /** Breadth-first reachability over the defined-centre graph. */
  const reachableFrom = (start: CenterKey): Set<CenterKey> => {
    const seen = new Set<CenterKey>();
    if (!definedCenterSet.has(start)) return seen;
    const queue: CenterKey[] = [start];
    seen.add(start);
    while (queue.length > 0) {
      const current = queue.shift() as CenterKey;
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };

  const throat: CenterKey = "throat";
  const throatReaches = reachableFrom(throat);
  const motorToThroat = MOTOR_CENTERS.some(
    (motor) => definedCenterSet.has(motor) && throatReaches.has(motor),
  );

  // ── Type ────────────────────────────────────────────────────────────────
  const sacralDefined = definedCenterSet.has("sacral");
  let type: HumanDesignType;
  if (definedCenters.length === 0) {
    type = "Reflector";
  } else if (!sacralDefined && motorToThroat) {
    type = "Manifestor";
  } else if (sacralDefined && motorToThroat) {
    type = "Manifesting Generator";
  } else if (sacralDefined) {
    type = "Generator";
  } else {
    type = "Projector";
  }

  // ── Authority ───────────────────────────────────────────────────────────
  let authority: Authority;
  if (definedCenterSet.has("solar")) {
    authority = "Emotional";
  } else if (sacralDefined) {
    authority = "Sacral";
  } else if (definedCenterSet.has("spleen")) {
    authority = "Splenic";
  } else if (definedCenterSet.has("heart")) {
    authority = "Ego";
  } else if (definedCenterSet.has("g") && definedCenterSet.has(throat)) {
    authority = "Self-Projected";
  } else if (definedCenterSet.has(throat)) {
    // Mental: definition sits at or above the Throat. No inner authority.
    authority = "Mental";
  } else {
    // Lunar: a Reflector. No consistent inner authority at all.
    authority = "Lunar";
  }

  // ── Profile ─────────────────────────────────────────────────────────────
  const personalitySun = findActivation(activations, "personality", "sun");
  const personalityEarth = findActivation(activations, "personality", "earth");
  const designSun = findActivation(activations, "design", "sun");
  const designEarth = findActivation(activations, "design", "earth");

  const profile = `${personalitySun.line}/${designSun.line}`;
  const profileMeta = PROFILE_BY_KEY.get(profile) ?? null;
  if (!profileMeta) {
    warnings.push(
      `Profile ${profile} is not one of the twelve canonical profiles; the mechanical bodygraph is still valid but the profile read is unavailable.`,
    );
  }

  // ── Definition ──────────────────────────────────────────────────────────
  const components: CenterKey[][] = [];
  const seenCenters = new Set<CenterKey>();
  for (const centre of definedCenters) {
    if (seenCenters.has(centre)) continue;
    const component = [...reachableFrom(centre)];
    for (const key of component) seenCenters.add(key);
    component.sort((a, b) => a.localeCompare(b));
    components.push(component);
  }
  components.sort(
    (a, b) => b.length - a.length || a[0].localeCompare(b[0]),
  );

  const regions: DefinitionRegion[] = components.map((component) => {
    const memberSet = new Set(component);
    return {
      centers: component,
      channels: channels
        .filter((c) => memberSet.has(c.from) && memberSet.has(c.to))
        .map((c) => c.key),
    };
  });

  const definitionLabel: DefinitionLabel =
    components.length === 0
      ? "None"
      : components.length === 1
        ? "Single"
        : components.length === 2
          ? "Split"
          : components.length === 3
            ? "Triple Split"
            : "Quadruple Split";

  if (components.length > 4) {
    warnings.push(
      `Definition resolved to ${components.length} components, beyond the published Quadruple Split label; it is reported as Quadruple Split.`,
    );
  }

  // ── Incarnation Cross ───────────────────────────────────────────────────
  const angle = crossAngleForProfile(personalitySun.line, designSun.line);
  const personalityPair = `${formatGateLine(personalitySun)}/${formatGateLine(personalityEarth)}`;
  const designPair = `${formatGateLine(designSun)}/${formatGateLine(designEarth)}`;
  const quartet = `${personalityPair} | ${designPair}`;
  const personalSunGateLine: GateLine = {
    gate: personalitySun.gate,
    line: personalitySun.line,
  };
  const crossName = CROSS_NAMES[personalitySun.gate]?.[angle] ?? null;

  const incarnationCross: IncarnationCross = {
    angle,
    personalitySun: personalSunGateLine,
    personalityEarth: {
      gate: personalityEarth.gate,
      line: personalityEarth.line,
    },
    designSun: { gate: designSun.gate, line: designSun.line },
    designEarth: { gate: designEarth.gate, line: designEarth.line },
    quartet,
    name: crossName,
    label: crossName
      ? `${ANGLE_LABEL[angle]} ${crossName} (${quartet})`
      : `${ANGLE_LABEL[angle]} (${quartet})`,
  };

  // ── Variables ───────────────────────────────────────────────────────────
  const variables = computeVariables(activations);

  if (designSun.color !== designEarth.color) {
    warnings.push(
      `Design Sun colour (${designSun.color}) and Design Earth colour (${designEarth.color}) disagree; Determination and its transference may be birth-time sensitive.`,
    );
  }
  if (personalitySun.color !== personalityEarth.color) {
    warnings.push(
      `Personality Sun colour (${personalitySun.color}) and Personality Earth colour (${personalityEarth.color}) disagree; Motivation and its transference may be birth-time sensitive.`,
    );
  }

  // ── Boundary signals ────────────────────────────────────────────────────
  const signals: BoundarySignal[] = [];
  for (const activation of activations) {
    const label = `${activation.source} ${HD_BODY_LABEL[activation.body]}`;
    if (activation.boundary.toLineBoundary < BOUNDARY_WARNING_DEGREES) {
      signals.push({
        kind: "line",
        body: activation.body,
        label,
        source: activation.source,
        gate: activation.gate,
        line: activation.line,
        distance: activation.boundary.toLineBoundary,
      });
    }
    if (activation.boundary.toGateBoundary < BOUNDARY_WARNING_DEGREES) {
      signals.push({
        kind: "gate",
        body: activation.body,
        label,
        source: activation.source,
        gate: activation.gate,
        line: activation.line,
        distance: activation.boundary.toGateBoundary,
      });
    }
  }
  signals.sort((a, b) => a.distance - b.distance);

  return {
    birthInstant: options.birthInstant,
    designInstant: options.designInstant,
    designIntervalDays:
      (options.birthInstant.getTime() - options.designInstant.getTime()) /
      86_400_000,
    activations: [...activations],
    gates,
    channels,
    hangingGates,
    centers,
    definedCenterCount: definedCenters.length,
    type,
    typeMeta: TYPE_META[type],
    authority,
    authorityMeta: AUTHORITY_META[authority],
    profile,
    profileMeta,
    definition: {
      label: definitionLabel,
      componentCount: components.length,
      regions,
    },
    definitionDescription: DEFINITION_META[definitionLabel] ?? "",
    incarnationCross,
    variables,
    signals,
    warnings,
  };
}
