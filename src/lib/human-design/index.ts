/**
 * Human Design — public entry point.
 *
 * `computeHumanDesign(birthInstant)` is the only function a caller normally
 * needs. Everything else here is the layer beneath it, re-exported so the UI can
 * render a chart without reaching into private modules, and so tests can pin the
 * individual steps.
 *
 * ACCURACY CAVEATS (the short version)
 * ------------------------------------
 * - Gate, line and colour survive a birth time accurate to the minute. **Tone
 *   and base do not** — they are 93.75″ and 18.75″ wide, and the Moon moves
 *   ~33″ per minute of clock time.
 * - The Design chart is cast for **88° of solar arc** before birth, not 88 days.
 *   The real interval ranges from ~86 to ~92 days depending on where Earth is in
 *   its orbit, so `solveDesignTime` root-finds the instant.
 * - Read {@link Bodygraph.signals} and warn the user whenever it is non-empty.
 *   A reading with an activation inside 0.02° of a line boundary can flip
 *   profile or cross on a birth time that is wrong by a couple of minutes.
 * - The zodiac is **tropical**. A sidereal conversion would be wrong by more
 *   than four gates.
 *
 * A note on the re-export surface: `./constants` is the authoritative data
 * module and every name it exports is forwarded here unchanged. The only
 * collision resolved in this file is `ActivationSource` (from `./activation`),
 * which is re-exported under its own name because `./constants` has no symbol
 * of that name.
 */

import { activationsForChart, buildBodygraph } from "./bodygraph";
import { solveDesignTime } from "./design-time";
import type { Bodygraph } from "./bodygraph";
import type { Activation } from "./activation";

// ── Primary entry point ─────────────────────────────────────────────────────

/**
 * Compute the complete Human Design bodygraph for a birth instant.
 *
 * This is the single public entry point. It resolves the Design instant (88° of
 * solar arc before birth), samples all 26 activations from the ephemeris, and
 * builds the mechanical graph: channels, defined centres, Type, Authority,
 * Profile, Definition, Incarnation Cross and the four Variables.
 *
 * @param birthInstant The natal instant, in UTC. Convert local clock time with
 *   the historical IANA zone for the birth place — not a modern fixed offset.
 * @returns A fully resolved {@link Bodygraph}. Always check
 *   `result.signals` before presenting tone/base-level precision.
 * @throws If the ephemeris cannot supply a body position, or if the 88° solar
 *   arc cannot be bracketed — either of which indicates an environment problem
 *   rather than bad birth data.
 *
 * @remarks Timezone and time-scale handling is the caller's responsibility:
 * pass a true UTC instant, and note that the ephemeris provider samples in
 * Terrestrial Time internally, so no ΔT correction is applied here.
 */
export function computeHumanDesign(birthInstant: Date): Bodygraph {
  const design = solveDesignTime(birthInstant);
  const activations = [
    ...activationsForChart(birthInstant, "personality"),
    ...activationsForChart(design, "design"),
  ];
  return buildBodygraph(activations, {
    birthInstant,
    designInstant: design,
  });
}

// ── Module re-exports ───────────────────────────────────────────────────────
// Constants are re-exported so consumers have one import site for the whole
// feature. Every name below is explicit, which keeps the surface auditable and
// makes any future collision with `./constants` a compile error rather than a
// silent shadow.

export {
  AUTHORITY_META,
  AUTHORITY_ORDER,
  BASE_ARC,
  CENTERS,
  CENTER_MAP,
  CENTER_TO_GATES,
  CHANNELS,
  CHANNEL_BY_GATES,
  COLOR_ARC,
  DEFINITION_META,
  DETERMINATION_BY_COLOR,
  DETERMINATION_SUBTYPES,
  ENVIRONMENT_BY_COLOR,
  GATE_ARC,
  GATE_CONNECTIONS,
  GATE_TO_CENTER,
  GATE_WHEEL,
  LINE_ARC,
  LINE_ROLES,
  MOTIVATION_BY_COLOR,
  MOTOR_CENTERS,
  PERSPECTIVE_BY_COLOR,
  PROFILES,
  PROFILE_BY_KEY,
  TONE_ARC,
  TYPE_META,
  VARIABLE_POSITIONS,
  WHEEL_START_DEGREES,
  channelKey,
  crossAngleForProfile,
} from "./constants";

export type {
  Authority,
  CenterKey,
  CenterMeta,
  ChannelMeta,
  HumanDesignType,
  VariablePosition,
} from "./constants";

// Activation layer.
export {
  BOUNDARY_WARNING_DEGREES,
  HD_BODY_LABEL,
  HD_BODY_ORDER,
  boundaryDistance,
  degreesIntoGate,
  degreesIntoLine,
  gateLineFromLongitude,
} from "./activation";

export type {
  Activation,
  ActivationSource,
  BodyKey,
  BoundaryDistance,
  GateLinePosition,
} from "./activation";

// Design-time layer.
export {
  DESIGN_SEARCH_WINDOW_DAYS,
  DESIGN_SOLAR_ARC_DEGREES,
  designInstant,
  designIntervalDays,
  solarArcAt,
  solveDesignTime,
} from "./design-time";

// Bodygraph layer.
export {
  activationsForChart,
  buildBodygraph,
  computeActivations,
} from "./bodygraph";

export type {
  ActivatedGate,
  Bodygraph,
  BoundarySignal,
  BuildBodygraphOptions,
  CenterState,
  DefinedChannel,
  DefinitionLabel,
  DefinitionRegion,
  DefinitionResult,
  GateLine,
  HangingGate,
  IncarnationCross,
  SourceCombination,
  VariableValue,
} from "./bodygraph";

/**
 * Convenience aliases for callers that only want the headline reading.
 *
 * These are derived, not duplicated: nothing here adds behaviour.
 */
export type HumanDesignResult = Bodygraph;
export type HumanDesignActivation = Activation;
