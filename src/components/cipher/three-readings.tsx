"use client";

import { useRef, useState } from "react";

import { Cosmogram } from "@/components/cipher/cosmogram";
import { gsap, RICH_MOTION, ScrollTrigger, useGSAP } from "@/components/motion/gsap";

/**
 * The landing's one pinned chapter: what a single instant resolves into, one
 * reading per screen of scroll.
 *
 * Without motion (no JavaScript, or reduced motion) the three readings stack
 * as an ordinary list. With it, the section pins, the readings share one slot
 * and hand over as the page scrolls, and the cosmogram turns underneath them.
 * `data-pinned` is the switch between the two layouts, set only once the
 * timeline that needs it exists.
 */

const READINGS = [
  {
    id: "R.01",
    title: "Your bodygraph",
    body: "Nine centres, thirty-six channels, and the definition between them — resolved from one instant.",
    figure: "26",
    unit: "activations",
  },
  {
    id: "R.02",
    title: "Your KP chart",
    body: "Sidereal, Placidus, and the sub lord of every graha and cusp. No Western fallback.",
    figure: "½″",
    unit: "from the Swiss Ephemeris",
  },
  {
    id: "R.03",
    title: "Your Aura Avatar",
    body: "Two words: a seat from the gate you carry, a format from the line you carry most.",
    figure: "2",
    unit: "words, yours alone",
  },
] as const;

const COSMO_PROGRESS = [0.35, 0.7, 1] as const;

export function ThreeReadings() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      gsap.matchMedia().add(
        { motion: "(prefers-reduced-motion: no-preference)", rich: RICH_MOTION },
        (context) => {
          if (!context.conditions?.motion) return;
          const rich = Boolean(context.conditions.rich);
          section.dataset.pinned = "";

          const steps = gsap.utils.toArray<HTMLElement>("[data-step]", section);
          const pin = section.querySelector<HTMLElement>("[data-pin]");
          const wheel = section.querySelector<HTMLElement>("[data-wheel]");
          const bar = section.querySelector<HTMLElement>("[data-bar]");
          gsap.set(steps.slice(1), { autoAlpha: 0, y: 40 });

          const timeline = gsap.timeline({
            defaults: { ease: "power2.inOut", duration: 1 },
            scrollTrigger: {
              trigger: section,
              pin,
              start: "top top",
              end: () => `+=${window.innerHeight * steps.length}`,
              scrub: 0.6,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                const time = self.progress * timeline.duration();
                const next = steps.reduce(
                  (found, _, index) =>
                    time >= timeline.labels[`step-${index}`] ? index : found,
                  0,
                );
                setActive((current) => (current === next ? current : next));
              },
            },
          });

          // Each reading holds still for a stretch of scroll before the next
          // one takes its place, so there is always a resting state to read
          // without snapping, which would fight the phone's own momentum.
          const HOLD = 0.8;
          timeline.addLabel("step-0").to({}, { duration: HOLD });
          steps.slice(1).forEach((step, index) => {
            const previous = steps[index];
            timeline
              .to(previous, {
                autoAlpha: 0,
                y: -40,
                ...(rich ? { filter: "blur(10px)" } : {}),
              })
              .fromTo(
                step,
                { autoAlpha: 0, y: 40, ...(rich ? { filter: "blur(10px)" } : {}) },
                { autoAlpha: 1, y: 0, ...(rich ? { filter: "blur(0px)" } : {}) },
                "<0.35",
              )
              // The counter turns over halfway through the hand-off.
              .addLabel(`step-${index + 1}`, "<0.5")
              .to({}, { duration: HOLD });
          });

          if (wheel) {
            timeline.fromTo(
              wheel,
              { rotate: 0, scale: 0.92 },
              { rotate: 240, scale: 1.08, ease: "none", duration: timeline.duration() },
              0,
            );
          }
          if (bar) {
            timeline.fromTo(
              bar,
              { scaleX: 1 / steps.length },
              { scaleX: 1, ease: "none", duration: timeline.duration() },
              0,
            );
          }

          return () => {
            delete section.dataset.pinned;
            setActive(0);
          };
        },
      );

      // Fonts and the backdrop settle after mount; measure again once they do.
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="readings-title"
      className="group/readings relative"
    >
      <div
        data-pin
        className="mx-auto flex w-full max-w-6xl flex-col px-6 py-24 sm:py-32 group-data-[pinned]/readings:h-svh group-data-[pinned]/readings:justify-center group-data-[pinned]/readings:py-0 group-data-[pinned]/readings:pt-16"
      >
        <div className="flex items-center justify-between gap-6">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-gold">
            S.01 · One instant
          </span>
          <span
            aria-hidden="true"
            className="hidden font-mono text-[9px] uppercase tracking-[0.22em] text-faint group-data-[pinned]/readings:inline"
          >
            {String(active + 1).padStart(2, "0")} / {String(READINGS.length).padStart(2, "0")}
          </span>
        </div>
        <h2
          id="readings-title"
          className="mt-4 max-w-[16ch] font-display text-[clamp(32px,6vw,60px)] leading-[1.02] text-bone"
        >
          Three readings from one instant.
        </h2>

        <div className="mt-10 grid items-center gap-10 group-data-[pinned]/readings:mt-6 group-data-[pinned]/readings:gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16 md:group-data-[pinned]/readings:mt-12">
          <div
            data-wheel
            aria-hidden="true"
            className="relative mx-auto hidden aspect-square w-[min(46vw,22svh)] group-data-[pinned]/readings:block md:order-2 md:w-full md:max-w-[min(420px,52svh)]"
          >
            <Cosmogram className="h-full w-full" progress={COSMO_PROGRESS[active]} />
          </div>

          <ol className="grid gap-12 group-data-[pinned]/readings:gap-0">
            {READINGS.map((reading) => (
              <li
                key={reading.id}
                data-step
                className="group-data-[pinned]/readings:[grid-area:1/1]"
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-faint">
                  {reading.id}
                </p>
                <h3 className="mt-3 font-display text-3xl text-bone sm:text-4xl">
                  {reading.title}
                </h3>
                <p className="mt-3 max-w-[36ch] text-pretty text-[15px] leading-relaxed text-muted">
                  {reading.body}
                </p>
                <p className="mt-6 flex items-baseline gap-3 border-t border-hairline pt-4">
                  <span className="font-display text-5xl text-gold sm:text-6xl">{reading.figure}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
                    {reading.unit}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div
          aria-hidden="true"
          className="mt-10 hidden h-px w-full overflow-hidden bg-hairline group-data-[pinned]/readings:block"
        >
          <div data-bar className="h-full origin-left bg-gold" />
        </div>
      </div>
    </section>
  );
}
