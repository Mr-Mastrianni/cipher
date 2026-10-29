import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The pieces every place in the sky is written with: a caption and a title, a
 * single line of lede, a few facts, two calls, and the depth folded away under
 * "more" so a page reads in a minute and still holds everything.
 */

export const pillClass =
  "inline-flex items-center gap-2.5 rounded-full bg-bone px-6 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";

export const quietClass =
  "inline-flex items-center gap-2 text-[15px] text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-bone hover:decoration-gold";

export function PanelHeading({
  caption,
  as: Tag = "h2",
  children,
}: {
  caption: string;
  as?: "h1" | "h2";
  children: ReactNode;
}) {
  return (
    <div>
      <p className="caption">{caption}</p>
      <Tag className="mt-2 max-w-[16ch] text-balance font-display text-[clamp(36px,5vw,60px)] leading-[1.0] text-bone">
        {children}
      </Tag>
    </div>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-5 max-w-[40ch] text-pretty text-[16px] leading-relaxed text-muted">{children}</p>;
}

export interface Fact {
  /** A number or short mark set large beside the fact. */
  figure?: string;
  title: string;
  body: string;
  /** A quiet note after the title, such as who it is open to. */
  tag?: string;
}

export function Facts({ items, className }: { items: readonly Fact[]; className?: string }) {
  return (
    <ul className={cn("mt-8 flex flex-col", className)}>
      {items.map((item) => (
        <li key={item.title} className="flex items-baseline gap-5 border-t border-hairline py-5">
          {item.figure ? (
            <span className="w-16 shrink-0 font-display text-4xl leading-none text-gold">{item.figure}</span>
          ) : null}
          <span>
            <span className="block font-display text-2xl text-bone">
              {item.title}
              {item.tag ? <span className="ml-3 text-[15px] italic text-gold">{item.tag}</span> : null}
            </span>
            <span className="mt-1 block max-w-[38ch] text-[15px] leading-relaxed text-muted">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">{children}</div>;
}

/** Depth, folded: a native disclosure, so it works without JavaScript. */
export function More({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group border-t border-hairline">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-display text-xl text-bone transition-colors hover:text-gold [&::-webkit-details-marker]:hidden">
        {summary}
        <Plus
          aria-hidden="true"
          strokeWidth={1.4}
          className="h-4 w-4 shrink-0 text-faint transition-transform duration-300 group-open:rotate-45 group-open:text-gold"
        />
      </summary>
      <div className="pb-6 text-[15px] leading-relaxed text-muted">{children}</div>
    </details>
  );
}

/** A stack of folded sections under a quiet heading. */
export function Further({ title = "More", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-12">
      <p className="caption">{title}</p>
      <div className="mt-3 border-b border-hairline">{children}</div>
    </div>
  );
}
