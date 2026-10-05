"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Visible label rendered beside the radio. */
  label?: ReactNode;
  /** Secondary copy rendered under the label. */
  description?: ReactNode;
}

/**
 * An accessible radio with a gold selected state. Group radios by giving them
 * the same `name`; the browser then supplies roving-tabindex arrow-key
 * navigation for free.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, label, description, id, disabled, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        "group inline-flex cursor-pointer items-start gap-3",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={id}
          type="radio"
          disabled={disabled}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded-full border border-line bg-transparent transition-colors duration-200 checked:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-1.5 w-1.5 scale-0 rounded-full bg-gold opacity-0 transition-[opacity,transform] duration-200 ease-spring peer-checked:scale-100 peer-checked:opacity-100"
        />
      </span>
      {label || description ? (
        <span className="flex flex-col gap-0.5">
          {label ? (
            <span className="text-sm leading-snug text-bone">{label}</span>
          ) : null}
          {description ? (
            <span className="text-xs leading-relaxed text-faint">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
});

export interface RadioGroupProps {
  /** Legend describing the group as a whole. */
  label?: ReactNode;
  /** Secondary copy rendered under the legend. */
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** A fieldset wrapper that gives a set of radios a shared visible legend. */
export function RadioGroup({
  label,
  description,
  className,
  children,
}: RadioGroupProps) {
  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      {label ? (
        <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </legend>
      ) : null}
      {description ? (
        <p className="text-xs leading-relaxed text-faint">{description}</p>
      ) : null}
      <div className="flex flex-col gap-2.5">{children}</div>
    </fieldset>
  );
}
