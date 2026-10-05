import type { HTMLAttributes } from "react";
import { clamp, cn } from "@/lib/utils";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Current value, in `0..max`. */
  value: number;
  /** Upper bound. Defaults to `100`. */
  max?: number;
  /** Accessible name for the bar. */
  label?: string;
  /** Render the percentage beside the label. */
  showValue?: boolean;
}

/** A thin gold progress bar with the full `progressbar` ARIA contract. */
export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  className,
  ...props
}: ProgressProps) {
  const percent = clamp(max > 0 ? (value / max) * 100 : 0, 0, 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {label}
            </span>
          ) : null}
          {showValue ? (
            <span className="font-mono text-[10px] tabular-nums text-faint">
              {Math.round(percent)}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamp(value, 0, max)}
        className="h-1 w-full overflow-hidden rounded-full bg-hairline"
      >
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out-quint"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
