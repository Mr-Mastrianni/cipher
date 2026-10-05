import Link from "next/link";
import { Cosmogram } from "@/components/cipher/cosmogram";

/**
 * 404 — kept in the site's voice rather than Next's default. A wrong turn
 * should still feel like part of the building.
 */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="h-28 w-28 opacity-60">
        <Cosmogram className="h-full w-full" progress={0.25} animated={false} />
      </div>

      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl leading-tight text-bone sm:text-4xl">
        There is no gate here.
      </h1>
      <p className="mt-5 max-w-md text-pretty leading-relaxed text-muted">
        The page you asked for either never existed or has been moved. Sixty-four
        gates, thirty-six channels, and this is none of them.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-gold px-6 py-2.5 text-sm font-semibold text-on-accent transition-all hover:brightness-110"
        >
          Back to the threshold
        </Link>
        <Link
          href="/enter"
          className="rounded-md border border-line px-6 py-2.5 text-sm font-semibold text-bone transition-all hover:border-gold hover:text-gold"
        >
          Enter your coordinates
        </Link>
      </div>
    </main>
  );
}
