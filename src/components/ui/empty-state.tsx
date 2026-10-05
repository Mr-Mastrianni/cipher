import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Decorative glyph; hidden from assistive tech. */
  icon?: ReactNode;
  /** Short headline. */
  title: ReactNode;
  /** One or two lines explaining what to do next. */
  description?: ReactNode;
  /** Optional call to action. */
  action?: ReactNode;
}

/** A centred placeholder for empty collections, unrun computations, and 404s. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-raised text-gold"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="font-display text-lg text-bone text-balance">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted text-pretty">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
