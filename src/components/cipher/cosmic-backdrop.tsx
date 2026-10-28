"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { DotGlobe, type GlobePlace } from "@/components/cipher/dot-globe";
import { Starfield } from "@/components/cipher/starfield";

/**
 * The sky the whole page moves through.
 *
 * `position: fixed` at page level — the architecture the reference actually
 * uses. The horizon never scrolls away; the page rides over it while the
 * camera pushes in, so every chapter is set against the same planet. It is a
 * background: no pointer capture, no focus, nothing that competes with the
 * content or with scrolling.
 */

const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
];

export function CosmicBackdrop() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  // A long, slow push: the planet grows for three screens, then holds.
  const scale = useTransform(scrollY, [0, 2600], [1, 2.15]);
  const drift = useTransform(scrollY, [0, 2600], ["0%", "-5%"]);
  const dim = useTransform(scrollY, [0, 900, 2600], [1, 0.82, 0.62]);
  const starShift = useTransform(scrollY, [0, 2600], [0, -140]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-void"
    >
      <motion.div
        style={reduced ? undefined : { y: starShift }}
        className="absolute inset-0 opacity-80"
      >
        <Starfield />
      </motion.div>

      <motion.div
        style={reduced ? undefined : { scale, y: drift, opacity: dim }}
        className="absolute inset-0"
        // Diagnostic: plain transform only; if this still hides, the motion
        // values are the suspect.
      >
        <div className="absolute left-1/2 top-[54%] aspect-square w-[200vw] max-w-[2600px] -translate-x-1/2 lg:top-[50%] lg:w-[135vw]">
          {/* A body under the dots: if the canvas is unavailable, the horizon
              still exists, and if it is, the surface reads as a planet rather
              than as points in a void. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 4%, #22303f 0%, #141d29 30%, #0a1018 56%, #05090f 74%)",
              boxShadow:
                "0 -2px 0 0 rgba(190,225,255,1), 0 -10px 26px 0 rgba(120,185,255,0.65), 0 -60px 150px -20px rgba(70,150,255,0.5), inset 0 2px 24px rgba(160,210,255,0.25)",
            }}
          />
          <DotGlobe
            places={PLACES}
            variant="horizon"
            onSelect={() => {}}
            initialLon={18}
            initialLat={14}
            className="h-full w-full"
          />
        </div>
      </motion.div>

      {/* The page's own veil: enough contrast for type, enough sky to breathe. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_110%,rgba(4,6,10,0.02),rgba(4,6,10,0.18)_45%,rgba(4,6,10,0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-void/80 via-void/40 to-transparent" />
    </div>
  );
}
