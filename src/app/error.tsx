"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * It deliberately does not surface a stack trace to the user — the digest is
 * shown instead, which is enough to correlate with the server logs without
 * leaking internals.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only place a raw error is logged, and only to the browser console.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-danger">
        interrupted
      </p>
      <h1 className="mt-4 font-display text-3xl leading-tight text-bone sm:text-4xl">
        Something broke on the way here.
      </h1>
      <p className="mt-5 max-w-md text-pretty leading-relaxed text-muted">
        The calculation stopped before it finished. Nothing you entered was
        stored. Try again, and if it keeps happening the reference below will
        help us find it.
      </p>

      {error.digest && (
        <p className="mt-6 font-mono text-[11px] tracking-wider text-faint">
          ref {error.digest}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-2.5 text-sm font-semibold text-on-accent transition-all hover:brightness-110"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-line px-6 py-2.5 text-sm font-semibold text-bone transition-all hover:border-gold hover:text-gold"
        >
          Back to the threshold
        </Link>
      </div>
    </main>
  );
}
