"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { DotGlobe, type GlobePlace } from "@/components/cipher/dot-globe";
import { Starfield } from "@/components/cipher/starfield";
import { cn } from "@/lib/utils";

/**
 * The sky the whole page moves through.
 *
 * `position: fixed` at page level: the horizon never scrolls away; the page
 * rides over it while the camera pushes in, so every chapter is set against the
 * same planet. It is a background: no pointer capture, no focus, nothing that
 * competes with the content or with scrolling.
 *
 * The planet arrives in three layers of fidelity. A CSS disc is there from the
 * first paint. The WebGL Earth loads after it and crossfades in once its
 * textures are on the GPU. If the browser cannot open a WebGL context, the
 * renderer throws, or the GPU drops the context, the dotted globe stands in.
 */

const EarthScene = dynamic(
  () => import("./earth-scene").then((module) => module.EarthScene),
  { ssr: false },
);

const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
];

/** Whether this browser can create a WebGL context at all. */
function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Catches a renderer crash or a lost context and hands back to the fallback. */
class EarthBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Fidelity = "pending" | "webgl" | "dots";

export function CosmicBackdrop() {
  const reduced = useReducedMotion() ?? false;
  const { scrollY } = useScroll();

  const [fidelity, setFidelity] = useState<Fidelity>("pending");
  const [earthReady, setEarthReady] = useState(false);
  useEffect(() => {
    // Decided after mount: the server cannot know, and both answers differ
    // from the first paint only by what fades in over the placeholder.
    const frame = requestAnimationFrame(() =>
      setFidelity(detectWebgl() ? "webgl" : "dots"),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  const markReady = useCallback(() => setEarthReady(true), []);
  const fallBack = useCallback(() => setFidelity("dots"), []);

  // The page's scroll, handed to the WebGL frame loop without re-rendering.
  const scrolled = useRef(0);
  // The dotted fallback turns with the page the same way.
  const spin = useRef(0);
  useEffect(() => {
    const unsubscribe = scrollY.on("change", (value) => {
      scrolled.current = value;
      spin.current = value * 0.045;
    });
    return unsubscribe;
  }, [scrollY]);

  // A long, slow push: the planet grows for three screens, then holds. The
  // WebGL Earth reproduces this in its own camera; these drive the CSS layers.
  const scale = useTransform(scrollY, [0, 2600], [1, 1.8]);
  const drift = useTransform(scrollY, [0, 2600], ["0%", "-5%"]);
  const dim = useTransform(scrollY, [0, 900, 2600], [1, 0.82, 0.62]);
  const starShift = useTransform(scrollY, [0, 2600], [0, -140]);

  const showEarth = fidelity === "webgl" && earthReady;

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

      {/* The placeholder disc, and the dotted globe when WebGL is out. */}
      <motion.div
        style={reduced ? undefined : { scale, y: drift, opacity: dim }}
        className={cn(
          "absolute inset-0 transition-opacity duration-[1600ms] ease-out",
          showEarth && "!opacity-0",
        )}
      >
        <div className="absolute left-1/2 top-[54%] aspect-square w-[170vw] max-w-[2200px] -translate-x-1/2 lg:top-[52%] lg:w-[115vw]">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 4%, #22303f 0%, #141d29 30%, #0a1018 56%, #05090f 74%)",
              boxShadow:
                "0 -2px 0 0 rgba(190,225,255,1), 0 -10px 26px 0 rgba(120,185,255,0.65), 0 -60px 150px -20px rgba(70,150,255,0.5), inset 0 2px 24px rgba(160,210,255,0.25)",
            }}
          />
          {fidelity === "dots" ? (
            <DotGlobe
              places={PLACES}
              variant="horizon"
              onSelect={() => {}}
              initialLon={18}
              initialLat={14}
              spinRef={spin}
              className="h-full w-full"
            />
          ) : null}
        </div>
      </motion.div>

      {/* The Earth itself, once its textures are on the GPU. */}
      {fidelity === "webgl" ? (
        <motion.div
          style={reduced ? undefined : { opacity: dim }}
          className="absolute inset-0"
        >
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-[1600ms] ease-out",
              showEarth ? "opacity-100" : "opacity-0",
            )}
          >
            <EarthBoundary onFail={fallBack}>
              <EarthScene
                scroll={scrolled}
                reduced={reduced}
                onReady={markReady}
                onLost={fallBack}
              />
            </EarthBoundary>
          </div>
        </motion.div>
      ) : null}

      {/* The page's own veil: enough contrast for type, enough sky to breathe. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_110%,rgba(4,6,10,0.02),rgba(4,6,10,0.18)_45%,rgba(4,6,10,0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-void/80 via-void/40 to-transparent" />
    </div>
  );
}
