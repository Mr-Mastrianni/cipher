"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { IntakeForm } from "@/components/cipher/hero-intake";
import { DESTINATIONS, SpaceLink, useSpace } from "@/components/cipher/space-shell";
import type { GrahaId } from "@/components/cipher/sky/bodies";
import type { BodyId } from "@/components/cipher/sky/layout";
import { Reveal } from "@/components/motion/reveal";
import { useSound } from "@/components/providers/sound-provider";
import { Sheet } from "@/components/ui/sheet";

/**
 * The home page: the whole sky, and the places in it that belong to the home
 * page itself — your chart at the Sun, the world at Mars, and a card for any
 * graha you choose. Everything else is a page of its own beside its planet.
 */

const READINGS = [
  {
    title: "Your bodygraph",
    body: "Nine centres and thirty-six channels — the map we read together on the weekly call.",
    figure: "26",
    unit: "activations",
  },
  {
    title: "Your KP chart",
    body: "Sidereal, Placidus, every sub lord. Members learn to read it in the courses and circles.",
    figure: "½″",
    unit: "from the Swiss Ephemeris",
  },
  {
    title: "Your Aura Avatar",
    body: "Two words that are yours alone — the first thing people learn about you in the Commons.",
    figure: "2",
    unit: "words, yours alone",
  },
] as const;

/** What each graha that is not a destination says when you visit it. */
const MEANING: Partial<Record<GrahaId, { sanskrit: string; line: string }>> = {
  moon: { sanskrit: "Chandra", line: "The mind and the mother: how we feel our way through a day." },
  mercury: { sanskrit: "Budha", line: "Speech, learning, trade — and the wit to tell them apart." },
  saturn: { sanskrit: "Shani", line: "Time and discipline: the long work, and what it builds." },
  rahu: { sanskrit: "The north node", line: "Where the Moon's path rises through the Sun's: a hunger for the new." },
  ketu: { sanskrit: "The south node", line: "Where it falls back through: release, and what you already know by heart." },
};

const PILL =
  "inline-flex items-center gap-2.5 rounded-full bg-bone px-6 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";
const QUIET =
  "inline-flex items-center gap-2 text-[15px] text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-bone hover:decoration-gold";

export function Landing() {
  const { focus, joinHref, transits } = useSpace();
  const [casting, setCasting] = useState(false);
  const { play } = useSound();
  const moon = transits.find((transit) => transit.graha === "moon");

  const openIntake = () => {
    play("select");
    setCasting(true);
  };

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      {focus === null ? (
        <Overview joinHref={joinHref} moonPlace={moon?.place} onCast={openIntake} />
      ) : (
        <Panel key={focus}>
          {focus === "sun" ? (
            <Chart joinHref={joinHref} onCast={openIntake} />
          ) : focus === "mars" ? (
            <World />
          ) : (
            <TransitCard id={focus} />
          )}
        </Panel>
      )}

      <Sheet
        open={casting}
        onOpenChange={setCasting}
        side="bottom"
        title="One instant, held to the second."
        description="The date, the time and the place. The time zone is confirmed by you, never guessed."
      >
        <div className="mx-auto w-full max-w-2xl pt-2">
          <IntakeForm />
        </div>
      </Sheet>
    </main>
  );
}

/* ---------------------------------------------------------------------------
   The whole sky
   ------------------------------------------------------------------------- */

function Overview({
  joinHref,
  moonPlace,
  onCast,
}: {
  joinHref: string;
  moonPlace?: string;
  onCast: () => void;
}) {
  const visits: BodyId[] = ["sun", "earth", "jupiter", "venus", "mars"];
  return (
    <div className="pointer-events-none flex flex-1 flex-col justify-end">
      <div className="pointer-events-auto relative px-6 pb-6 pt-16 sm:pb-8 sm:pt-24 lg:px-12 lg:pb-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/80 to-void/0 lg:bg-gradient-to-tr lg:via-void/55"
        />
        <div className="max-w-[40rem]">
          <p className="intro-fade caption" style={{ animationDelay: "0.3s" }}>
            A Human Design &amp; KP astrology community
          </p>
          <h1 className="mt-3 font-display text-[clamp(44px,7.4vw,92px)] leading-[0.95] tracking-[-0.01em] text-bone">
            {["Read the sky", "together."].map((line, index) => (
              <span key={line} className="block overflow-hidden pb-[0.08em]">
                <span className="intro-line block" style={{ animationDelay: `${0.45 + index * 0.12}s` }}>
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <p className="intro-rise mt-5 hidden max-w-[36ch] text-pretty text-[16px] leading-relaxed text-muted sm:block" style={{ animationDelay: "0.8s" }}>
            Cast your chart, learn to read it, and meet the people reading theirs beside you.
          </p>
          <div className="intro-rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-7" style={{ animationDelay: "0.95s" }}>
            <Link href={joinHref} className={PILL}>
              Join the community
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <button type="button" onClick={onCast} className={QUIET}>
              Cast your chart free
            </button>
          </div>
        </div>

        <nav
          aria-label="Places in the sky"
          className="intro-fade mt-7 flex flex-col gap-3 border-t border-hairline pt-4 sm:mt-10 sm:flex-row sm:items-end sm:justify-between sm:pt-5"
          style={{ animationDelay: "1.2s" }}
        >
          <div>
            <p className="font-display text-[15px] italic text-faint">
              Drag to look around. Choose a planet to go there.
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
              {visits.map((id) => (
                <li key={id}>
                  <SpaceLink to={id} className="font-display text-[17px] text-bone transition-colors hover:text-gold">
                    {DESTINATIONS[id]?.title}
                  </SpaceLink>
                </li>
              ))}
            </ul>
          </div>
          {moonPlace ? (
            <SpaceLink to="moon" className="font-display text-[15px] italic text-muted transition-colors hover:text-gold">
              Tonight&apos;s Moon is in <span className="text-gold">{moonPlace}</span>
            </SpaceLink>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   A place in the sky: the panel beside (or under) its body
   ------------------------------------------------------------------------- */

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none flex flex-1 flex-col">
      {/* The body's window on a phone: the space stays touchable here. */}
      <div aria-hidden="true" className="h-[36svh] shrink-0 lg:hidden" />
      <div className="pointer-events-auto relative flex-1 lg:w-[min(46rem,52vw)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-void/0 via-void/85 to-void lg:bg-gradient-to-r lg:from-void/95 lg:via-void/80 lg:to-void/0"
        />
        <div className="px-6 pb-16 pt-4 lg:px-12 lg:pr-24 lg:pt-10">
          <SpaceLink
            to={null}
            className="inline-flex items-center gap-2 font-display text-[15px] italic text-muted transition-colors hover:text-gold"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            The whole sky
          </SpaceLink>
          <Reveal stagger={0.09} className="mt-6 flex flex-col">
            {children}
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Heading({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div>
      <p className="caption">{caption}</p>
      <h2 className="mt-2 max-w-[16ch] font-display text-[clamp(36px,5vw,60px)] leading-[1.0] text-bone">{children}</h2>
    </div>
  );
}

function Chart({ joinHref, onCast }: { joinHref: string; onCast: () => void }) {
  return (
    <>
      <Heading caption="The Sun · your chart">Bring the moment you were born.</Heading>
      <p className="mt-5 max-w-[38ch] text-pretty text-[16px] leading-relaxed text-muted">
        One instant, held to the second, gives three readings — and a room of people to read them with.
      </p>
      <ol className="mt-8 flex flex-col">
        {READINGS.map((reading) => (
          <li key={reading.title} className="flex items-baseline gap-5 border-t border-hairline py-5">
            <span className="w-16 shrink-0 font-display text-4xl text-gold">{reading.figure}</span>
            <span>
              <span className="block font-display text-2xl text-bone">{reading.title}</span>
              <span className="mt-1 block max-w-[36ch] text-[15px] leading-relaxed text-muted">{reading.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <button type="button" onClick={onCast} className={PILL}>
          Cast your chart free
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <Link href={joinHref} className={QUIET}>
          Join the community
        </Link>
      </div>
    </>
  );
}

function World() {
  return (
    <>
      <Heading caption="Mars · the world">A place to meet each other.</Heading>
      <p className="mt-5 max-w-[38ch] text-pretty text-[16px] leading-relaxed text-muted">
        Walk, run and fly through a valley at dusk. Your chart hangs in the Observatory; your people gather in the Commons.
      </p>
      <figure className="mt-8 overflow-hidden rounded-lg border border-hairline">
        <Image
          src="/world-preview.jpg"
          style={{ filter: "saturate(0.62) sepia(0.12) contrast(1.04)" }}
          alt="Inside the Observatory: a glowing astrolabe of the zodiac above a still basin, with the member's KP chart and Human Design bodygraph on two screens."
          width={1600}
          height={900}
          sizes="(max-width: 1024px) 100vw, 46rem"
          className="h-auto w-full object-cover"
        />
      </figure>
      <div className="mt-8">
        <Link href="/world" className={PILL}>
          Enter the world
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </Link>
      </div>
    </>
  );
}

function TransitCard({ id }: { id: BodyId }) {
  const { transits } = useSpace();
  const transit = transits.find((candidate) => candidate.graha === id);
  const meaning = id === "earth" ? undefined : MEANING[id];
  if (!transit || !meaning) return null;
  const node = id === "rahu" || id === "ketu";
  return (
    <>
      <Heading caption={`${meaning.sanskrit} · in transit today`}>
        {`${transit.name} in ${transit.place}`}
      </Heading>
      <p className="mt-5 max-w-[38ch] text-pretty text-[16px] leading-relaxed text-muted">{meaning.line}</p>
      {transit.retrograde && !node ? (
        <p className="mt-3 font-display text-[16px] italic text-gold">Retrograde: moving backward through the sign, as seen from here.</p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <SpaceLink to="earth" className={PILL}>
          Talk it over in the Collective
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </SpaceLink>
        <SpaceLink to="sun" className={QUIET}>
          See it in your own chart
        </SpaceLink>
      </div>
    </>
  );
}
