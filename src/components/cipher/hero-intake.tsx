"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DotGlobe, type GlobePlace } from "@/components/cipher/dot-globe";
import { Starfield } from "@/components/cipher/starfield";
import { cn } from "@/lib/utils";

/**
 * The threshold.
 *
 * The first screen is a statement, not a form: a full-bleed sky, the planet's
 * limb turning under the pointer, and the claim set at the bottom edge the way
 * a title card is set. The intake follows one scroll below, in the page's own
 * hairline language — the hero earns the attention, the section spends it.
 *
 * Motion is deliberate and cheap: the planet parallaxes to the pointer and
 * drifts under the scroll, the title lifts away as you leave, and every line
 * arrives once on load. Under `prefers-reduced-motion` all of it resolves to
 * the final state immediately.
 */

const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
  { id: "london", name: "London", note: "Greenwich", city: "London, England", lat: 51.51, lon: -0.13, timeZone: "Europe/London" },
  { id: "new-york", name: "New York", note: "West gate", city: "New York, USA", lat: 40.71, lon: -74.01, timeZone: "America/New_York" },
  { id: "tokyo", name: "Tokyo", note: "First light", city: "Tokyo, Japan", lat: 35.68, lon: 139.69, timeZone: "Asia/Tokyo" },
];

const FIELD =
  "field w-full bg-transparent pb-2 pt-1 text-base text-bone placeholder:text-faint focus-visible:outline-none";

const LABEL = "font-mono text-[9px] uppercase tracking-[0.22em] text-faint";

const RAIL = "font-mono text-[8.5px] uppercase tracking-[0.22em] text-faint";

const CONTENTS = [
  { id: "S.01", label: "The chart", href: "/method" },
  { id: "S.02", label: "The world", href: "/world" },
  { id: "S.03", label: "The Collective", href: "/collective" },
] as const;

export function HeroIntake() {
  const router = useRouter();
  const heroRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [chosenPlace, setChosenPlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pointer parallax: a few degrees, spring-damped, never in the way.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-5, 5]), {
    stiffness: 50,
    damping: 18,
  });
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [4, -4]), {
    stiffness: 50,
    damping: 18,
  });

  // Scroll: the planet sinks and grows, the title leaves.
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const planetY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const planetScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const skyOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.55]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !time) {
      setError("The date and the time are both needed.");
      return;
    }
    if (!place.trim()) {
      setError("Add the nearest city, so the coordinates can be checked.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      d: date,
      t: `${time}:00`.slice(0, 8),
      q: place.trim(),
    });

    // When the place came from the list and the field still reads that place,
    // hand the coordinates and the zone over too. The intake then skips its
    // geocode and lands on the one screen that matters: confirming the instant.
    const pinned = PLACES.find((candidate) => candidate.id === chosenPlace);
    if (pinned && place.trim() === pinned.city) {
      params.set("lat", String(pinned.lat));
      params.set("lon", String(pinned.lon));
      params.set("tz", pinned.timeZone);
      params.set("n", pinned.city);
    }

    router.push(`/enter?${params.toString()}`);
  }

  return (
    <>
      {/* ── The threshold ──────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        onPointerMove={(event) => {
          if (reduced) return;
          const rect = event.currentTarget.getBoundingClientRect();
          pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
          pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
        }}
        onPointerLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
        className="relative isolate flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden border-b border-hairline bg-void"
      >
        <Starfield className="opacity-90" />

        {/* The planet: sky-coloured, pointer-parallaxed, scroll-sunk. */}
        <motion.div
          aria-hidden="true"
          style={
            reduced
              ? undefined
              : { y: planetY, scale: planetScale, rotateX, rotateY, opacity: skyOpacity }
          }
          className="pointer-events-none absolute left-1/2 top-[54%] aspect-square w-[220vw] max-w-[2600px] -translate-x-1/2 lg:top-[50%] lg:w-[150vw]"
        >
          <DotGlobe
            places={PLACES}
            variant="horizon"
            onSelect={() => {}}
            initialLon={18}
            initialLat={14}
            className="h-full w-full cursor-grab active:cursor-grabbing"
          />
        </motion.div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-void via-void/85 to-transparent"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-end gap-6 px-6 pb-5 pt-6 sm:pt-8 lg:px-12">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                style={reduced ? undefined : { y: titleY, opacity: titleOpacity }}
                className="max-w-[16ch] font-sans text-[clamp(28px,8.6vw,54px)] uppercase leading-[0.94] tracking-[-0.035em] text-bone"
              >
                The sky is a record. We cast it to the second.
              </motion.h1>

              <motion.div
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                className="mt-7 flex flex-wrap items-center gap-4"
              >
                <a
                  href="#cast"
                  className="inline-flex items-center gap-3 rounded-full bg-bone px-6 py-3.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold"
                >
                  Cast your chart
                  <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                </a>
                <Link
                  href="/method"
                  className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone"
                >
                  Read the method ↗
                </Link>
              </motion.div>
            </div>

            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.65 }}
              className="max-w-[42ch] font-mono text-[9px] uppercase leading-[1.7] tracking-[0.12em] text-muted lg:justify-self-end"
            >
              <span className="text-bone">+</span> KP sub-lords, Placidus cusps and a
              bodygraph from one confirmed instant. Nine grahas, twelve cusps,
              twenty-six activations. No account needed to read it.
            </motion.p>
          </div>

          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-hairline pt-4"
          >
            <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
              {CONTENTS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group inline-flex items-baseline gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone sm:text-[8.5px]"
                >
                  <span className="text-gold">{item.id}</span>
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="text-faint">
                    ↘
                  </span>
                </Link>
              ))}
            </div>
            <div className="hidden items-center gap-6 sm:flex">
              <span className={RAIL}>Drag the planet</span>
              <span className={cn(RAIL, "hidden sm:inline")}>23.18° N · 75.78° E</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── The intake ─────────────────────────────────────────────────── */}
      <section id="cast" className="relative border-t border-hairline px-6 py-20 lg:px-12 lg:py-28">
        <div className="mx-auto grid w-full max-w-[1400px] gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/35 px-3 py-1 font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold">
              S.00 · Your coordinates
            </span>
            <h2 className="mt-6 max-w-[18ch] font-display text-3xl leading-[1.05] text-bone sm:text-4xl lg:text-5xl">
              One instant, held to the second.
            </h2>
            <p className="mt-5 max-w-[40ch] text-sm leading-relaxed text-muted">
              The date, the time and the place. Everything the chart, the map and
              the bodygraph draw from starts here — and the time zone is
              confirmed by you, never guessed.
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-7">
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className={LABEL}>Date of birth</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={FIELD}
                  aria-label="Date of birth"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={LABEL}>Time · to the second</span>
                <input
                  type="time"
                  step={1}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className={FIELD}
                  aria-label="Time of birth, to the second"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Nearest city</span>
              <input
                type="text"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Leeds, England"
                autoComplete="off"
                className={FIELD}
                aria-label="Nearest city of birth"
              />
            </label>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className={cn(LABEL, "mr-1")}>Places</span>
              {PLACES.map((option) => {
                const active = option.id === chosenPlace;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    title={option.note}
                    onClick={() => {
                      setPlace(option.city);
                      setChosenPlace(option.id);
                      setError(null);
                    }}
                    className={cn(
                      "font-mono text-[9px] uppercase tracking-[0.18em] transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                      active ? "text-gold" : "text-muted hover:text-bone",
                    )}
                  >
                    {option.name}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1">
              <Button type="submit" size="lg">
                Read my chart
                <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span className={RAIL}>Then confirm the time zone</span>
            </div>

            <p role="alert" aria-live="polite" className="min-h-4 text-sm text-danger">
              {error ?? ""}
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
