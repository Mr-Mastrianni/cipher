"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ZODIAC_SIGNS, SIGN_GLYPH, normalize } from "@/lib/astrology/zodiac";
import {
  POINT_GLYPH,
  POINT_NAME,
  aspectColor,
  aspectWeight,
} from "@/lib/astrology/glyphs";
import type { Aspect, NatalChart, PointKey } from "@/lib/astrology/types";
import { cn } from "@/lib/utils";

const SIZE = 640;
const CENTRE = SIZE / 2;
const R_OUTER = 296;
const R_SIGN_INNER = 254;
const R_HOUSE_OUTER = 250;
const R_HOUSE_INNER = 150;
const R_PLANET = 214;
const R_ASPECT = 146;
const R_DEGREE_TICK = 254;

/**
 * Convert an ecliptic longitude to a screen angle in radians.
 *
 * The Ascendant is anchored at 9 o'clock and longitude increases
 * counter-clockwise, which is the standard orientation of a Western chart
 * wheel: house 1 sits below the Ascendant, house 4 at the bottom.
 */
function angleFor(longitude: number, ascendant: number): number {
  const degrees = 180 + (normalize(longitude) - ascendant);
  return (degrees * Math.PI) / 180;
}

function pointOn(longitude: number, ascendant: number, radius: number) {
  const angle = angleFor(longitude, ascendant);
  // SVG y grows downward, so the sine term is subtracted to make increasing
  // angle read counter-clockwise on screen.
  return {
    x: CENTRE + radius * Math.cos(angle),
    y: CENTRE - radius * Math.sin(angle),
  };
}

/** Short label for a planet: glyph plus degrees within its sign. */
function planetLabel(longitude: number) {
  const lon = normalize(longitude);
  const deg = Math.floor(lon % 30);
  const min = Math.round(((lon % 30) - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

interface ChartWheelProps {
  chart: NatalChart;
  className?: string;
  /** Only draw these points; defaults to the traditional ten plus the angles. */
  points?: readonly PointKey[];
  /** Hide the aspect web for a cleaner print. */
  showAspects?: boolean;
  /** Highlight these points (hover sync with the position table). */
  highlight?: readonly PointKey[];
  onHoverPoint?: (key: PointKey | null) => void;
}

/**
 * A tropical natal chart wheel.
 *
 * Everything is inline SVG: it prints at any size, is readable by assistive
 * technology through the accompanying table, and needs no canvas or charting
 * dependency. Planets that would collide are pushed outward in tiers, which is
 * the same de-overlap strategy printed wheels use.
 */
export function ChartWheel({
  chart,
  className,
  points,
  showAspects = true,
  highlight,
  onHoverPoint,
}: ChartWheelProps) {
  const reduced = useReducedMotion();
  const ascendant =
    chart.positions.find((p) => p.key === "ascendant")?.longitude ?? 0;

  const shown = useMemo(() => {
    const allowed = new Set(points ?? chart.positions.map((p) => p.key));
    return chart.positions
      .filter((position) => allowed.has(position.key))
      .sort((a, b) => normalize(a.longitude) - normalize(b.longitude));
  }, [chart.positions, points]);

  // De-overlap: walk in longitude order and push any planet that sits within
  // 7° of the previous one out by one tier.
  const placed = useMemo(() => {
    const tiers: number[] = [];
    let lastLongitude = -Infinity;
    let tier = 0;
    for (const position of shown) {
      const longitude = normalize(position.longitude);
      if (longitude - lastLongitude < 9) tier = (tier + 1) % 3;
      else tier = 0;
      tiers.push(tier);
      lastLongitude = longitude;
    }
    return shown.map((position, index) => ({
      position,
      radius: R_PLANET - tiers[index] * 26,
    }));
  }, [shown]);

  const positionByKey = useMemo(() => {
    const map = new Map<PointKey, ReturnType<typeof pointOn>>();
    for (const item of placed) {
      map.set(
        item.position.key,
        pointOn(item.position.longitude, ascendant, item.radius),
      );
    }
    return map;
  }, [placed, ascendant]);

  const highlightSet = useMemo(() => new Set(highlight ?? []), [highlight]);

  const aspectsToDraw = showAspects
    ? chart.aspects.filter((aspect) => {
        const from = chart.positions.find((p) => p.key === aspect.from);
        const to = chart.positions.find((p) => p.key === aspect.to);
        return Boolean(from && to) && aspect.definition.major;
      })
    : [];

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Natal chart wheel"
    >
      <defs>
        <radialGradient id="wheel-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--c-gold)" stopOpacity="0.05" />
          <stop offset="70%" stopColor="var(--c-gold)" stopOpacity="0.01" />
          <stop offset="100%" stopColor="var(--c-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CENTRE} cy={CENTRE} r={R_OUTER} fill="url(#wheel-ground)" />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={R_OUTER}
        fill="none"
        stroke="var(--c-gold)"
        strokeWidth="1"
        opacity="0.65"
      />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={R_SIGN_INNER}
        fill="none"
        stroke="var(--c-line)"
        strokeWidth="0.8"
      />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={R_HOUSE_INNER}
        fill="none"
        stroke="var(--c-hairline)"
        strokeWidth="0.8"
      />

      {/* ── Zodiac ring ─────────────────────────────────────────────── */}
      <g>
        {ZODIAC_SIGNS.map((sign, index) => {
          const start = index * 30;
          const a = pointOn(start, ascendant, R_OUTER);
          const b = pointOn(start, ascendant, R_SIGN_INNER);
          const mid = pointOn(start + 15, ascendant, (R_OUTER + R_SIGN_INNER) / 2);
          return (
            <g key={sign}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--c-line)"
                strokeWidth="0.7"
                opacity="0.7"
              />
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="21"
                fill="var(--c-gold)"
                opacity="0.85"
              >
                {SIGN_GLYPH[sign]}
              </text>
            </g>
          );
        })}
      </g>

      {/* ── Degree ticks ────────────────────────────────────────────── */}
      <g>
        {Array.from({ length: 360 }, (_, degree) => {
          const major = degree % 10 === 0;
          const medium = degree % 5 === 0;
          if (!major && !medium) return null;
          const outer = pointOn(degree, ascendant, R_DEGREE_TICK);
          const inner = pointOn(
            degree,
            ascendant,
            R_DEGREE_TICK - (major ? 12 : 7),
          );
          return (
            <line
              key={degree}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="var(--c-line)"
              strokeWidth={major ? 0.7 : 0.45}
              opacity={major ? 0.75 : 0.42}
            />
          );
        })}
      </g>

      {/* ── Angles and house cusps ──────────────────────────────────── */}
      <g>
        {chart.houses.cusps.map((cusp, index) => {
          const outer = pointOn(cusp, ascendant, R_HOUSE_OUTER);
          const inner = pointOn(cusp, ascendant, R_HOUSE_INNER);
          const isAngle = index % 3 === 0; // 1st, 4th, 7th, 10th
          const nextCusp =
            chart.houses.cusps[(index + 1) % 12] ?? cusp + 30;
          let span = normalize(nextCusp) - normalize(cusp);
          if (span <= 0) span += 360;
          const label = pointOn(
            normalize(cusp) + span / 2,
            ascendant,
            R_HOUSE_INNER + 20,
          );
          return (
            <g key={`cusp-${index}`}>
              <line
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={isAngle ? "var(--c-gold)" : "var(--c-line)"}
                strokeWidth={isAngle ? 1.5 : 0.7}
                opacity={isAngle ? 0.95 : 0.6}
                strokeDasharray={isAngle ? undefined : "4 5"}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
                fontFamily="var(--font-jetbrains), monospace"
                fill={isAngle ? "var(--c-gold)" : "var(--c-faint)"}
                opacity="0.8"
              >
                {index + 1}
              </text>
            </g>
          );
        })}
      </g>

      {/* ── Aspect web ──────────────────────────────────────────────── */}
      {showAspects && (
        <g>
          {aspectsToDraw.map((aspect: Aspect, index) => {
            const from = positionByKey.get(aspect.from);
            const to = positionByKey.get(aspect.to);
            if (!from || !to) return null;
            const start = pointOn(
              chart.positions.find((p) => p.key === aspect.from)?.longitude ?? 0,
              ascendant,
              R_ASPECT,
            );
            const end = pointOn(
              chart.positions.find((p) => p.key === aspect.to)?.longitude ?? 0,
              ascendant,
              R_ASPECT,
            );
            return (
              <motion.line
                key={`${aspect.from}-${aspect.to}-${aspect.definition.key}-${index}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={aspectColor(aspect.definition)}
                strokeWidth={aspectWeight(aspect.definition)}
                opacity={0.24 + aspect.strength * 0.4}
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.24 + aspect.strength * 0.4 }}
                transition={{
                  duration: 0.8,
                  delay: reduced ? 0 : index * 0.012,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            );
          })}
        </g>
      )}

      {/* ── Planets ─────────────────────────────────────────────────── */}
      <g>
        {placed.map(({ position, radius }, index) => {
          const anchor = pointOn(position.longitude, ascendant, radius);
          const tick = pointOn(position.longitude, ascendant, R_HOUSE_INNER);
          const isHighlighted = highlightSet.has(position.key);
          const isAngle =
            position.key === "ascendant" ||
            position.key === "midheaven" ||
            position.key === "descendant" ||
            position.key === "imumCoeli";
          const label = planetLabel(position.longitude);
          const toLeft = anchor.x < CENTRE;
          return (
            <motion.g
              key={position.key}
              initial={reduced ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.45,
                delay: reduced ? 0 : 0.3 + index * 0.035,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ originX: `${anchor.x}px`, originY: `${anchor.y}px` }}
              onMouseEnter={() => onHoverPoint?.(position.key)}
              onMouseLeave={() => onHoverPoint?.(null)}
              onFocus={() => onHoverPoint?.(position.key)}
              onBlur={() => onHoverPoint?.(null)}
              tabIndex={0}
              role="button"
              aria-label={`${POINT_NAME[position.key]} at ${label}${position.retrograde ? ", retrograde" : ""}`}
              className="cursor-pointer outline-none"
            >
              <line
                x1={tick.x}
                y1={tick.y}
                x2={anchor.x}
                y2={anchor.y}
                stroke="var(--c-hairline)"
                strokeWidth="0.7"
              />
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={isHighlighted ? 15 : 0}
                fill="var(--c-gold)"
                opacity="0.16"
              />
              <text
                x={anchor.x}
                y={anchor.y - 3}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isAngle ? 14 : 19}
                fill={isAngle ? "var(--c-gold)" : "var(--c-bone)"}
                fontWeight={isHighlighted ? 700 : 500}
              >
                {POINT_GLYPH[position.key]}
                {position.retrograde && !isAngle ? "℞" : ""}
              </text>
              <text
                x={toLeft ? anchor.x - 13 : anchor.x + 13}
                y={anchor.y}
                textAnchor={toLeft ? "end" : "start"}
                dominantBaseline="central"
                fontSize="10.5"
                fontFamily="var(--font-jetbrains), monospace"
                fill="var(--c-faint)"
              >
                {label}
              </text>
            </motion.g>
          );
        })}
      </g>

      {/* ── Centre marks ────────────────────────────────────────────── */}
      <g opacity="0.5">
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={52}
          fill="none"
          stroke="var(--c-hairline)"
          strokeWidth="0.7"
        />
        <text
          x={CENTRE}
          y={CENTRE - 8}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--font-jetbrains), monospace"
          fill="var(--c-faint)"
        >
          {chart.houses.requestedSystem.toUpperCase()}
        </text>
        <text
          x={CENTRE}
          y={CENTRE + 10}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="var(--font-jetbrains), monospace"
          fill="var(--c-faint)"
        >
          {chart.houses.fallback ? "portrait fallback" : "houses"}
        </text>
      </g>
    </svg>
  );
}
