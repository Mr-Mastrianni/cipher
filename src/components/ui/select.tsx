"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Mark the control invalid for assistive tech and tint the underline. */
  invalid?: boolean;
}

/**
 * A styled native `<select>`. Deliberately not a custom listbox: the native
 * control keeps platform keyboard, type-ahead, and mobile behaviour intact.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <span className="relative flex items-center">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "field w-full cursor-pointer appearance-none px-0 py-2 pr-8 text-sm text-bone",
          "[&>option]:bg-ink [&>option]:text-bone",
          invalid && "border-b-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className="pointer-events-none absolute right-1 h-4 w-4 text-muted"
      />
    </span>
  );
});
