"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SectionProps {
  /** Small mono caps label above the title. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons or links aligned with the title on wide viewports. */
  actions?: ReactNode;
  /** Anchor id for in-page links. */
  id?: string;
  /** Reveal the section when it scrolls into view. Defaults to `true`. */
  reveal?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * A page section with an optional eyebrow/title/description header that fades
 * and lifts into view once. Under reduced motion it renders statically.
 */
export function Section({
  eyebrow,
  title,
  description,
  actions,
  id,
  reveal = true,
  className,
  children,
}: SectionProps) {
  const reduced = useReducedMotion();
  const animated = reveal && !reduced;
  const hasHeader = Boolean(eyebrow || title || description || actions);

  return (
    <motion.section
      id={id}
      initial={animated ? { opacity: 0, y: 18 } : false}
      whileInView={animated ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col gap-6", className)}
    >
      {hasHeader ? (
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            {eyebrow ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="font-display text-2xl leading-tight text-bone text-balance sm:text-3xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted text-pretty">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      {children}
    </motion.section>
  );
}
