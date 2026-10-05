import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Add a hover lift, gold border, and elevation — use for clickable cards. */
  interactive?: boolean;
}

/** A translucent panel built on the `.surface` primitive. */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "surface",
        interactive &&
          "transition-[transform,border-color,box-shadow] duration-300 ease-out-quint hover:border-gold/40 hover:shadow-md motion-safe:hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}

/** The top region of a card: title and description. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

/** The card's heading, set in the display face. */
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-lg leading-snug text-bone", className)}
      {...props}
    />
  );
}

/** Supporting copy under a card title. */
export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted text-pretty", className)}
      {...props}
    />
  );
}

/** The card's main body region. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

/** The card's trailing action region. */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 p-6 pt-0", className)}
      {...props}
    />
  );
}
