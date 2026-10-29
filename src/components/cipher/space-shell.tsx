"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";

import type { Transit } from "@/components/cipher/sky/bodies";
import type { BodyId } from "@/components/cipher/sky/layout";
import { Starfield } from "@/components/cipher/starfield";
import { cn } from "@/lib/utils";

/**
 * The space the marketing site floats in.
 *
 * One WebGL sky stays alive across every marketing page, so following a link
 * flies the camera instead of loading a new page over a new background. Each
 * page has a body: the home page is the whole sky, and the others sit beside
 * the planet that keeps them. The home page also holds a few destinations of
 * its own — your chart at the Sun, the world at Mars, and a card for any
 * graha — addressed by the URL's hash.
 *
 * Without WebGL the same pages render over a still field of stars; every
 * destination is still reachable from the page's own links.
 */

const SkyCanvas = dynamic(() => import("./sky/sky-canvas").then((module) => module.SkyCanvas), { ssr: false });

export interface Destination {
  title: string;
  href: string;
  /** One line on what is there. */
  line: string;
}

/** The bodies that keep a section of the site, and where they lead. */
export const DESTINATIONS: Partial<Record<BodyId, Destination>> = {
  sun: { title: "Your chart", href: "/#sun", line: "Cast it, and see what we read in it." },
  earth: { title: "The Collective", href: "/collective", line: "The people reading beside you." },
  jupiter: { title: "The Method", href: "/method", line: "How the chart is cast, and why." },
  venus: { title: "Membership", href: "/membership", line: "Join, and find your seat." },
  mars: { title: "The World", href: "/#mars", line: "A valley you can walk through together." },
};

const ROUTE_FOCUS: Record<string, BodyId> = {
  "/collective": "earth",
  "/method": "jupiter",
  "/membership": "venus",
  "/membership/apply": "venus",
};

const BODY_IDS: readonly BodyId[] = ["earth", "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];

interface Space {
  transits: readonly Transit[];
  joinHref: string;
  /** What the camera is on: a body, or `null` for the whole sky. */
  focus: BodyId | null;
  /** Go to a body (or the whole sky), by its page or the home page's hash. */
  go: (id: BodyId | null) => void;
}

const SpaceContext = createContext<Space | null>(null);

export function useSpace(): Space {
  const space = useContext(SpaceContext);
  if (!space) throw new Error("useSpace must be used inside <SpaceShell>");
  return space;
}

// The home page's hash, as an external store: it changes outside React.
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener("cipher:hash", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("cipher:hash", onChange);
  };
}
const readHash = () => window.location.hash.slice(1);
const serverHash = () => "";

/** Whether this browser can create a WebGL context at all. */
function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type Fidelity = "pending" | "webgl" | "still";

export function SpaceShell({
  transits,
  joinHref,
  header,
  footer,
  children,
}: {
  transits: readonly Transit[];
  joinHref: string;
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const hash = useSyncExternalStore(subscribeHash, readHash, serverHash);

  const home = pathname === "/";
  const hashFocus = home && (BODY_IDS as readonly string[]).includes(hash) ? (hash as BodyId) : null;
  const focus = ROUTE_FOCUS[pathname] ?? hashFocus;

  const go = useCallback(
    (id: BodyId | null) => {
      const href = id === null ? "/" : DESTINATIONS[id]?.href ?? `/#${id}`;
      const [path, fragment = ""] = href.split("#");
      if (path === "/" && home) {
        // A hash on the page we are on: no navigation, just a new place to look.
        window.history.pushState(null, "", fragment ? `/#${fragment}` : "/");
        window.dispatchEvent(new Event("cipher:hash"));
      } else {
        router.push(href, { scroll: true });
      }
    },
    [home, router],
  );

  const [fidelity, setFidelity] = useState<Fidelity>("pending");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Decided after mount: the server cannot know.
    const frame = requestAnimationFrame(() => setFidelity(detectWebgl() ? "webgl" : "still"));
    return () => cancelAnimationFrame(frame);
  }, []);
  const markReady = useCallback(() => setReady(true), []);
  const fallBack = useCallback(() => setFidelity("still"), []);

  const caption = useCallback(
    (id: BodyId, place: string) => DESTINATIONS[id]?.title ?? place,
    [],
  );

  const space = useMemo<Space>(() => ({ transits, joinHref, focus, go }), [transits, joinHref, focus, go]);
  const showSky = fidelity === "webgl" && ready;

  return (
    <SpaceContext.Provider value={space}>
      <div aria-hidden={fidelity !== "webgl"} className="fixed inset-0 z-0 overflow-hidden bg-void">
        <div className={cn("absolute inset-0 transition-opacity duration-[1400ms]", showSky ? "opacity-0" : "opacity-80")}>
          <Starfield />
        </div>
        {fidelity === "webgl" ? (
          <div className={cn("absolute inset-0 transition-opacity duration-[1400ms]", showSky ? "opacity-100" : "opacity-0")}>
            <SkyCanvas
              transits={transits}
              reduced={reduced}
              focus={focus}
              caption={caption}
              onReady={markReady}
              onLost={fallBack}
              onSelect={go}
            />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col">
        <div className="pointer-events-auto sticky top-0 z-40">{header}</div>
        {home ? (
          <div className="flex flex-1 flex-col">{children}</div>
        ) : (
          <BodyPage>{children}</BodyPage>
        )}
        {home ? null : <div className="pointer-events-auto">{footer}</div>}
      </div>
    </SpaceContext.Provider>
  );
}

/**
 * A page that belongs to a body: the planet keeps the right of a wide screen
 * and the top of a phone, and the page reads beside or below it, over a
 * shade that lets the space show through.
 */
function BodyPage({ children }: { children: ReactNode }) {
  const { go } = useSpace();
  return (
    <div className="flex flex-1 flex-col">
      {/* The planet's window on a phone: the space stays touchable here. */}
      <div aria-hidden="true" className="h-[34svh] shrink-0 lg:hidden" />
      <div className="pointer-events-auto relative flex-1 lg:w-[min(52rem,58vw)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-void/0 via-void/85 to-void lg:bg-gradient-to-r lg:from-void/95 lg:via-void/85 lg:to-void/0"
        />
        <div className="px-6 pb-20 pt-4 lg:px-12 lg:pr-24 lg:pt-10">
          <button
            type="button"
            onClick={() => go(null)}
            className="inline-flex items-center gap-2 font-display text-[15px] italic text-muted transition-colors hover:text-gold"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            The whole sky
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A link that travels: to a body's page or the home page's hash. */
export function SpaceLink({
  to,
  className,
  children,
}: {
  to: BodyId | null;
  className?: string;
  children: ReactNode;
}) {
  const { go } = useSpace();
  const href = to === null ? "/" : DESTINATIONS[to]?.href ?? `/#${to}`;
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        go(to);
      }}
    >
      {children}
    </Link>
  );
}
