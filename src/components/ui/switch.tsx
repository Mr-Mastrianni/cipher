"use client";

import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { cue } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

/** Switch scale. */
export type SwitchSize = "sm" | "md";

interface SizeSpec {
  track: string;
  knob: string;
  top: string;
  off: number;
  on: number;
}

const SIZES: Record<SwitchSize, SizeSpec> = {
  sm: { track: "h-4 w-7", knob: "h-3 w-3", top: "top-[2px]", off: 2, on: 16 },
  md: { track: "h-5 w-9", knob: "h-3.5 w-3.5", top: "top-[3px]", off: 3, on: 18 },
};

export interface SwitchProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value" | "children"
  > {
  /** Current state. */
  checked: boolean;
  /** Called with the next state on click, Space, or Enter. */
  onCheckedChange?: (checked: boolean) => void;
  /** Track scale. Defaults to `md`. */
  size?: SwitchSize;
  /** Visible label; wired up with `aria-labelledby`. */
  label?: ReactNode;
  /** Secondary copy rendered under the label. */
  description?: ReactNode;
}

/**
 * A settings toggle exposed as a real button with `role="switch"`. The knob
 * springs between positions unless the visitor has asked for reduced motion,
 * in which case it snaps instantly.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    className,
    checked,
    onCheckedChange,
    size = "md",
    label,
    description,
    disabled,
    onClick,
    ...props
  },
  ref,
) {
  const reduced = useReducedMotion();
  const generatedId = useId();
  const labelId = `switch-${generatedId}`;
  const spec = SIZES[size];
  const offset = checked ? spec.on : spec.off;

  const control = (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      disabled={disabled}
      onClick={(event) => {
        cue("select");
        onClick?.(event);
        onCheckedChange?.(!checked);
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed disabled:opacity-45",
        spec.track,
        checked ? "border-gold bg-gold" : "border-line bg-raised",
        className,
      )}
      {...props}
    >
      {reduced ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute rounded-full",
            spec.knob,
            spec.top,
            checked ? "bg-on-accent" : "bg-muted",
          )}
          style={{ transform: `translateX(${offset}px)` }}
        />
      ) : (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ x: offset }}
          transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.5 }}
          className={cn(
            "absolute rounded-full transition-colors duration-200",
            spec.knob,
            spec.top,
            checked ? "bg-on-accent" : "bg-muted",
          )}
        />
      )}
    </button>
  );

  if (!label && !description) return control;

  return (
    <span className="flex items-center justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span id={labelId} className="text-sm leading-snug text-bone">
          {label}
        </span>
        {description ? (
          <span className="text-xs leading-relaxed text-faint">
            {description}
          </span>
        ) : null}
      </span>
      {control}
    </span>
  );
});
