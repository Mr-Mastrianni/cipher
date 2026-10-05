"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Visible label rendered beside the box. */
  label?: ReactNode;
  /** Secondary copy rendered under the label. */
  description?: ReactNode;
}

/**
 * An accessible checkbox with a gold checked state. The native input is kept
 * in the accessibility tree and only its appearance is replaced, so keyboard
 * focus, form submission, and screen-reader semantics are untouched.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
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
            type="checkbox"
            disabled={disabled}
            className="peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-line bg-transparent transition-colors duration-200 checked:border-gold checked:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed"
            {...props}
          />
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute h-3 w-3 scale-75 text-on-accent opacity-0 transition-[opacity,transform] duration-200 ease-spring peer-checked:scale-100 peer-checked:opacity-100"
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
  },
);
