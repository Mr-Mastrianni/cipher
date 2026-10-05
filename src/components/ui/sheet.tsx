"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverlayPortal, useOverlayBehavior } from "./overlay";

/** Which edge the drawer slides in from. */
export type SheetSide = "right" | "left" | "bottom";

const LAYOUT: Record<SheetSide, { container: string; panel: string }> = {
  right: {
    container: "justify-end",
    panel:
      "surface absolute right-0 top-0 h-full w-[min(24rem,100vw)] rounded-none border-y-0 border-r-0",
  },
  left: {
    container: "justify-start",
    panel:
      "surface absolute left-0 top-0 h-full w-[min(24rem,100vw)] rounded-none border-y-0 border-l-0",
  },
  bottom: {
    container: "items-end",
    panel:
      "surface absolute inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-xl rounded-b-none border-x-0 border-b-0",
  },
};

const HIDDEN: Record<SheetSide, { x?: string; y?: string }> = {
  right: { x: "100%" },
  left: { x: "-100%" },
  bottom: { y: "100%" },
};

const SHOWN: Record<SheetSide, { x?: string; y?: string; opacity: number }> = {
  right: { x: "0%", opacity: 1 },
  left: { x: "0%", opacity: 1 },
  bottom: { y: "0%", opacity: 1 },
};

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the drawer; rendered as the heading. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: SheetSide;
  /** Allow Escape and backdrop clicks to close. Defaults to `true`. */
  dismissible?: boolean;
  /** Hide the built-in close button. */
  hideClose?: boolean;
  className?: string;
}

/**
 * A side or bottom drawer sharing the dialog's focus trap, scroll lock, and
 * Escape handling. Bottom sheets enter with the `cipher-sheet` rise.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  dismissible = true,
  hideClose = false,
  className,
}: SheetProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const titleId = `sheet-title-${generatedId}`;
  const descriptionId = `sheet-description-${generatedId}`;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useOverlayBehavior({ open, onClose: close, panelRef, dismissible });

  // The bottom sheet leans on the design system's own rise keyframes for its
  // entrance; every other case is driven by motion.
  const cssEnter = side === "bottom" && !reduced;
  const layout = LAYOUT[side];

  return (
    <AnimatePresence>
      {open ? (
        <OverlayPortal>
          <div className={cn("fixed inset-0 z-[75] flex", layout.container)}>
            <motion.div
              aria-hidden="true"
              onClick={dismissible ? close : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-abyss/70 backdrop-blur-sm"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={-1}
              initial={cssEnter ? false : reduced ? { opacity: 0 } : HIDDEN[side]}
              animate={reduced ? { opacity: 1 } : SHOWN[side]}
              exit={reduced ? { opacity: 0 } : HIDDEN[side]}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.38, ease: [0.22, 1, 0.36, 1] }
              }
              className={cn(
                "relative flex max-h-[100dvh] flex-col shadow-lg focus-visible:outline-none",
                layout.panel,
                cssEnter && "animate-cipher-sheet",
                className,
              )}
            >
              <div className="flex items-start justify-between gap-4 p-6 pb-4">
                <div className="flex flex-col gap-1.5">
                  <h2 id={titleId} className="font-display text-lg text-bone">
                    {title}
                  </h2>
                  {description ? (
                    <p
                      id={descriptionId}
                      className="text-sm leading-relaxed text-muted text-pretty"
                    >
                      {description}
                    </p>
                  ) : null}
                </div>
                {hideClose ? null : (
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close panel"
                    className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    <X aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
                  </button>
                )}
              </div>

              {children ? (
                <div className="flex-1 overflow-y-auto px-6 pb-6 text-sm leading-relaxed text-bone">
                  {children}
                </div>
              ) : null}

              {footer ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-hairline p-6">
                  {footer}
                </div>
              ) : null}
            </motion.div>
          </div>
        </OverlayPortal>
      ) : null}
    </AnimatePresence>
  );
}
