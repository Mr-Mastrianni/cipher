import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Max-width preset for a page's content column. */
export type PageWidth = "sm" | "md" | "lg" | "wide";

const WIDTHS: Record<PageWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  wide: "max-w-7xl",
};

export interface PageShellProps {
  children?: ReactNode;
  /** Content width. Defaults to `lg`. */
  width?: PageWidth;
  className?: string;
}

/** Page-level layout: centred column with consistent gutters and rhythm. */
export function PageShell({
  children,
  width = "lg",
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  /** Small mono caps label above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links aligned with the title on wide viewports. */
  actions?: ReactNode;
  className?: string;
}

/** The masthead of a page: eyebrow, title, description, and actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-3 border-b border-hairline pb-8", className)}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          {eyebrow ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-3xl leading-tight text-bone text-balance sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted text-pretty sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
