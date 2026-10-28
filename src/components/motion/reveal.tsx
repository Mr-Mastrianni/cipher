"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";
import {
  EASE_OUT,
  gsap,
  LIGHT_MOTION,
  RICH_MOTION,
  SplitText,
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

type RiseTag = "h1" | "h2" | "h3" | "p";

/**
 * A heading that rises line by line from behind its own baseline, the way a
 * title card is uncovered. SplitText re-splits on resize and font load, so the
 * lines are always the lines actually on screen.
 */
export function RiseText({
  as: Tag = "h2",
  children,
  className,
  delay = 0,
}: {
  as?: RiseTag;
  children: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;

      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(element, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 115,
              duration: 1.2,
              delay,
              stagger: 0.09,
              ease: EASE_OUT,
              scrollTrigger: { trigger: element, start: "top 88%", once: true },
            }),
        });
        return () => split.revert();
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={cn("text-balance", className)}>
      {children}
    </Tag>
  );
}
