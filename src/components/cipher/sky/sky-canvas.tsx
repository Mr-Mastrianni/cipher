"use client";

import { useEffect, useRef } from "react";

import type { Caption, Transit } from "./bodies";
import type { BodyId } from "./layout";
import { createSky, type Sky } from "./sky";

/**
 * Mounts the WebGL space. The scene lives in `sky.ts`; this owns the canvas,
 * the label layer and the lifetime, and passes the focus through.
 */
export function SkyCanvas({
  transits,
  reduced,
  light,
  focus,
  caption,
  onReady,
  onLost,
  onSelect,
}: {
  transits: readonly Transit[];
  reduced: boolean;
  /** Ivory is a daylight sky: ink stars and darker orbits. */
  light: boolean;
  focus: BodyId | null;
  caption: Caption;
  onReady: () => void;
  onLost: () => void;
  onSelect: (id: BodyId) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<Sky | null>(null);
  // The latest handlers, so the scene is built once per sky, not per render.
  const handlers = useRef({ onReady, onLost, onSelect, caption });
  useEffect(() => {
    handlers.current = { onReady, onLost, onSelect, caption };
  });
  const initialFocus = useRef(focus);

  // A theme change rebuilds the scene: the palette lives in the materials, and
  // a visitor toggles the theme rarely enough that a fresh sky is cheaper than
  // threading every uniform through a setter.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sky = createSky(canvas, labelsRef.current, {
      transits,
      reduced,
      light,
      caption: (id, place) => handlers.current.caption(id, place),
      onReady: () => handlers.current.onReady(),
      onLost: () => handlers.current.onLost(),
      onSelect: (id) => handlers.current.onSelect(id),
    });
    sky.focus(initialFocus.current);
    skyRef.current = sky;
    return () => {
      skyRef.current = null;
      sky.dispose();
    };
  }, [transits, reduced, light]);

  useEffect(() => {
    skyRef.current?.focus(focus);
  }, [focus]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none"
      />
      <div ref={labelsRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />
    </>
  );
}
