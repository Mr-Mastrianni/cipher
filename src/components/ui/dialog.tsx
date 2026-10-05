"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverlayPortal, useOverlayBehavior } from "./overlay";

/** Panel width presets. */
export type DialogSize = "sm" | "md" | "lg";

const SIZES: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the dialog; rendered as the heading. */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  /** Allow Escape and backdrop clicks to close. Defaults to `true`. */
  dismissible?: boolean;
  /** Hide the built-in close button. */
  hideClose?: boolean;
  className?: string;
}

/**
 * A modal dialog: scroll-locked, focus-trapped, Escape-dismissible, and
 * restored to the previously focused element on close.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  hideClose = false,
  className,
}: DialogProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const titleId = `dialog-title-${generatedId}`;
  const descriptionId = `dialog-description-${generatedId}`;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useOverlayBehavior({ open, onClose: close, panelRef, dismissible });

  return (
    <AnimatePresence>
      {open ? (
        <OverlayPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              aria-hidden="true"
              onClick={dismissible ? close : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-abyss/75 backdrop-blur-sm"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={-1}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "surface relative flex max-h-[min(85dvh,44rem)] w-full flex-col shadow-lg focus-visible:outline-none",
                SIZES[size],
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
                    aria-label="Close dialog"
                    className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    <X aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
                  </button>
                )}
              </div>

              {children ? (
                <div className="flex-1 overflow-y-auto px-6 pb-2 text-sm leading-relaxed text-bone">
                  {children}
                </div>
              ) : null}

              {footer ? (
                <div className="flex flex-wrap items-center justify-end gap-3 p-6 pt-4">
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
