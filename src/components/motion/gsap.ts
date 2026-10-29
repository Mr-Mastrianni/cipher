"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

/**
 * One place to register GSAP's plugins. Every scroll component imports from
 * here, so the registration runs once and before any of them mounts.
 */
gsap.registerPlugin(ScrollTrigger, useGSAP);

/** The house curve — the same `cubic-bezier(.22,1,.36,1)` the CSS uses. */
export const EASE_OUT = "expo.out";

/**
 * Blur is the expensive part of the reveal. Touch devices get the rise and the
 * fade without it, which keeps scrolling at frame rate on mid-range phones.
 */
export const RICH_MOTION =
  "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)";
export const LIGHT_MOTION =
  "(prefers-reduced-motion: no-preference) and not ((hover: hover) and (pointer: fine))";

export { gsap, ScrollTrigger, useGSAP };
