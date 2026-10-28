"use client";

import { useEffect, useRef } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import "lenis/dist/lenis.css";

import { gsap, ScrollTrigger } from "./gsap";

/**
 * Smoothed wheel scrolling for the landing, on GSAP's clock.
 *
 * Lenis only eases the wheel and the trackpad; touch stays native
 * (`syncTouch: false`) because a phone's own momentum is better than any
 * imitation of it. It honours `prefers-reduced-motion` by itself. Anything
 * inside a modal dialog scrolls natively, so a sheet opened over the page
 * keeps its own scroll.
 */
export function SmoothScroll() {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const lenis = lenisRef.current?.lenis;
    if (!lenis) return;

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", ScrollTrigger.update);

    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", ScrollTrigger.update);
    };
  }, []);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        autoRaf: false,
        lerp: 0.1,
        syncTouch: false,
        anchors: true,
        prevent: (node) => node.getAttribute("aria-modal") === "true",
      }}
    />
  );
}
