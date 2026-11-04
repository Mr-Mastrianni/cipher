"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** The slice of a step this component needs. */
export interface StepProgressItem {
  id: string;
  /** The small mono caption above the title, e.g. "02 — The shape". */
  eyebrow: string;
  title: string;
}

/**
 * The onboarding rail.
 *
 * Eleven equal-weight dots would be noise, so the rail says three things at
 * once: which steps are done (a filled ring with a tick), which one you are on
 * (a bright ring and brighter type), and what is still ahead (dimmed). A
 * connector line is drawn between rings so the sequence reads as one path
 * rather than a list.
 *
 * The same markup is reused by the compact dots below, so the two can never
 * disagree about progress.
 */
export function StepProgress({
  steps,
  currentIndex,
  isReveal,
  reveal,
  className,
}: {
  steps: readonly StepProgressItem[];
  /** Index of the step in progress; may equal `steps.length` on the reveal. */
  currentIndex: number;
  /** Whether the flow has finished and the placement is showing. */
  isReveal: boolean;
  /** The reveal's own eyebrow/title, for the final rail entry. */
  reveal?: StepProgressItem;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-1", className)} aria-label="Onboarding steps">
      {steps.map((entry, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex && !isReveal;
        const last = index === steps.length - 1;

        return (
          <li
            key={entry.id}
            aria-current={current ? "step" : undefined}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors duration-200",
                  done
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : current
                      ? "border-gold bg-void text-gold ring-2 ring-gold/20"
                      : "border-line bg-void text-faint",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <span className="font-mono text-[10px] tabular-nums">
                    {index + 1}
                  </span>
                )}
              </span>
              {!last ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 w-px flex-1 transition-colors duration-200",
                    done ? "bg-gold/30" : "bg-line",
                  )}
                />
              ) : null}
            </div>

            <div className="min-w-0 pb-3">
              <p
                className={cn(
                  "truncate font-mono text-[9px] uppercase tracking-[0.2em] transition-colors duration-200",
                  done ? "text-gold/80" : current ? "text-gold" : "text-faint",
                )}
              >
                {entry.eyebrow}
              </p>
              <p
                className={cn(
                  "mt-0.5 line-clamp-2 text-[13px] leading-snug transition-colors duration-200",
                  done ? "text-muted" : current ? "text-bone" : "text-faint",
                )}
              >
                {entry.title}
              </p>
            </div>
          </li>
        );
      })}

      {isReveal ? (
        <li aria-current="step" className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold bg-gold/10 text-gold ring-2 ring-gold/20"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-gold">
              {reveal?.eyebrow ?? "Placement"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-bone">
              {reveal?.title ?? "You are in."}
            </p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

/**
 * A one-line progress readout for small screens, where the rail has no room.
 *
 * It renders the identical done/current/pending logic as {@link StepProgress},
 * and every dot carries its step number for assistive technology.
 */
export function StepDots({
  steps,
  currentIndex,
  isReveal,
  className,
}: {
  steps: readonly StepProgressItem[];
  currentIndex: number;
  isReveal: boolean;
  className?: string;
}) {
  return (
    <ol
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`Onboarding progress: step ${Math.min(currentIndex + 1, steps.length)} of ${steps.length}`}
    >
      {steps.map((entry, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex && !isReveal;
        return (
          <li key={entry.id} className="flex-1">
            <span
              className={cn(
                "block h-1 rounded-full transition-colors duration-200",
                done ? "bg-gold/60" : current ? "bg-gold" : "bg-line",
              )}
            >
              <span className="sr-only">
                {`Step ${index + 1}, ${entry.title}: ${done ? "complete" : current ? "current" : "not started"}`}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
