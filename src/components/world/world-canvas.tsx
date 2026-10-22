"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Globe2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorldLine, WorldPlanet } from "./world-scene";

/**
 * The WebGL boundary and the graha HUD.
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

/** The graha list: select one to swing it to the front. */
function GrahaHud({
  planets,
  selected,
  onSelect,
}: {
  planets: WorldPlanet[];
  selected: string | null;
  onSelect: (graha: string | null) => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 max-h-[70%] w-44 overflow-y-auto rounded-lg border border-hairline bg-void/80 p-2 backdrop-blur">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "mb-1 w-full rounded px-2 py-1 text-left font-mono text-[9px] uppercase tracking-[0.18em] transition-colors",
          selected === null ? "bg-raised text-gold" : "text-faint hover:text-bone",
        )}
      >
        The whole sky
      </button>
      <ul className="flex list-none flex-col gap-px p-0">
        {planets.map((planet) => {
          const active = selected === planet.graha;
          return (
            <li key={planet.graha}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : planet.graha)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-baseline gap-2 rounded px-2 py-1 text-left transition-colors",
                  active ? "bg-raised" : "hover:bg-raised/70",
                )}
              >
                <span aria-hidden="true" className="w-4 shrink-0 text-sm text-bone">
                  {planet.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-xs capitalize",
                      active ? "text-gold" : "text-bone",
                    )}
                  >
                    {planet.graha}
                  </span>
                  <span className="block truncate text-[10px] text-faint">
                    {planet.nakshatra} · {planet.longitude.toFixed(2)}°
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WorldCanvas({
  lines,
  nakshatras,
  planets,
  moonLongitude,
}: {
  lines: WorldLine[];
  nakshatras: readonly string[];
  planets: WorldPlanet[];
  moonLongitude?: number;
}) {
  // `null` until the client has checked, so server and first paint agree.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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
            planets={planets}
            selected={selected}
            onSelect={setSelected}
            moonLongitude={moonLongitude}
          />
        </WorldBoundary>
      )}

      <GrahaHud planets={planets} selected={selected} onSelect={setSelected} />

      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-[9px] uppercase tracking-[0.24em] text-faint">
        drag to rotate · scroll to zoom
      </p>
    </div>
  );
}
