"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { Transit } from "./planets";
import { createSky } from "./sky";

/**
 * Mounts the WebGL sky behind the page. The scene itself lives in `sky.ts`;
 * this only owns the canvas, the label layer and the lifetime.
 */
export function SkyCanvas({
  transits,
  reduced,
  scroll,
  onReady,
  onLost,
}: {
  transits: readonly Transit[];
  reduced: boolean;
  scroll: RefObject<{ px: number; progress: number }>;
  onReady: () => void;
  onLost: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sky = createSky(canvas, labelsRef.current, {
      transits,
      reduced,
      readScroll: () => scroll.current,
      onReady,
      onLost,
    });
    return () => sky.dispose();
  }, [transits, reduced, scroll, onReady, onLost]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={labelsRef} className="absolute inset-0 overflow-hidden" />
    </>
  );
}
