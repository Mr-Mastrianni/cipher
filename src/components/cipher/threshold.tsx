"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import { ChevronUp, Keyboard } from "lucide-react";
import { Cosmogram } from "./cosmogram";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";

/** How far the cosmogram must travel, in pixels, to cross. */
const THRESHOLD_DISTANCE = 170;

const STAGES = [
  { at: 0, label: "the wheel is idle" },
  { at: 0.18, label: "listening" },
  { at: 0.45, label: "tuning in" },
  { at: 0.72, label: "the door is open" },
  { at: 1, label: "cross" },
] as const;

interface ThresholdProps {
  /** Where to go once the threshold is crossed. */
  destination?: string;
}

/**
 * The threshold: a draggable cosmogram that must be physically lifted before
 * the app will open. The gesture is the point — it costs the visitor a small
 * deliberate action, which is the cheapest possible filter and the most
 * memorable possible first impression.
 *
 * Accessibility: the gesture is never the only way through. A visible button,
 * Enter, Space, or ArrowUp all cross immediately, and anyone who has asked for
 * reduced motion gets a plain button with no drag physics at all.
 */
export function Threshold({ destination = "/enter" }: ThresholdProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { play } = useSound();
  const [crossed, setCrossed] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [hinting, setHinting] = useState(false);
  const crossedRef = useRef(false);

  const y = useMotionValue(0);
  const spring = useSpring(y, { stiffness: 320, damping: 30, mass: 0.7 });
  const progress = useTransform(spring, [0, -THRESHOLD_DISTANCE], [0, 1], {
    clamp: true,
  });
  const glow = useTransform(progress, [0, 1], [0, 26]);
  const filter = useTransform(
    glow,
    (value) => `drop-shadow(0 0 ${value}px color-mix(in srgb, var(--c-gold) 55%, transparent))`,
  );
  const opacity = useTransform(progress, [0, 1], [1, 0.35]);
  const scale = useTransform(progress, [0, 1], [1, 1.06]);

  const cross = useCallback(() => {
    if (crossedRef.current) return;
    crossedRef.current = true;
    setCrossed(true);
    play("threshold");
    // Let the bloom land before the route changes.
    const delay = reduced ? 60 : 620;
    window.setTimeout(() => router.push(destination), delay);
  }, [destination, play, reduced, router]);

  // Track the current stage label without re-rendering on every frame.
  useEffect(() => {
    const unsubscribe = progress.on("change", (value) => {
      let next = 0;
      for (let i = 0; i < STAGES.length; i++) {
        if (value >= STAGES[i].at) next = i;
      }
      setStageIndex((current) => (current === next ? current : next));
      if (value > 0.55) setHinting(false);
    });
    return unsubscribe;
  }, [progress]);

  // Nudge the visitor toward the gesture if they have not found it.
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setHinting(true), 3200);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  // Must be called unconditionally at the top level — the reduced-motion branch
  // below renders a different tree, so a hook inside it would break the order.
  const progressValue = useMotionProgressValue(progress);

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      const travelled = -info.offset.y;
      if (travelled > THRESHOLD_DISTANCE * 0.82) {
        cross();
        return;
      }
      play("tick");
      y.set(0);
    },
    [cross, play, y],
  );

  // Keyboard: Enter / Space / ArrowUp all cross.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (crossedRef.current) return;
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        cross();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cross]);

  const stage = STAGES[stageIndex];

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+10vh))]">
      <header className="text-center">
        <motion.h1
          className="font-display text-2xl text-gold sm:text-3xl"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          THE CIPHER
        </motion.h1>
        <motion.p
          className="mt-4 font-mono text-[11px] leading-relaxed text-bone/60 sm:text-xs"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.25 }}
        >
          enter your coordinates.
          <br />
          cross the threshold.
        </motion.p>
      </header>

      <div className="flex-1" />

      {/* the gesture */}
      <div className="flex select-none flex-col items-center">
        <motion.div
          aria-hidden="true"
          className="mb-1 text-gold"
          initial={false}
          animate={{ opacity: hinting && !crossed ? 0.75 : 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            animate={
              reduced || !hinting ? undefined : { y: [1, -4, 1] }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronUp className="h-5 w-5" strokeWidth={1.5} />
          </motion.div>
        </motion.div>

        {reduced ? (
          <button
            type="button"
            onClick={cross}
            className="h-40 w-40 rounded-full outline-none"
            aria-label="Cross the threshold"
          >
            <Cosmogram className="h-40 w-40" animated={false} />
          </button>
        ) : (
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Drag upward, or press Enter, to cross the threshold"
            drag="y"
            dragConstraints={{ top: -THRESHOLD_DISTANCE, bottom: 0 }}
            dragElastic={0.12}
            dragMomentum={false}
            onDragStart={() => play("listen")}
            onDragEnd={onDragEnd}
            style={{ y, touchAction: "none", cursor: crossed ? "default" : "grab" }}
            whileTap={{ cursor: "grabbing" }}
            className="outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-void rounded-full"
          >
            <motion.div
              style={{ filter: crossed ? undefined : filter }}
              animate={
                crossed
                  ? { scale: 1.5, opacity: 0 }
                  : { opacity: 1 }
              }
              transition={{ duration: crossed ? 0.6 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div style={{ opacity, scale }}>
                <Cosmogram
                  className="h-40 w-40"
                  progress={progressValue}
                  animated={!crossed}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        <div className="mt-6 h-5 text-center" aria-live="polite">
          <motion.p
            key={stage.label}
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.28em] transition-colors",
              stageIndex >= 3 ? "text-gold" : "text-faint",
            )}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {crossed ? "crossing" : stage.label}
          </motion.p>
        </div>
      </div>

      <div className="flex-1" />

      <footer className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <button
          type="button"
          onClick={cross}
          className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-bone/70 transition-colors hover:text-gold"
        >
          <Keyboard className="h-3.5 w-3.5" strokeWidth={1.5} />
          or press enter
        </button>
        <p className="text-[11px] leading-relaxed text-faint">
          Your chart is computed from your birth moment and never shared without
          your say-so.
        </p>
      </footer>
    </div>
  );
}

/**
 * `useTransform` returns a MotionValue; the Cosmogram wants a plain number for
 * its progress prop. Subscribing here keeps the re-render cost to one state
 * update per meaningful change rather than one per animation frame.
 */
function useMotionProgressValue(progress: MotionValue<number>) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const unsubscribe = progress.on("change", (v) => {
      // Quantise to 2% steps so React re-renders stay rare.
      setValue(Math.round(v * 50) / 50);
    });
    return unsubscribe;
  }, [progress]);
  return value;
}
