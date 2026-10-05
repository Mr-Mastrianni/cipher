"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface CosmogramProps {
  className?: string;
  /** 0–1. Drives ring brightness and the reveal of the inner spokes. */
  progress?: number;
  /** Adds a slow idle rotation to the outer ring. */
  animated?: boolean;
  /** Renders the activated gate dots, when a bodygraph is available. */
  activatedGates?: readonly number[];
}

/** The 64 gate positions around the wheel, evenly spaced. */
const GATE_ANGLES = Array.from({ length: 64 }, (_, i) => (i * 360) / 64 - 90);

/**
 * The cosmogram: three concentric rings, twelve zodiacal ticks, six gate dots
 * on the outer ring, and a single bone-coloured centre point. It is the app's
 * primary ornament and doubles as the drag target on the threshold screen.
 */
export function Cosmogram({
  className,
  progress = 0,
  animated = true,
  activatedGates,
}: CosmogramProps) {
  const reduced = useReducedMotion();
  const p = Math.max(0, Math.min(1, progress));

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
      style={{ transformOrigin: "center" }}
    >
      <defs>
        <radialGradient id="cosmo-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--c-gold)" stopOpacity="0.55" />
          <stop offset="60%" stopColor="var(--c-gold)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--c-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* core bloom, widens with progress */}
      <motion.circle
        cx="100"
        cy="100"
        r={40 + p * 30}
        fill="url(#cosmo-core)"
        initial={false}
        animate={{ opacity: 0.35 + p * 0.65 }}
        transition={{ duration: reduced ? 0 : 0.4 }}
      />

      {/* outer ring — gold */}
      <circle
        cx="100"
        cy="100"
        r="90"
        fill="none"
        stroke="var(--c-gold)"
        strokeWidth="0.75"
        opacity={0.35 + p * 0.45}
      />

      {/* middle ring — purple */}
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="var(--c-purple)"
        strokeWidth="0.75"
        opacity={0.3 + p * 0.4}
      />

      {/* inner ring — teal */}
      <circle
        cx="100"
        cy="100"
        r="42"
        fill="none"
        stroke="var(--c-teal)"
        strokeWidth="0.75"
        opacity={0.25 + p * 0.4}
      />

      {/* twelve sign ticks on the outer ring */}
      <g opacity={0.5 + p * 0.4}>
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 100 + Math.cos(angle) * 90;
          const y1 = 100 + Math.sin(angle) * 90;
          const x2 = 100 + Math.cos(angle) * 82;
          const y2 = 100 + Math.sin(angle) * 82;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--c-gold)"
              strokeWidth="0.6"
              opacity="0.65"
            />
          );
        })}
      </g>

      {/* 64 gate positions; activated ones light up */}
      <g>
        {GATE_ANGLES.map((deg, i) => {
          const angle = deg * (Math.PI / 180);
          const gate = i + 1;
          const isActive = activatedGates?.includes(gate) ?? false;
          const reveal = p > i / 64;
          return (
            <circle
              key={gate}
              cx={100 + Math.cos(angle) * 78}
              cy={100 + Math.sin(angle) * 78}
              r={isActive ? 2.2 : 1.1}
              fill={isActive ? "var(--c-gold)" : "var(--c-open-stroke)"}
              opacity={isActive ? 1 : reveal ? 0.55 : 0.18}
            />
          );
        })}
      </g>

      {/* six bodygate dots on the outer ring, as on the reference cosmogram */}
      <g fill="var(--c-gold)" opacity={0.4 + p * 0.6}>
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const angle = (deg - 90) * (Math.PI / 180);
          return (
            <circle
              key={deg}
              cx={100 + Math.cos(angle) * 90}
              cy={100 + Math.sin(angle) * 90}
              r="2.5"
            />
          );
        })}
      </g>

      {/* inner spokes, revealed with progress */}
      <g opacity={p * 0.5} stroke="var(--c-hairline)" strokeWidth="0.5">
        {Array.from({ length: 6 }, (_, i) => {
          const angle = ((i * 60 - 90) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1="100"
              y1="100"
              x2={100 + Math.cos(angle) * 42}
              y2={100 + Math.sin(angle) * 42}
            />
          );
        })}
      </g>

      {/* centre point */}
      <circle cx="100" cy="100" r="3" fill="var(--c-bone)" opacity={0.7 + p * 0.3} />

      {animated && !reduced && (
        <motion.g
          style={{ originX: "100px", originY: "100px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="190"
            cy="100"
            r="1.6"
            fill="var(--c-gold)"
            opacity={0.5 + p * 0.5}
          />
        </motion.g>
      )}
    </svg>
  );
}
