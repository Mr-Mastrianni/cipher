import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/", label: "Threshold" },
      { href: "/method", label: "The Method" },
      { href: "/membership", label: "Membership" },
      { href: "/chart", label: "Your Chart" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/collective", label: "Starseed Collective" },
      { href: "/journal", label: "Journal" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
] as const;

export interface SiteFooterProps {
  className?: string;
}

/** The restrained site footer: wordmark, short copy, link columns, and provenance. */
export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto border-t border-hairline bg-abyss/40",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Link
              href="/"
              aria-label="The Cipher — home"
              className="font-display text-sm tracking-[0.24em] text-gradient-gold"
            >
              THE CIPHER
            </Link>
            <p className="text-sm leading-relaxed text-muted text-pretty">
              Your design, computed from the moment you arrived — and turned
              into a signal you can actually run.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
                  {column.title}
                </h2>
                <ul className="mt-4 flex list-none flex-col gap-2.5 p-0">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors duration-200 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="rule" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            <Check aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5 text-ok" />
            Computations verified against the ephemeris and the Rave bodygraph
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            © {new Date().getFullYear()} The Cipher
          </p>
        </div>
      </div>
    </footer>
  );
}
