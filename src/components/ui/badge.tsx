import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Semantic colour family for a badge. */
export type BadgeTone =
  | "neutral"
  | "gold"
  | "purple"
  | "teal"
  | "ok"
  | "warn"
  | "danger"
  | "info";

/** Badge scale. */
export type BadgeSize = "sm" | "md";

const TONE_VAR: Record<BadgeTone, string> = {
  neutral: "--c-muted",
  gold: "--c-gold",
  purple: "--c-purple",
  teal: "--c-teal",
  ok: "--c-ok",
  warn: "--c-warn",
  danger: "--c-danger",
  info: "--c-info",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "gap-1 px-2 py-0.5 text-[9px]",
  md: "gap-1.5 px-2.5 py-1 text-[10px]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Colour family. Defaults to `neutral`. */
  tone?: BadgeTone;
  /** Pill scale. Defaults to `md`. */
  size?: BadgeSize;
}

/**
 * A small pill label. Its tint, border, and text colour are derived from a
 * single theme token with `color-mix`, so every theme re-skins it for free.
 */
export function Badge({
  tone = "neutral",
  size = "md",
  className,
  style,
  ...props
}: BadgeProps) {
  const token = `var(${TONE_VAR[tone]})`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-mono uppercase leading-none tracking-[0.16em]",
        SIZES[size],
        className,
      )}
      style={{
        color: token,
        backgroundColor: `color-mix(in srgb, ${token} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${token} 34%, transparent)`,
        ...style,
      }}
      {...props}
    />
  );
}
