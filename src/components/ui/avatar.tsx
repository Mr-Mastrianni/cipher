"use client";

import { useState, type HTMLAttributes } from "react";
import { cn, hashString, initials } from "@/lib/utils";

/** Avatar scale. */
export type AvatarSize = "xs" | "sm" | "md" | "lg";

/** Optional presence indicator. */
export type AvatarPresence = "online" | "away" | "offline";

const SIZES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
};

const PRESENCE: Record<AvatarPresence, string> = {
  online: "bg-ok",
  away: "bg-warn",
  offline: "bg-faint",
};

/** Theme accents a name can be mapped onto — no colour literals in the kit. */
const ACCENTS = [
  "--c-gold",
  "--c-purple",
  "--c-teal",
  "--c-rose",
  "--c-fire",
  "--c-earth",
  "--c-air",
  "--c-water",
  "--c-info",
] as const;

const PRESENCE_LABEL: Record<AvatarPresence, string> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
};

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Person's name: drives the initials, the accessible name, and the colour. */
  name: string;
  /** Optional image URL; falls back to initials when missing or broken. */
  src?: string | null;
  /** Diameter. Defaults to `md`. */
  size?: AvatarSize;
  /** Optional presence dot. */
  presence?: AvatarPresence;
}

/**
 * An avatar with an initials fallback whose tint is derived deterministically
 * from the name, so the same person keeps the same colour everywhere.
 */
export function Avatar({
  name,
  src,
  size = "md",
  presence,
  className,
  ...props
}: AvatarProps) {
  // Tracking the failed source (rather than a boolean) means a new `src`
  // automatically retries without an effect or a state reset.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const accent = ACCENTS[hashString(name) % ACCENTS.length];
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border font-mono font-medium uppercase tracking-wide",
        SIZES[size],
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              borderColor: `color-mix(in srgb, var(${accent}) 48%, transparent)`,
              backgroundColor: `color-mix(in srgb, var(${accent}) 16%, transparent)`,
              color: `var(${accent})`,
            }
      }
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are supplied at runtime
        <img
          src={src ?? ""}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? "")}
          className="h-full w-full object-cover"
        />
      ) : (
        <span role="img" aria-label={name}>
          {initials(name) || "?"}
        </span>
      )}
      {presence ? (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-void",
              PRESENCE[presence],
            )}
          />
          <span className="sr-only">{PRESENCE_LABEL[presence]}</span>
        </>
      ) : null}
    </span>
  );
}
