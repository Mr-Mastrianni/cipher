"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OverlayPortal, useOverlayBehavior } from "@/components/ui/overlay";
import { hasSeenTour, markTourSeen, TOUR_RESTART_EVENT } from "@/lib/tour";
import { DASHBOARD_TOUR, type TourStep } from "./steps";

/**
 * The first-run dashboard tour.
 *
 * A spotlight plus a popover, built on the kit's own `useOverlayBehavior` — so
 * Escape, the Tab focus loop and focus restoration are the same code the
 * dialogs and sheets use, rather than a second implementation.
 *
 * Three details are deliberate:
 *
 *  - **Steps are resolved against the live DOM.** A step whose target is absent,
 *    or is laid out at 0×0 (the desktop rail on a phone is `display: none`), is
 *    dropped before the tour starts, so the same list works at every width.
 *  - **Nothing renders during SSR or hydration.** `running` can only become
 *    true inside an effect, and the seen-flag is read from `localStorage`
 *    there too, so there is no markup to mismatch.
 *  - **The page is not scroll-locked.** The overlay opts out of scroll lock so
 *    `scrollIntoView` can bring each target into view; a transparent layer
 *    swallows stray clicks instead.
 */

/** The only route where every tour target exists. */
const TOUR_PATH = "/dashboard";

/** Breathing room between the spotlight and the element it highlights. */
const SPOT_PAD = 8;

/** Popover width on a wide viewport. */
const POPOVER_W = 350;

/** A conservative popover height, used to pick a side. */
const POPOVER_H = 280;

/** Minimum distance from any viewport edge. */
const EDGE = 16;

/** Distance between the spotlight and the popover. */
const GAP = 16;

/** The measured box of a tour target, in viewport coordinates. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Measure a step's target.
 *
 * @param target - The `data-tour` attribute value.
 * @returns Its box, or `null` when it is missing or laid out at zero size.
 */
function targetBox(target: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** Clamp `value` into `[min, max]`, surviving an inverted range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where to put the popover for a given target.
 *
 * Preference order: centred when there is nothing to point at, a bottom card on
 * small screens, then right of the target, below it, or above it.
 */
function popoverStyle(
  box: Box | null,
  viewportWidth: number,
  viewportHeight: number,
): CSSProperties {
  if (!box) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${POPOVER_W}px, calc(100vw - 2rem))`,
    };
  }

  if (viewportWidth < 768) {
    return { left: EDGE, right: EDGE, bottom: EDGE };
  }

  const besideRight = box.left + box.width + GAP;
  if (besideRight + POPOVER_W <= viewportWidth - EDGE) {
    return {
      left: besideRight,
      top: clamp(box.top, EDGE, viewportHeight - POPOVER_H - EDGE),
      width: POPOVER_W,
    };
  }

  const besideBelow = box.top + box.height + GAP;
  if (besideBelow + POPOVER_H <= viewportHeight - EDGE) {
    return {
      left: clamp(box.left, EDGE, viewportWidth - POPOVER_W - EDGE),
      top: besideBelow,
      width: POPOVER_W,
    };
  }

  return {
    left: clamp(box.left, EDGE, viewportWidth - POPOVER_W - EDGE),
    top: Math.max(EDGE, box.top - POPOVER_H - GAP),
    width: POPOVER_W,
  };
}

/** The first-run tour. Renders nothing until it is actually running. */
export function Tour() {
  const pathname = usePathname();
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const bodyId = useId();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [steps, setSteps] = useState<readonly TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [dismissed, setDismissed] = useState(false);

  /* ── Lifecycle ─────────────────────────────────────────────────────────── */

  const finish = useCallback(() => {
    markTourSeen();
    setRunning(false);
    setBox(null);
    setDismissed(true);
  }, []);

  const start = useCallback(() => {
    if (hasSeenTour()) return;
    const available = DASHBOARD_TOUR.filter(
      (step) => targetBox(step.target) !== null,
    );
    if (available.length === 0) return;
    setSteps(available);
    setIndex(0);
    setRunning(true);
    setDismissed(false);
  }, []);

  // Offer the tour once, after the overview has painted and its section
  // reveals have settled — measuring mid-animation lands the spotlight wrong.
  useEffect(() => {
    if (dismissed || pathname !== TOUR_PATH) return;
    const timer = window.setTimeout(start, 800);
    return () => window.clearTimeout(timer);
  }, [dismissed, pathname, start]);

  // "Replay the tour" clears the stored flag and asks this instance to run.
  // It starts directly rather than only clearing `dismissed`: after a reload
  // `dismissed` is already false, so setting it again would not re-run the
  // effect above. If the targets are not on this route yet, `start` does
  // nothing and the navigation that follows will run it.
  useEffect(() => {
    const restart = () => {
      setDismissed(false);
      start();
    };
    window.addEventListener(TOUR_RESTART_EVENT, restart);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, restart);
  }, [start]);

  /* ── Measurement ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!running) return;
    const step = steps[index];
    if (!step) return;

    const measure = () => setBox(targetBox(step.target));

    const node = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`,
    );
    node?.scrollIntoView({
      // `nearest` leaves an already-visible target alone. `center` on a tall
      // section would hijack the scroll position on every step.
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });

    measure();
    // A smooth scroll is still moving for a few frames; re-measure once landed.
    const settled = window.setTimeout(measure, reduced ? 0 : 380);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      window.clearTimeout(settled);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [running, index, steps, reduced]);

  // Move focus to the new step so its heading is announced. The overlay's own
  // focus capture only runs on open, not on every step change.
  useEffect(() => {
    if (!running) return;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [running, index]);

  useOverlayBehavior({
    open: running,
    onClose: finish,
    panelRef,
    lockScroll: false,
    initialFocusRef: panelRef,
  });

  if (!running) return null;

  const step = steps[index];
  if (!step) return null;

  const last = index === steps.length - 1;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;

  return (
    <OverlayPortal>
      {/* Swallow clicks: a tour should be driven by its own controls. */}
      <div
        aria-hidden="true"
        className={
          box ? "fixed inset-0 z-[55]" : "fixed inset-0 z-[55] bg-black/55"
        }
      />

      {box ? (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            top: box.top - SPOT_PAD,
            left: box.left - SPOT_PAD,
            width: box.width + SPOT_PAD * 2,
            height: box.height + SPOT_PAD * 2,
          }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 320, damping: 34 }
          }
          // The 9999px spread paints the dimming *outside* the box, leaving a
          // clean hole over the target — no SVG mask or clip-path needed.
          style={{
            position: "fixed",
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
          className="pointer-events-none z-[56] rounded-xl ring-2 ring-gold/80"
        />
      ) : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        style={popoverStyle(box, viewportWidth, viewportHeight)}
        className="surface fixed z-[57] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl p-5 outline-none sm:p-6"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
          Step {index + 1} of {steps.length}
        </p>
        <h2
          id={titleId}
          className="mt-2 font-display text-xl leading-tight text-bone text-balance"
        >
          {step.title}
        </h2>
        <p
          id={bodyId}
          className="mt-2 text-sm leading-relaxed text-muted text-pretty"
        >
          {step.body}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          {index > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIndex((current) => Math.max(current - 1, 0))}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
              Back
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={() =>
              last ? finish() : setIndex((current) => current + 1)
            }
          >
            {last ? "Done" : "Next"}
            {last ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          Step {index + 1} of {steps.length}: {step.title}
        </p>
      </div>
    </OverlayPortal>
  );
}
