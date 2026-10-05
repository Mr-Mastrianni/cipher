"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { AuraAvatar } from "@/lib/cipher/aura-avatar";

interface AuraAvatarCardProps {
  avatar: AuraAvatar;
  /** The person's display name, if they have given one. */
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Fires the reveal animation and a sound cue. */
  animate?: boolean;
}

const SIZES = {
  sm: {
    seat: "text-2xl sm:text-3xl",
    format: "text-lg sm:text-xl",
    pad: "p-5",
    coordinate: "text-[9px]",
  },
  md: {
    seat: "text-4xl sm:text-5xl",
    format: "text-2xl sm:text-3xl",
    pad: "p-8",
    coordinate: "text-[10px]",
  },
  lg: {
    seat: "text-5xl sm:text-7xl",
    format: "text-3xl sm:text-4xl",
    pad: "p-10 sm:p-14",
    coordinate: "text-xs",
  },
} as const;

/**
 * The Aura Avatar card — two words, the gate they came from, and the line
 * count behind the format. Designed to be screenshotted, so it carries the
 * wordmark and no interactive chrome.
 */
export function AuraAvatarCard({
  avatar,
  name,
  className,
  size = "md",
  animate = true,
}: AuraAvatarCardProps) {
  const reduced = useReducedMotion();
  const play = animate && !reduced;
  const scale = SIZES[size];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gold/30 bg-ink",
        scale.pad,
        className,
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--c-gold) 12%, transparent) 0%, transparent 62%)",
      }}
    >
      {/* corner rule marks */}
      <span
        aria-hidden="true"
        className="absolute left-4 top-4 h-4 w-4 border-l border-t border-gold/35"
      />
      <span
        aria-hidden="true"
        className="absolute right-4 top-4 h-4 w-4 border-r border-t border-gold/35"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-4 left-4 h-4 w-4 border-b border-l border-gold/35"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-4 right-4 h-4 w-4 border-b border-r border-gold/35"
      />

      <div className="relative flex flex-col items-center text-center">
        <p className="font-mono text-[9px] uppercase tracking-[0.34em] text-faint">
          The Cipher
        </p>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
          Aura Avatar
        </p>

        <h2 className={cn("mt-5 font-display leading-none text-bone", scale.seat)}>
          <motion.span
            className="block"
            initial={play ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {avatar.seat}
          </motion.span>
          <motion.span
            className="mt-1 block text-gradient-gold"
            initial={play ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: play ? 0.16 : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {avatar.format}
          </motion.span>
        </h2>

        <div className="rule mt-7 w-full max-w-xs" />

        <p
          className={cn(
            "mt-5 font-mono uppercase tracking-[0.18em] text-faint",
            scale.coordinate,
          )}
        >
          {avatar.coordinate}
        </p>

        {name && (
          <p className="mt-4 font-display text-sm tracking-wide text-muted">
            {name}
          </p>
        )}

        <p className="mt-6 max-w-sm text-pretty text-xs leading-relaxed text-muted">
          {avatar.formatNote}
        </p>

        {avatar.contested && (
          <p className="mt-4 max-w-sm text-[10px] leading-relaxed text-warn/80">
            Your lines are evenly split, so the format is a close call. Read the
            seat as the stronger signal.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A compact inline chip version, for headers and lists.
 */
export function AuraAvatarChip({
  avatar,
  className,
}: {
  avatar: AuraAvatar;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/8 px-3 py-1",
        className,
      )}
    >
      <span className="font-display text-xs tracking-wide text-bone">
        {avatar.seat}
      </span>
      <span className="font-display text-xs tracking-wide text-gold">
        {avatar.format}
      </span>
    </span>
  );
}
