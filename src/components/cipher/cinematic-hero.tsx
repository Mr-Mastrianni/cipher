"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowDown, ArrowUpRight } from "lucide-react";

import { DotGlobe, type GlobePlace } from "@/components/cipher/dot-globe";
import { Starfield } from "@/components/cipher/starfield";
import { cn } from "@/lib/utils";

/**
 * The opening sequence.
 *
 * Five phases — darkness, stars, planet, type, a living scene — built from
 * three layers and one scroll timeline.
 *
 * The reveal is **CSS, not JavaScript**. Motion drives the scroll camera, but
 * the entrance is a set of keyframes with `both` fill: if a frame loop never
 * runs (a background tab, a crawler, a battery saver) the page still resolves
 * to its final, visible state instead of sitting at opacity zero. Revisits in a
 * session skip it by setting `data-intro="skip"` before paint; reduced motion
 * disables it in the same stylesheet.
 */

const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
  { id: "london", name: "London", note: "Greenwich", city: "London, England", lat: 51.51, lon: -0.13, timeZone: "Europe/London" },
  { id: "new-york", name: "New York", note: "West gate", city: "New York, USA", lat: 40.71, lon: -74.01, timeZone: "America/New_York" },
  { id: "tokyo", name: "Tokyo", note: "First light", city: "Tokyo, Japan", lat: 35.68, lon: 139.69, timeZone: "Asia/Tokyo" },
];

const RAIL = "font-mono text-[8px] uppercase tracking-[0.2em] text-faint sm:text-[8.5px]";

const CONTENTS = [
  { id: "S.01", label: "The chart", href: "/method" },
  { id: "S.02", label: "The world", href: "/world" },
  { id: "S.03", label: "The Collective", href: "/collective" },
] as const;

export function CinematicHero() {
  const sceneRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  // A revisit in the same session should not sit through the reveal again.
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem("cipher:intro") === "1";
      sessionStorage.setItem("cipher:intro", "1");
      if (seen) document.documentElement.dataset.intro = "skip";
    } catch {
      /* Private mode: the sequence simply plays. */
    }
  }, []);

  // The camera is the whole page's scroll, because the sky is pinned: it stays
  // while the content rides over it, then dissolves as the instrument arrives.
  const { scrollY } = useScroll();
  const cameraScale = useTransform(scrollY, [0, 900], [1, 1.42]);
  const cameraDrop = useTransform(scrollY, [0, 900], ["0%", "16%"]);
  const skyFade = useTransform(scrollY, [0, 620, 1150], [1, 0.85, 0]);
  const titleY = useTransform(scrollY, [0, 620], [0, -140]);
  const titleFade = useTransform(scrollY, [0, 420], [1, 0]);
  const haze = useTransform(scrollY, [420, 1000], [0, 1]);

  // Pointer parallax, spring-damped, a few degrees at most.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const tiltX = useSpring(useTransform(py, [-0.5, 0.5], [3, -3]), { stiffness: 45, damping: 20 });
  const tiltY = useSpring(useTransform(px, [-0.5, 0.5], [-4, 4]), { stiffness: 45, damping: 20 });

  return (
    <section
      ref={sceneRef}
      className="relative isolate flex min-h-[130svh] flex-col border-b border-hairline"
      onPointerMove={(event) => {
        if (reduced) return;
        const rect = event.currentTarget.getBoundingClientRect();
        px.set((event.clientX - rect.left) / rect.width - 0.5);
        py.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {/* The sky is pinned to the viewport; the page scrolls across it. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-void">
        <div className="intro-fade absolute inset-0" style={{ animationDelay: "0.25s" }}>
          <Starfield />
        </div>

      <motion.div
        aria-hidden="true"
        style={{ y: cameraDrop, scale: cameraScale, opacity: skyFade }}
        className="absolute inset-0"
      >
        <div className="pointer-events-none absolute left-1/2 top-[52%] aspect-square w-[230vw] max-w-[2800px] -translate-x-1/2 lg:top-[48%] lg:w-[155vw]">
          <motion.div
            style={reduced ? undefined : { rotateX: tiltX, rotateY: tiltY }}
            className="h-full w-full"
          >
            <div className="intro-planet h-full w-full">
              <DotGlobe
                places={PLACES}
                variant="horizon"
                onSelect={() => {}}
                initialLon={18}
                initialLat={14}
                className="h-full w-full cursor-grab active:cursor-grabbing"
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

        {/* Air, thickening as the camera passes through it. */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: haze }}
          className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(120%_70%_at_50%_120%,rgba(124,180,255,0.10),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[62%] bg-gradient-to-t from-void via-void/88 to-transparent"
        />
      </div>

      {/* The title card rides over the pinned sky. */}
      <div className="relative z-10 flex min-h-[calc(100svh-4.5rem)] flex-col justify-end">

      {/* Type. */}
      <motion.div
        style={reduced ? undefined : { y: titleY, opacity: titleFade }}
        className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-end px-6 pb-5 pt-6 lg:px-12"
      >
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p
              className="intro-fade font-mono text-[9px] uppercase tracking-[0.3em] text-gold"
              style={{ animationDelay: "1.25s" }}
            >
              KP astrology · Human Design
            </p>

            <h1 className="mt-5 font-sans text-[clamp(30px,4.4vw,54px)] uppercase leading-[0.94] tracking-[-0.035em] text-bone">
              {["The sky is a record.", "We cast it to the second."].map((line, index) => (
                <span key={line} className="block overflow-hidden pb-[0.06em]">
                  <span
                    className="intro-line block"
                    style={{ animationDelay: `${1.4 + index * 0.12}s` }}
                  >
                    {line}
                  </span>
                </span>
              ))}
            </h1>

            <div
              className="intro-rise mt-7 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "1.85s" }}
            >
              <a
                href="#cast"
                className="inline-flex items-center gap-3 rounded-full bg-bone px-6 py-3.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold"
              >
                Cast your chart
                <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
              </a>
              <Link
                href="/world"
                className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone"
              >
                Enter the world
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Link>
            </div>
          </div>

          <p
            className="intro-fade max-w-[42ch] font-mono text-[9px] uppercase leading-[1.7] tracking-[0.12em] text-muted lg:justify-self-end"
            style={{ animationDelay: "2.05s" }}
          >
            <span className="text-bone">+</span> KP sub-lords, Placidus cusps and a
            bodygraph from one confirmed instant. Nine grahas, twelve cusps,
            twenty-six activations. No account needed to read it.
          </p>
        </div>

        <div
          className="intro-fade mt-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-hairline pt-4"
          style={{ animationDelay: "2.25s" }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-5">
            {CONTENTS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="inline-flex items-baseline gap-1.5 whitespace-nowrap font-mono text-[7.5px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-bone sm:gap-2 sm:text-[8.5px] sm:tracking-[0.2em]"
              >
                <span className="text-gold">{item.id}</span>
                <span>{item.label}</span>
                <span aria-hidden="true" className="text-faint">↘</span>
              </Link>
            ))}
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <span className={RAIL}>Drag the planet</span>
            <span className={cn(RAIL, "hidden md:inline")}>23.18° N · 75.78° E</span>
          </div>
        </div>
      </motion.div>
      </div>
    </section>
  );
}
