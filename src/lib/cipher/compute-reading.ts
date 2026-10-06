/**
 * The shared reading pipeline.
 *
 * A reading is one deterministic function of one birth input, so it must be
 * computed by exactly one code path. Both `POST /api/chart` and the
 * `/reading/[code]` server component call {@link computeReading}; if the two
 * ever diverged, a shared link would disagree with the API response that
 * produced it.
 *
 * Everything here is pure and synchronous apart from the ephemeris work, which
 * is CPU-bound and local: no database, no network, no secrets. That is what
 * lets a visitor receive a full reading with nothing configured.
 */

import { computeNatalChart } from "@/lib/astrology/chart";
import { resolveBirthInstantDetailed } from "@/lib/astrology/time";
import type { BirthInput, NatalChart } from "@/lib/astrology/types";
import { CHANNEL_BY_GATES, type CenterKey } from "@/lib/human-design/constants";
import { computeHumanDesign } from "@/lib/human-design";
import type { Bodygraph } from "@/lib/human-design";
import { computeAuraAvatar, type AuraAvatar } from "@/lib/cipher/aura-avatar";
import {
  categorizeMember,
  categoryChips,
  summariseCategory,
  type CategorizationInput,
  type MemberCategory,
} from "@/lib/cipher/categorization";
import { encodeBirthInput } from "@/lib/cipher/share-code";
import type { BodygraphVisualization } from "@/components/cipher/bodygraph";

/** Everything the reveal screen and the chart API both need, computed once. */
export interface Reading {
  input: BirthInput;
  /** The share code for exactly this input. */
  code: string;
  chart: NatalChart;
  bodygraph: Bodygraph;
  /** `null` only if the ephemeris produced no usable Personality Sun. */
  avatar: AuraAvatar | null;
  category: MemberCategory;
  /** One-sentence placement summary for the reveal header. */
  summary: string;
  /** Compact tags for the summary row. */
  chips: string[];
  /** The bodygraph in the shape the SVG component consumes. */
  visualization: BodygraphVisualization;
  /** Time resolution + chart + bodygraph warnings, in that order. */
  warnings: string[];
  /** Warnings produced while resolving the wall clock to a UTC instant. */
  timeWarnings: string[];
  /** True when the requested house system had to be swapped for a fallback. */
  houseFallback: boolean;
}

/**
 * Adapt the engine's bodygraph to the SVG component's input.
 *
 * The engine describes the graph (channels, centre states, aggregations); the
 * renderer wants a flat node/edge/centre list. Keeping the mapping here rather
 * than in the component means the API and the page share one definition of
 * "what is drawn", and the renderer stays ignorant of engine internals.
 *
 * @param bodygraph - A computed bodygraph.
 * @returns Nodes (one per activation), defined channels, and defined centres.
 */
export function toVisualization(bodygraph: Bodygraph): BodygraphVisualization {
  const nodes = bodygraph.activations.map((activation) => ({
    gate: activation.gate,
    line: activation.line,
    source: activation.source,
  }));

  const edges = bodygraph.channels.map((channel) => ({
    gates: channel.gates,
    source: channel.sources,
  }));

  const definedCenters = (Object.keys(bodygraph.centers) as CenterKey[]).filter(
    (key) => bodygraph.centers[key].defined,
  );

  return { nodes, edges, definedCenters };
}

/** The categoriser's structural view of a bodygraph, in one place. */
function categorizationInput(bodygraph: Bodygraph): CategorizationInput {
  return {
    type: bodygraph.type,
    authority: bodygraph.authority,
    profile: bodygraph.profile,
    definition: bodygraph.definition.label,
    centers: bodygraph.centers,
    channels: bodygraph.channels.map((channel) => ({
      gates: channel.gates,
      // The engine's channel records omit circuitry because it is not needed to
      // build the graph; the categoriser needs it, so it is read back from the
      // canonical channel table by key.
      circuit: CHANNEL_BY_GATES.get(channel.key)?.circuit ?? "collective",
    })),
    gates: bodygraph.gates.map((gate) => gate.gate),
  };
}

/**
 * Compute the complete reading for a birth input.
 *
 * Pipeline, in order: resolve the wall clock to a UTC instant (reporting DST
 * gaps and folds rather than hiding them), compute the Western tropical chart,
 * compute the Human Design bodygraph from that instant, derive the Aura Avatar,
 * then place the member into a cohort, archetype and lane.
 *
 * @param input - Birth date, time, timezone and coordinates.
 * @returns The reading, its share code, and every warning produced on the way.
 * @throws RangeError if the timezone is unknown or a field is out of range, and
 *   whatever the ephemeris throws if a body cannot be resolved. Callers must
 *   treat a throw as an invalid input rather than papering over it.
 */
export function computeReading(input: BirthInput): Reading {
  const { date, warnings: timeWarnings } = resolveBirthInstantDetailed(input);

  const chart = computeNatalChart(input);
  const bodygraph = computeHumanDesign(date);

  const openCentres = (Object.keys(bodygraph.centers) as CenterKey[]).filter(
    (key) => !bodygraph.centers[key].defined,
  );

  const avatar = computeAuraAvatar(
    bodygraph.incarnationCross.personalitySun,
    bodygraph.activations.map((activation) => ({
      gate: activation.gate,
      line: activation.line,
      source: activation.source,
      body: activation.body,
    })),
    bodygraph.incarnationCross.designSun,
    openCentres,
  );

  const structural = categorizationInput(bodygraph);
  const category = categorizeMember(structural, avatar);

  return {
    input,
    code: encodeBirthInput(input),
    chart,
    bodygraph,
    avatar,
    category,
    summary: summariseCategory(category, {
      type: bodygraph.type,
      authority: bodygraph.authority,
      profile: bodygraph.profile,
    }),
    chips: categoryChips(structural),
    visualization: toVisualization(bodygraph),
    // `chart.warnings` already begins with the time-resolution warnings.
    warnings: [...chart.warnings, ...bodygraph.warnings],
    timeWarnings,
    houseFallback: chart.houses.fallback,
  };
}

/**
 * The JSON-safe projection of a reading, used by `POST /api/chart`.
 *
 * `Response.json` would serialise the `Date` fields anyway, but naming the
 * conversion here makes the wire contract explicit and keeps the route free of
 * serialisation trivia. Dates become ISO-8601 strings; nothing else changes.
 */
export interface ReadingPayload {
  ok: true;
  code: string;
  chart: NatalChart;
  bodygraph: Bodygraph;
  avatar: AuraAvatar | null;
  category: MemberCategory;
  warnings: string[];
}

/**
 * Project a reading onto the API response shape.
 *
 * @param reading - A computed reading.
 * @returns The payload returned by `POST /api/chart`.
 */
export function readingPayload(reading: Reading): ReadingPayload {
  return {
    ok: true,
    code: reading.code,
    chart: reading.chart,
    bodygraph: reading.bodygraph,
    avatar: reading.avatar,
    category: reading.category,
    warnings: reading.warnings,
  };
}
