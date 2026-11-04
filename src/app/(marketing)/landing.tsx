"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { IntakeForm } from "@/components/cipher/hero-intake";
import { Actions, Facts, Lede, PanelHeading, pillClass as PILL, quietClass as QUIET, type Fact } from "@/components/cipher/panel";
import { DESTINATIONS, SpaceLink, useSpace } from "@/components/cipher/space-shell";
import type { GrahaId, Transit } from "@/components/cipher/sky/bodies";
import type { BodyId } from "@/components/cipher/sky/layout";
import { Reveal } from "@/components/motion/reveal";
import { useSound } from "@/components/providers/sound-provider";
import { Sheet } from "@/components/ui/sheet";

/**
 * The home page: the Earth close up with the nearest bodies circling it, and
 * the places in the sky that belong to the home page itself — your chart at
 * the Sun, the world at Mars, and a card for any graha you choose. Everything
 * else is a page of its own beside its planet.
 */

const READINGS: readonly Fact[] = [
  {
    title: "Your bodygraph",
    body: "Nine centres and thirty-six channels — the map we read together on the weekly call.",
    figure: "26",
  },
  {
    title: "Your KP chart",
    body: "Sidereal, Placidus, every sub lord. Members learn to read it in the courses and circles.",
    figure: "½″",
  },
  {
    title: "Your Aura Avatar",
    body: "Two words that are yours alone — the first thing people learn about you in the Commons.",
    figure: "2",
  },
];

/** What each graha that is not a destination says when you visit it. */
const MEANING: Partial<Record<GrahaId, { sanskrit: string; line: string }>> = {
  moon: { sanskrit: "Chandra", line: "The mind and the mother: how we feel our way through a day." },
  mercury: { sanskrit: "Budha", line: "Speech, learning, trade — and the wit to tell them apart." },
  saturn: { sanskrit: "Shani", line: "Time and discipline: the long work, and what it builds." },
  rahu: { sanskrit: "The north node", line: "Where the Moon's path rises through the Sun's: a hunger for the new." },
  ketu: { sanskrit: "The south node", line: "Where it falls back through: release, and what you already know by heart." },
};


export function Landing() {
  const { view, joinHref, transits } = useSpace();
  const [casting, setCasting] = useState(false);
  const { play } = useSound();

  const openIntake = () => {
    play("select");
    setCasting(true);
  };

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      {view === "home" ? (
        <Home joinHref={joinHref} transits={transits} onCast={openIntake} />
      ) : view === "sky" ? (
        <WholeSky />
      ) : (
        <Panel key={view}>
          {view === "sun" ? (
            <Chart joinHref={joinHref} onCast={openIntake} />
          ) : view === "mars" ? (
            <World />
          ) : (
            <TransitCard id={view} />
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
   Home: the Earth, close, with the nearest bodies circling it
   ------------------------------------------------------------------------- */

/** The places that keep a section of the site, in the order they are read. */
const PLACES: readonly BodyId[] = ["sun", "earth", "jupiter", "venus", "mars"];

/** Today's sky, in the order a person looks for it: the Moon first. */
const SKY_ORDER: readonly GrahaId[] = ["moon", "sun", "mercury", "venus", "mars", "jupiter", "saturn", "rahu", "ketu"];

function Home({
  joinHref,
  transits,
  onCast,
}: {
  joinHref: string;
  transits: readonly Transit[];
  onCast: () => void;
}) {
  return (
    <div className="pointer-events-none flex flex-1 flex-col">
      {/* The Earth's window on a phone: the space stays touchable here. */}
      <div aria-hidden="true" className="h-[40svh] shrink-0 lg:hidden" />

      <div className="pointer-events-auto relative flex-1 lg:w-[min(42rem,50vw)]">
        {/* A phone reads over a shade that rises from the Earth's edge; a wide
            screen reads over one that fades toward the planet. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 lg:hidden"
          style={{ backgroundImage: "linear-gradient(to bottom, transparent 0, color-mix(in srgb, var(--c-void) 92%, transparent) 5rem, var(--c-void) 11rem)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden lg:block"
          style={{ backgroundImage: "linear-gradient(to right, color-mix(in srgb, var(--c-void) 95%, transparent) 0, color-mix(in srgb, var(--c-void) 80%, transparent) 70%, transparent 100%)" }}
        />

        <div className="flex flex-col gap-14 px-6 pb-16 pt-6 sm:gap-16 lg:min-h-[calc(100svh-4rem)] lg:justify-center lg:px-12 lg:pb-20 lg:pt-10">
          <Hero joinHref={joinHref} onCast={onCast} />
          <TodaysSky transits={transits} />
          <Places />
        </div>
      </div>
    </div>
  );
}

function Hero({ joinHref, onCast }: { joinHref: string; onCast: () => void }) {
  return (
    <section aria-labelledby="home-title" className="max-w-[36rem]">
      <p className="intro-fade caption" style={{ animationDelay: "0.3s" }}>
        A Human Design &amp; KP astrology community
      </p>
      <h1
        id="home-title"
        className="mt-3 font-display text-[clamp(40px,7vw,84px)] leading-[0.96] tracking-[-0.01em] text-bone"
      >
        {["Read the sky", "together."].map((line, index) => (
          <span key={line} className="block overflow-hidden pb-[0.08em]">
            <span className="intro-line block" style={{ animationDelay: `${0.45 + index * 0.12}s` }}>
              {line}
            </span>
          </span>
        ))}
      </h1>
      <p
        className="intro-rise mt-5 max-w-[34ch] text-pretty text-[16px] leading-relaxed text-muted"
        style={{ animationDelay: "0.8s" }}
      >
        Cast your chart, learn to read it, and meet the people reading theirs beside you.
      </p>
      <div className="intro-rise mt-7 flex flex-wrap items-center gap-x-6 gap-y-4" style={{ animationDelay: "0.95s" }}>
        <Link href={joinHref} className={PILL}>
          Join the community
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </Link>
        <button type="button" onClick={onCast} className={QUIET}>
          Cast your chart free
        </button>
      </div>
    </section>
  );
}

/** Where each graha stands tonight; every one opens its own place in the sky. */
function TodaysSky({ transits }: { transits: readonly Transit[] }) {
  const rows = SKY_ORDER.map((id) => transits.find((transit) => transit.graha === id)).filter(
    (transit): transit is Transit => Boolean(transit),
  );
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="todays-sky" className="intro-fade max-w-[36rem]" style={{ animationDelay: "1.2s" }}>
      <h2 id="todays-sky" className="caption">
        Tonight&apos;s sky
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-muted">Cast for now, sidereal. Choose one to visit it.</p>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        {rows.map((transit) => {
          const node = transit.graha === "rahu" || transit.graha === "ketu";
          return (
            <li key={transit.graha} className="border-t border-hairline">
              <SpaceLink
                to={transit.graha}
                className="group block py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <span className="block font-display text-[17px] leading-tight text-bone transition-colors group-hover:text-gold">
                  {transit.name}
                  {transit.retrograde && !node ? <span className="ml-1.5 text-[13px] text-faint">℞</span> : null}
                </span>
                <span className="mt-0.5 block font-display text-[14px] italic leading-tight text-gold">{transit.place}</span>
              </SpaceLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The five places that keep a section of the site, one to a row. */
function Places() {
  return (
    <nav aria-labelledby="places-title" className="intro-fade max-w-[36rem]" style={{ animationDelay: "1.35s" }}>
      <h2 id="places-title" className="caption">
        Places in the sky
      </h2>
      <ul className="mt-4">
        {PLACES.map((id) => {
          const place = DESTINATIONS[id];
          if (!place) return null;
          return (
            <li key={id} className="border-t border-hairline">
              <SpaceLink
                to={id}
                className="group flex items-center justify-between gap-6 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <span>
                  <span className="block font-display text-[21px] leading-tight text-bone transition-colors group-hover:text-gold">
                    {place.title}
                  </span>
                  <span className="mt-1 block text-[14px] leading-snug text-muted">{place.line}</span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-gold"
                  strokeWidth={1.5}
                />
              </SpaceLink>
            </li>
          );
        })}
        <li className="border-t border-hairline pt-5">
          <SpaceLink to="sky" className={QUIET}>
            See the whole sky
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
          </SpaceLink>
        </li>
      </ul>
    </nav>
  );
}

/* ---------------------------------------------------------------------------
   The whole sky: every orbit at once, for anyone who wants to look around
   ------------------------------------------------------------------------- */

function WholeSky() {
  return (
    <div className="pointer-events-none flex flex-1 flex-col justify-end">
      <div className="pointer-events-auto relative px-6 pb-6 pt-14 sm:pb-8 lg:px-12 lg:pb-12">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/80 to-void/0" />
        <SpaceLink
          to="home"
          className="inline-flex items-center gap-2 font-display text-[15px] italic text-muted transition-colors hover:text-gold"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back to the Earth
        </SpaceLink>
        <p className="mt-3 font-display text-[17px] italic text-faint">
          Drag to look around. Pinch to zoom. Choose a planet to go there.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {PLACES.map((id) => (
            <li key={id}>
              <SpaceLink to={id} className="font-display text-[17px] text-bone transition-colors hover:text-gold">
                {DESTINATIONS[id]?.title}
              </SpaceLink>
            </li>
          ))}
        </ul>
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
            Back home
          </SpaceLink>
          <Reveal stagger={0.09} className="mt-6 flex flex-col">
            {children}
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Chart({ joinHref, onCast }: { joinHref: string; onCast: () => void }) {
  return (
    <>
      <PanelHeading as="h1" caption="The Sun · your chart">Bring the moment you were born.</PanelHeading>
      <Lede>One instant, held to the second, gives three readings — and a room of people to read them with.</Lede>
      <Facts items={READINGS} />
      <Actions>
        <button type="button" onClick={onCast} className={PILL}>
          Cast your chart free
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <Link href={joinHref} className={QUIET}>
          Join the community
        </Link>
      </Actions>
    </>
  );
}

function World() {
  return (
    <>
      <PanelHeading as="h1" caption="Mars · the world">A place to meet each other.</PanelHeading>
      <Lede>
        Walk, run and fly through a valley at dusk. Your chart hangs in the Observatory; your people gather in the Commons.
      </Lede>
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
      <Actions>
        <Link href="/world" className={PILL}>
          Enter the world
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </Link>
      </Actions>
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
      <PanelHeading as="h1" caption={`${meaning.sanskrit} · in transit today`}>
        {`${transit.name} in ${transit.place}`}
      </PanelHeading>
      <Lede>{meaning.line}</Lede>
      {transit.retrograde && !node ? (
        <p className="mt-3 font-display text-[16px] italic text-gold">Retrograde: moving backward through the sign, as seen from here.</p>
      ) : null}
      <Actions>
        <SpaceLink to="earth" className={PILL}>
          Talk it over in the Collective
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </SpaceLink>
        <SpaceLink to="sun" className={QUIET}>
          See it in your own chart
        </SpaceLink>
      </Actions>
    </>
  );
}
