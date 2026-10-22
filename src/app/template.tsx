"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The route transition.
 *
 * `template.tsx` re-mounts on every navigation (a layout does not), which is
 * what makes a one-shot fade-and-rise work per page. It is deliberately short:
 * a transition should cover the swap, not delay the content. Under reduced
 * motion it renders nothing at all, so no wrapper and no movement.
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
