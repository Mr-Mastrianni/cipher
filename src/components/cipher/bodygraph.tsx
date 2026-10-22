"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CENTER_MAP,
  CHANNELS,
  GATE_TO_CENTER,
  type CenterKey,
} from "@/lib/human-design/constants";
import {
  BODYGRAPH_VIEWBOX,
  BODY_SILHOUETTE,
  CENTER_SHAPES,
  GATE_POSITIONS,
  polygonPoints,
} from "@/lib/human-design/bodygraph-layout";
import {
  activationMarkers,
  type ActivationMarker,
} from "@/lib/human-design/activation-markers";
import { cn } from "@/lib/utils";

/** One activation, as handed to the renderer (one per planet, before collapse). */
export type BodygraphNode = ActivationMarker;

export interface BodygraphEdge {
  gates: readonly [number, number];
  source: "personality" | "design" | "both";
}

export interface BodygraphVisualization {
  nodes: readonly BodygraphNode[];
  edges: readonly BodygraphEdge[];
  definedCenters: readonly CenterKey[];
}

interface BodygraphProps {
  data: BodygraphVisualization;
  className?: string;
  /** Run the staged reveal animation. */
  animate?: boolean;
  /** Fires as each defined centre lights up. */
  onCenterLit?: (center: CenterKey) => void;
  /** Hide the numbers for a pure shape read. */
  showGates?: boolean;
}

const SOURCE_COLOR: Record<string, string> = {
  personality: "var(--c-src-personality)",
  design: "var(--c-src-design)",
  both: "var(--c-src-both)",
};

/**
 * The bodygraph.
 *
 * Rendered as inline SVG so it stays crisp at any size, is printable, and can
 * be read by assistive technology. The definition lights up centre by centre
 * on first view — six of the nine centres at most, so the reveal stays short.
 */
export function Bodygraph({
  data,
  className,
  animate = true,
  onCenterLit,
  showGates = true,
}: BodygraphProps) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;

  // One marker per gate: several planets can share a gate on the same side
  // (Sun and Mercury in gate 60 is ordinary), and drawing the raw activation
  // list put duplicate dots — and duplicate React keys — on the same spot.
  const markers = useMemo(() => activationMarkers(data.nodes), [data.nodes]);

  const markerByGate = useMemo(
    () => new Map(markers.map((marker) => [marker.gate, marker])),
    [markers],
  );

  const defined = useMemo(
    () => new Set(data.definedCenters),
    [data.definedCenters],
  );

  const definedEdges = data.edges.filter((edge) => edge.gates.length === 2);

  return (
    <svg
      viewBox={`0 0 ${BODYGRAPH_VIEWBOX.width} ${BODYGRAPH_VIEWBOX.height}`}
      className={cn("h-auto w-full max-w-xl", className)}
      role="img"
      aria-label={`Bodygraph with ${defined.size} of 9 centres defined and ${definedEdges.length} channels`}
    >
      <defs>
        <filter id="bg-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* A single soft aura behind the whole figure. Kept faint: it should
            read as depth, not as a light show. */}
        <radialGradient id="bg-aura" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="var(--c-defined)" stopOpacity="0.16" />
          <stop offset="62%" stopColor="var(--c-defined)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--c-void)" stopOpacity="0" />
        </radialGradient>

        {/* Defined centres get a vertical wash so they read as lit from above. */}
        <linearGradient id="bg-center-defined" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-defined-hi)" stopOpacity="0.52" />
          <stop offset="100%" stopColor="var(--c-defined)" stopOpacity="0.2" />
        </linearGradient>

        <filter id="bg-dot-glow" x="-160%" y="-160%" width="420%" height="420%">
          <feGaussianBlur stdDeviation="2.2" result="dotBlur" />
          <feMerge>
            <feMergeNode in="dotBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Aura and silhouette ──────────────────────────────────────── */}
      <rect
        x="0"
        y="0"
        width={BODYGRAPH_VIEWBOX.width}
        height={BODYGRAPH_VIEWBOX.height}
        fill="url(#bg-aura)"
      />
      <path
        d={BODY_SILHOUETTE}
        fill="var(--c-bone)"
        fillOpacity={0.025}
        stroke="var(--c-hairline)"
        strokeOpacity={0.7}
        strokeWidth={1.2}
      />

      {/* ── The channel skeleton ─────────────────────────────────────── */}
      {/* Every bodygraph prints all 36 channels; only the defined ones carry
          colour. Without the skeleton the chart reads as a few floating wires
          instead of a body, because an average design defines 3-5 of them. */}
      <g fill="none" strokeLinecap="round">
        {CHANNELS.map((channel) => {
          const [a, b] = channel.gates;
          const from = GATE_POSITIONS[a];
          const to = GATE_POSITIONS[b];
          if (!from || !to) return null;
          return (
            <line
              key={`skeleton-${channel.gates[0]}-${channel.gates[1]}`}
              x1={from[0]}
              y1={from[1]}
              x2={to[0]}
              y2={to[1]}
              // `--c-open` rather than `--c-open-stroke`: the skeleton is
              // structure, not a highlight, and at 0.34 opacity on the indigo
              // ground it was invisible. This reads as a body outline while
              // still letting the defined channels dominate.
              stroke="var(--c-open)"
              strokeWidth={3.6}
              opacity={0.72}
            />
          );
        })}
      </g>

      {/* ── Defined channels ─────────────────────────────────────────── */}
      <g fill="none" strokeLinecap="round">
        {definedEdges.map((edge, index) => {
          const [a, b] = edge.gates;
          const from = GATE_POSITIONS[a];
          const to = GATE_POSITIONS[b];
          if (!from || !to) return null;
          const key = `${a}-${b}`;
          const stroke = SOURCE_COLOR[edge.source] ?? "var(--c-channel-edge)";
          const line = (
            <g>
              {/* A void-coloured underlay keeps two crossing channels legible
                  as separate ribbons rather than one merged blob. */}
              <line
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                stroke="var(--c-void)"
                strokeWidth={11}
              />
              <line
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                stroke={stroke}
                strokeWidth={7}
                opacity={0.95}
              />
            </g>
          );
          if (!shouldAnimate) return <g key={key}>{line}</g>;
          return (
            <motion.g
              key={key}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.42, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
            >
              {line}
            </motion.g>
          );
        })}
      </g>

      {/* ── Centres ──────────────────────────────────────────────────── */}
      <g>
        {(Object.keys(CENTER_SHAPES) as CenterKey[]).map((key, index) => {
          const shape = CENTER_SHAPES[key];
          const isDefined = defined.has(key);
          const common = {
            fill: isDefined ? "url(#bg-center-defined)" : "var(--c-void)",
            stroke: isDefined ? "var(--c-defined-hi)" : "var(--c-open-stroke)",
            strokeWidth: isDefined ? 1.8 : 1,
            strokeLinejoin: "round" as const,
            filter: isDefined ? "url(#bg-glow)" : undefined,
          };
          const shapeEl =
            shape.kind === "polygon" ? (
              <polygon points={polygonPoints(shape)} {...common} />
            ) : (
              <rect
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={6}
                {...common}
              />
            );
          if (!shouldAnimate) {
            return <g key={key}>{shapeEl}</g>;
          }
          return (
            <motion.g
              key={key}
              initial={{ opacity: isDefined ? 0 : 1, scale: isDefined ? 0.94 : 1 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ originX: "250px", originY: "400px" }}
              transition={{
                duration: 0.5,
                delay: isDefined ? 0.28 + 0.08 * index : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={() => {
                if (isDefined) onCenterLit?.(key);
              }}
            >
              {shapeEl}
            </motion.g>
          );
        })}
      </g>

      {/* ── Gates ────────────────────────────────────────────────────── */}
      {showGates && (
        <g
          fontFamily="var(--font-jetbrains), monospace"
          fontSize={13}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {Array.from({ length: 64 }, (_, i) => i + 1).map((gate) => {
            const position = GATE_POSITIONS[gate];
            if (!position) return null;
            const node = markerByGate.get(gate);
            const isActive = Boolean(node);
            const centre = GATE_TO_CENTER[gate];
            const centreDefined = centre ? defined.has(centre) : false;
            return (
              <text
                key={gate}
                x={position[0]}
                y={position[1]}
                fill={
                  node
                    ? node.source === "both"
                      ? "var(--c-src-both)"
                      : node.source === "design"
                        ? "var(--c-src-design)"
                        : "var(--c-src-personality)"
                    : centreDefined
                      ? "var(--c-muted)"
                      : "var(--c-faint)"
                }
                fontWeight={isActive ? 600 : 400}
                opacity={isActive ? 1 : 0.75}
                // The numbers sit on the centre edges, so a void-coloured halo
                // keeps them readable where a channel passes behind them.
                stroke="var(--c-void)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {gate}
              </text>
            );
          })}
        </g>
      )}

      {/* ── Activation dots: design left of the gate, personality right ── */}
      <g>
        {markers.map((marker) => {
          const position = GATE_POSITIONS[marker.gate];
          if (!position) return null;
          const [x, y] = position;
          const showLeft = marker.source === "design" || marker.source === "both";
          const showRight =
            marker.source === "personality" || marker.source === "both";
          return (
            // One marker per gate, so the gate is a stable unique key.
            <g key={marker.gate}>
              {showLeft && (
                <circle
                  cx={x - 13}
                  cy={y}
                  r={3.1}
                  fill="var(--c-src-design)"
                  filter="url(#bg-dot-glow)"
                />
              )}
              {showRight && (
                <circle
                  cx={x + 13}
                  cy={y}
                  r={3.1}
                  fill="var(--c-src-personality)"
                  filter="url(#bg-dot-glow)"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * The bodygraph is decorative-but-informative: screen readers get a proper
 * text equivalent rather than a wall of numbers.
 */
export function BodygraphTextSummary({
  data,
  className,
}: {
  data: BodygraphVisualization;
  className?: string;
}) {
  const defined = data.definedCenters.map((key) => CENTER_MAP[key].name);
  const all = Object.values(CENTER_MAP).map((centre) => centre.name);
  const open = all.filter((name) => !defined.includes(name));
  return (
    <div className={cn("space-y-2 text-sm text-muted", className)}>
      <p>
        <span className="text-bone">Defined centres:</span>{" "}
        {defined.length ? defined.join(", ") : "none"}
      </p>
      <p>
        <span className="text-bone">Open centres:</span>{" "}
        {open.length ? open.join(", ") : "none"}
      </p>
      <p>
        <span className="text-bone">Defined channels:</span>{" "}
        {data.edges.length
          ? data.edges.map((edge) => edge.gates.join("–")).join(", ")
          : "none"}
      </p>
    </div>
  );
}
