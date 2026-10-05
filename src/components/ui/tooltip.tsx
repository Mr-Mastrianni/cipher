"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Slot } from "./slot";

/** Which side of the trigger the bubble appears on. */
export type TooltipSide = "top" | "bottom" | "left" | "right";

const POSITION: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

const OFFSET: Record<TooltipSide, { x?: number; y?: number }> = {
  top: { y: 4 },
  bottom: { y: -4 },
  left: { x: 4 },
  right: { x: -4 },
};

export interface TooltipProps {
  /** Bubble contents; keep it to a word or a short phrase. */
  content: ReactNode;
  /** The trigger element; its handlers and ARIA are merged in by `Slot`. */
  children: ReactElement;
  side?: TooltipSide;
  /** Hover delay in ms before showing. Defaults to 220. */
  delay?: number;
  className?: string;
}

/**
 * A hover/focus tooltip wired with `aria-describedby`. It is dismissible with
 * Escape and never the only place a label is communicated.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  delay = 220,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const generatedId = useId();
  const id = `tooltip-${generatedId}`;
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const show = useCallback(
    (immediate: boolean) => {
      clearTimer();
      if (immediate || delay <= 0) {
        setOpen(true);
        return;
      }
      timer.current = window.setTimeout(() => setOpen(true), delay);
    },
    [clearTimer, delay],
  );

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    },
    [hide],
  );

  return (
    <span className="relative inline-flex">
      <Slot
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => show(false)}
        onMouseLeave={hide}
        onFocus={() => show(true)}
        onBlur={hide}
        onKeyDown={handleKeyDown}
      >
        {children}
      </Slot>
      <AnimatePresence>
        {open ? (
          <span
            className={cn("pointer-events-none absolute z-[60]", POSITION[side])}
          >
            <motion.span
              id={id}
              role="tooltip"
              initial={reduced ? { opacity: 0 } : { opacity: 0, ...OFFSET[side] }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, ...OFFSET[side] }}
              transition={{
                duration: reduced ? 0 : 0.16,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                "surface block w-max max-w-[16rem] px-2.5 py-1.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-bone shadow-md",
                className,
              )}
            >
              {content}
            </motion.span>
          </span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
