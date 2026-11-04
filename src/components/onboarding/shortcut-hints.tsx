"use client";

import { Keyboard } from "lucide-react";

/** A keycap, e.g. `Enter` or `⌘S`. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-code">
      {children}
    </kbd>
  );
}

/**
 * The keyboard contract, stated rather than hidden.
 *
 * Onboarding is a sequence of short screens, so the natural gestures are Enter
 * to advance, Escape to go back and ⌘S to keep a draft. Listing them costs one
 * collapsed line and makes the flow usable without reaching for the mouse.
 */
export function ShortcutHints({ className }: { className?: string }) {
  return (
    <details className={className}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
        <Keyboard aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={1.5} />
        Shortcuts
      </summary>
      <dl className="mt-2 flex flex-col gap-1.5">
        {(
          [
            ["Enter", "Continue"],
            ["Esc", "Go back"],
            ["⌘ S", "Save draft"],
          ] as const
        ).map(([keys, action]) => (
          <div key={keys} className="flex items-center justify-between gap-3">
            <dt>
              <Kbd>{keys}</Kbd>
            </dt>
            <dd className="m-0 text-[11px] leading-none text-faint">{action}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
