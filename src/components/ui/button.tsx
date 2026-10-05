"use client";

import { forwardRef, useCallback, type MouseEvent, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { cue } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";
import { Slot } from "./slot";

/** Visual weight of a button. */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger";

/** Control height and type scale. */
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-md border font-mono font-medium uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-gold text-on-accent hover:bg-gold-hi",
  secondary:
    "border-line bg-raised text-bone hover:border-gold hover:text-gold",
  ghost: "border-transparent bg-transparent text-bone hover:bg-raised",
  outline:
    "border-gold/50 bg-transparent text-gold hover:border-gold hover:bg-gold/10",
  danger: "border-transparent bg-danger text-on-accent hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[10px]",
  md: "h-10 px-4 text-[11px]",
  lg: "h-12 px-6 text-xs",
};

const SPRING = { type: "spring", stiffness: 420, damping: 28, mass: 0.6 } as const;

const MotionButton = motion.button;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Height and type scale. Defaults to `md`. */
  size?: ButtonSize;
  /** Render styles and behaviour onto the single child (e.g. a `next/link`). */
  asChild?: boolean;
  /** Show a spinner, block interaction, and mark the control busy. */
  loading?: boolean;
  /** Decoration rendered before the label. */
  iconLeft?: ReactNode;
  /** Decoration rendered after the label. */
  iconRight?: ReactNode;
}

/**
 * The kit's action element: a real button by default, with variant styling,
 * press/hover sound cues, and a subtle spring on pointer interaction. When
 * `asChild` is set the styles move to the child element and the spring is
 * skipped, since an arbitrary child may not tolerate a transform.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    asChild = false,
    loading = false,
    iconLeft,
    iconRight,
    disabled,
    type = "button",
    onClick,
    onMouseEnter,
    onMouseLeave,
    children,
    ...rest
  },
  ref,
) {
  const reduced = useReducedMotion();
  const isDisabled = disabled === true || loading;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      cue("select");
      onClick?.(event as MouseEvent<HTMLButtonElement>);
    },
    [onClick],
  );

  const handleMouseEnter = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      cue("hover");
      onMouseEnter?.(event as MouseEvent<HTMLButtonElement>);
    },
    [onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      onMouseLeave?.(event as MouseEvent<HTMLButtonElement>);
    },
    [onMouseLeave],
  );

  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  const content = (
    <>
      {loading ? (
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </>
  );

  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={classes}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        tabIndex={isDisabled ? -1 : undefined}
        {...rest}
      >
        {children}
      </Slot>
    );
  }

  return (
    <MotionButton
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={classes}
      whileHover={reduced || isDisabled ? undefined : { scale: 1.02 }}
      whileTap={reduced || isDisabled ? undefined : { scale: 0.97 }}
      transition={SPRING}
      {...(rest as unknown as HTMLMotionProps<"button">)}
    >
      {content}
    </MotionButton>
  );
});
