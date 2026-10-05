import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Corner rounding of a skeleton block. */
export type SkeletonRounding = "sm" | "md" | "lg" | "full";

const ROUNDING: Record<SkeletonRounding, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Corner rounding. Defaults to `md`. */
  rounded?: SkeletonRounding;
}

/** A shimmering placeholder block used while content loads. */
export function Skeleton({
  rounded = "md",
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-raised",
        ROUNDING[rounded],
        className,
      )}
      {...props}
    >
      <span
        className="animate-shimmer absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--c-bone) 9%, transparent), transparent)",
          backgroundSize: "180% 100%",
        }}
      />
    </div>
  );
}
