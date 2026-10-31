"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

import { IntakeForm } from "@/components/cipher/hero-intake";
import { Actions, Facts, Lede, PanelHeading, pillClass as PILL, quietClass as QUIET, type Fact } from "@/components/cipher/panel";
import { BODY_IDS, DESTINATIONS, SpaceLink, useSpace } from "@/components/cipher/space-shell";
import type { GrahaId, Transit } from "@/components/cipher/sky/bodies";
import type { BodyId } from "@/components/cipher/sky/layout";
import { Reveal } from "@/components/motion/reveal";
import { useSound } from "@/components/providers/sound-provider";
import { Sheet } from "@/components/ui/sheet";

/**
 * The home page: the whole sky, and the places in it that belong to the home
 * page itself — your chart at the Sun, the world at Mars, and a card for any
 * graha you choose. Everything else is a page of its own beside its planet.
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


/**
 * The title the root layout gives the home page. Mirrored here because the sky
 * changes without a navigation, and Next only rewrites the title when the route
 * does; this is what we put back when the visitor returns to the whole sky.
 */
const HOME_TITLE = "The Cipher — enter your coordinates";

/** How a place in the sky names itself: in a title, and to a screen reader. */
function placeLabel(id: BodyId, transits: readonly Transit[]): string {
  const transit = transits.find((candidate) => candidate.graha === id);
  const name = transit?.name ?? "Earth";
  if (id === "sun") return "The Sun · your chart";
  if (id === "mars") return "Mars · the world";
  const destination = DESTINATIONS[id];
  if (destination) return `${name} · ${destination.title}`;
  return transit ? `${transit.name} in ${transit.place}` : name;
}

export function Landing() {
  const { focus, joinHref, transits } = useSpace();
  const [casting, setCasting] = useState(false);
  const { play } = useSound();
  const moon = transits.find((transit) => transit.graha === "moon");
  const label = focus === null ? null : placeLabel(focus, transits);
  const previous = useRef<BodyId | null>(focus);

  // The sky changes without a page load, so the title and the reading order
  // have to follow it: whoever activated a planet is carried to its panel, and
  // back to the overview's headline on the way home. The first render is left
  // alone — a page load has its own reading order.
  useEffect(() => {
    document.title = label ? `${label} · The Cipher` : HOME_TITLE;
    if (previous.current === focus) return;
    previous.current = focus;
    document
      .getElementById(focus === null ? "sky-overview" : "sky-place")
      ?.focus({ preventScroll: focus === null });
  }, [focus, label]);

  const openIntake = () => {
    play("select");
    setCasting(true);
  };

  return (
    <main id="main" className="relative flex flex-1 flex-col">
      {focus === null ? (
        <Overview joinHref={joinHref} moonPlace={moon?.place} onCast={openIntake} />
      ) : (
        <Panel key={focus} label={label ?? ""}>
          {focus === "sun" ? (
            <Chart joinHref={joinHref} onCast={openIntake} />
          ) : focus === "mars" ? (
            <World />
          ) : (
            <PlaceCard id={focus} />
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
  const { transits } = useSpace();
  const listRef = useRef<HTMLDetailsElement>(null);
  const visits: BodyId[] = ["sun", "earth", "jupiter", "venus", "mars"];
  return (
    <div className="pointer-events-none flex flex-1 flex-col justify-end">
      <div className="pointer-events-auto relative px-6 pb-6 pt-16 sm:pb-8 sm:pt-24 lg:px-12 lg:pb-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/80 to-void/0 [mask-image:linear-gradient(to_bottom,transparent_0,black_120px)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_120px)] lg:bg-gradient-to-tr lg:via-void/55"
        />
        <div className="max-w-[40rem]">
          <p className="intro-fade caption" style={{ animationDelay: "0.3s" }}>
            A Human Design &amp; KP astrology community
          </p>
          <h1
            id="sky-overview"
            tabIndex={-1}
            className="mt-3 font-display text-[clamp(44px,7.4vw,92px)] leading-[0.95] tracking-[-0.01em] text-bone outline-none"
          >
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

            {/* The whole sky in words: every graha, its place today, and its
                own link. The map is a picture; this is the way in for anyone
                reading by keyboard or screen reader — and for a phone, where
                a planet is thinner than a fingertip. */}
            <details ref={listRef} className="group relative mt-3">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-display text-[15px] italic text-muted transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.6}
                  className="h-3.5 w-3.5 transition-transform duration-300 group-open:rotate-180"
                />
                Every graha in today&apos;s sky
              </summary>
              <div className="absolute bottom-full left-0 z-20 mb-3 max-h-[58svh] w-[min(34rem,calc(100vw-3rem))] overflow-y-auto rounded-lg border border-line bg-abyss p-4 shadow-lg">
                <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {BODY_IDS.map((body) => {
                    const transit = transits.find((candidate) => candidate.graha === body);
                    const name = transit?.name ?? "Earth";
                    const where = DESTINATIONS[body]?.title ?? transit?.place ?? "";
                    return (
                      <li key={body} className="border-b border-hairline/70 last:border-b-0">
                        <SpaceLink
                          to={body}
                          onNavigate={() => listRef.current?.removeAttribute("open")}
                          className="group/graha flex items-baseline justify-between gap-4 rounded-sm py-2 focus-visible:bg-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/70"
                        >
                          <span className="font-display text-[17px] text-bone transition-colors group-hover/graha:text-gold">
                            {name}
                            {transit?.retrograde && body !== "rahu" && body !== "ketu" ? (
                              <span className="ml-1.5 text-[11px] text-faint">℞</span>
                            ) : null}
                          </span>
                          <span className="text-right font-display text-[13px] italic leading-tight text-gold">{where}</span>
                        </SpaceLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
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

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none flex flex-1 flex-col">
      {/* The body's window on a phone: the space stays touchable here. */}
      <div aria-hidden="true" className="h-[36svh] shrink-0 lg:hidden" />
      <section
        id="sky-place"
        tabIndex={-1}
        aria-label={label}
        className="pointer-events-auto relative flex-1 outline-none lg:w-[min(46rem,52vw)]"
      >
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
      </section>
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

/**
 * A body that keeps a page of its own. Tapping it in the sky navigates there,
 * so this is only reached by a hash — but a shared or typed `/#earth` must
 * still land somewhere real rather than on an empty panel.
 */
function PlaceCard({ id }: { id: BodyId }) {
  const destination = DESTINATIONS[id];
  const name = id === "earth" ? "Earth" : id[0].toUpperCase() + id.slice(1);
  if (!destination) return <TransitCard id={id} />;
  return (
    <>
      <PanelHeading as="h1" caption={`${name} · a place in the sky`}>{destination.title}</PanelHeading>
      <Lede>{destination.line}</Lede>
      <Actions>
        <SpaceLink to={id} className={PILL}>
          Go to {destination.title}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        </SpaceLink>
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
