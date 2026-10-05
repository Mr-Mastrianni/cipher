import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Spinner scale. */
export type SpinnerSize = "sm" | "md" | "lg";

const SIZES: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
};

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Diameter. Defaults to `md`. */
  size?: SpinnerSize;
  /** Announced to assistive tech. Defaults to "Loading". */
  label?: string;
}

/** An accessible loading indicator that announces itself via `role="status"`. */
export function Spinner({
  size = "md",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center justify-center text-gold", className)}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={cn("animate-spin", SIZES[size])}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="2.5"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
