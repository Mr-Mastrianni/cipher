"use client";

import { useRef } from "react";

import {
  EASE_OUT,
  gsap,
  LIGHT_MOTION,
  RICH_MOTION,
  useGSAP,
} from "./gsap";

/**
 * Content that arrives as it enters the viewport: out of a blur, up and into
 * focus. With `stagger`, each direct child arrives in turn instead of the
 * block as a whole — the device for a row of small facts.
 *
 * The markup is the final state; GSAP only plays it in, so nothing is lost
 * without JavaScript or with reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  stagger,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      const targets = stagger ? Array.from(element.children) : element;

      gsap.matchMedia().add(
        { rich: RICH_MOTION, light: LIGHT_MOTION },
        (context) => {
          const rich = Boolean(context.conditions?.rich);
          gsap.from(targets, {
            autoAlpha: 0,
            y: rich ? 24 : 18,
            ...(rich ? { scale: 1.03, filter: "blur(12px)" } : {}),
            duration: rich ? 1.2 : 0.9,
            delay,
            stagger,
            ease: EASE_OUT,
            clearProps: "filter,transform",
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
          });
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
