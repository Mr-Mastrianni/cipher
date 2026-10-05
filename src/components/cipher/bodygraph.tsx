"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CENTER_MAP,
  GATE_TO_CENTER,
  type CenterKey,
} from "@/lib/human-design/constants";
import {
  BODYGRAPH_VIEWBOX,
  CENTER_SHAPES,
  GATE_POSITIONS,
  polygonPoints,
} from "@/lib/human-design/bodygraph-layout";
import { cn } from "@/lib/utils";

export interface BodygraphNode {
  gate: number;
  line: number;
  source: "personality" | "design" | "both";
}

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

  const nodeByGate = useMemo(() => {
    const map = new Map<number, BodygraphNode>();
    for (const node of data.nodes) {
      const existing = map.get(node.gate);
      if (!existing || existing.source !== "both") {
        map.set(node.gate, existing && existing.source !== node.source
          ? { ...node, source: "both" }
          : node);
      }
    }
    return map;
  }, [data.nodes]);

  const defined = useMemo(
    () => new Set(data.definedCenters),
    [data.definedCenters],
  );

  const definedEdges = data.edges.filter((edge) => edge.gates.length === 2);

  return (
    <svg
      viewBox={`0 0 ${BODYGRAPH_VIEWBOX.width} ${BODYGRAPH_VIEWBOX.height}`}
      className={cn("h-auto w-full max-w-md", className)}
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
      </defs>

      {/* ── Channels ─────────────────────────────────────────────────── */}
      <g fill="none" strokeLinecap="round">
        {definedEdges.map((edge, index) => {
          const [a, b] = edge.gates;
          const from = GATE_POSITIONS[a];
          const to = GATE_POSITIONS[b];
          if (!from || !to) return null;
          const key = `${a}-${b}`;
          const stroke = SOURCE_COLOR[edge.source] ?? "var(--c-channel-edge)";
          const line = (
            <line
              x1={from[0]}
              y1={from[1]}
              x2={to[0]}
              y2={to[1]}
              stroke={stroke}
              strokeWidth={7}
              opacity={0.92}
            />
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
            fill: isDefined
              ? "color-mix(in srgb, var(--c-defined) 26%, var(--c-void))"
              : "var(--c-void)",
            stroke: isDefined ? "var(--c-defined-hi)" : "var(--c-open-stroke)",
            strokeWidth: isDefined ? 1.6 : 1,
            strokeLinejoin: "round" as const,
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
            const node = nodeByGate.get(gate);
            const isActive = Boolean(node);
            const centre = GATE_TO_CENTER[gate];
            const centreDefined = centre ? defined.has(centre) : false;
            return (
              <text
                key={gate}
                x={position[0]}
                y={position[1]}
                fill={
                  isActive
                    ? "var(--c-bone)"
                    : centreDefined
                      ? "var(--c-muted)"
                      : "var(--c-faint)"
                }
                fontWeight={isActive ? 600 : 400}
                opacity={isActive ? 1 : 0.75}
              >
                {gate}
              </text>
            );
          })}
        </g>
      )}

      {/* ── Activation dots: personality above, design below ─────────── */}
      <g>
        {data.nodes.map((node) => {
          const position = GATE_POSITIONS[node.gate];
          if (!position) return null;
          const [x, y] = position;
          const showLeft = node.source === "design" || node.source === "both";
          const showRight = node.source === "personality" || node.source === "both";
          return (
            <g key={`${node.gate}-${node.source}`}>
              {showLeft && (
                <circle cx={x - 13} cy={y} r={2.6} fill="var(--c-src-design)" />
              )}
              {showRight && (
                <circle cx={x + 13} cy={y} r={2.6} fill="var(--c-src-personality)" />
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
