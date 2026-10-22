import type { ReactNode } from "react";

/**
 * The route transition.
 *
 * `template.tsx` re-mounts on every navigation (a layout does not), which is
 * what makes a one-shot enter animation work per page.
 *
 * It is deliberately **CSS, not `motion`**: a motion wrapper renders its
 * initial `opacity: 0` inline on the server and animates on the client, so any
 * hydration mismatch on the page left the content permanently invisible. CSS
 * animation produces identical markup on both sides. The reduced-motion block
 * in globals.css collapses it to a single frame.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="route-in">{children}</div>;
}
