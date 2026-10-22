"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Globe2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorldLine } from "./world-scene";

/**
 * The WebGL boundary.
 *
 * `three` is heavy, so the scene is loaded with `ssr: false` and only on this
 * route. Two guards protect the rest of the app:
 *
 *  1. **Capability.** Some browsers and locked-down GPUs cannot create a WebGL
 *     context at all. The page checks first and offers the flat map instead of
 *     letting the renderer throw.
 *  2. **Failure.** If the context is lost mid-session (a known mobile Safari
 *     behaviour), an error boundary swaps in the same fallback rather than the
 *     app's error screen.
 *
 * The 3D view is an enhancement: `/dashboard/map` holds the same information,
 * so a member is never locked out of their own chart by a GPU.
 */
const WorldScene = dynamic(
  () => import("./world-scene").then((module) => module.WorldScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          Opening the world…
        </p>
      </div>
    ),
  },
);

function WorldFallback() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <Globe2 aria-hidden="true" className="h-6 w-6 text-gold" strokeWidth={1.5} />
        <p className="font-display text-xl text-bone">
          This device cannot open the 3D view
        </p>
        <p className="text-sm leading-relaxed text-muted text-pretty">
          The browser or graphics driver refused a WebGL context. Your lines,
          nakshatras and relocated charts are all still on the flat map.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard/map">Open the flat cosmic map</Link>
        </Button>
      </div>
    </div>
  );
}

/** Catches a renderer crash or a lost context. */
class WorldBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <WorldFallback /> : this.props.children;
  }
}

/** Whether this browser can create a WebGL context at all. */
function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return Boolean(context);
  } catch {
    return false;
  }
}

export function WorldCanvas({
  lines,
  nakshatras,
  moonLongitude,
}: {
  lines: WorldLine[];
  nakshatras: readonly string[];
  moonLongitude?: number;
}) {
  // `null` until the client has checked, so server and first paint agree.
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // A WebGL capability probe can only run in the browser; reading it during
    // render would disagree with the server's HTML and break hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(detectWebgl());
  }, []);

  return (
    <div className="relative h-[68vh] min-h-[26rem] w-full overflow-hidden rounded-xl border border-hairline bg-abyss">
      {supported === false ? (
        <WorldFallback />
      ) : supported === null ? (
        <div className="grid h-full place-items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
            Preparing the world…
          </p>
        </div>
      ) : (
        <WorldBoundary>
          <WorldScene
            lines={lines}
            nakshatras={nakshatras}
            moonLongitude={moonLongitude}
          />
        </WorldBoundary>
      )}

      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-[9px] uppercase tracking-[0.24em] text-faint">
        drag to rotate · scroll to zoom
      </p>
    </div>
  );
}
