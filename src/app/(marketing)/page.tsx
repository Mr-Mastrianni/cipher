"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Layers,
  MessagesSquare,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { IntakeSection } from "@/components/cipher/hero-intake";
import { CosmicBackdrop } from "@/components/cipher/cosmic-backdrop";
import { Cosmogram } from "@/components/cipher/cosmogram";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Scroll reveal
   ------------------------------------------------------------------------- */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The section marker: a numbered badge in the programme's voice — `S.01 · The
 * world` — rather than a floating label. It is the same device the pages use
 * for their contents list, so a section reads as part of a sequence.
 */
function Eyebrow({
  children,
  index,
}: {
  children: React.ReactNode;
  index?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gold/35 px-3 py-1 font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold">
      {index ? (
        <>
          <span className="text-gold-hi">{index}</span>
          <span aria-hidden="true" className="text-gold/40">
            ·
          </span>
        </>
      ) : null}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Content
   ------------------------------------------------------------------------- */

const COMPUTES = [
  {
    icon: Layers,
    title: "The bodygraph",
    body: "Thirteen conscious and thirteen unconscious activations, resolved to gate, line, colour, tone and base. Nine centres, thirty-six channels, and the definition between them.",
  },
  {
    icon: Radio,
    title: "Type, authority, profile",
    body: "Your strategy and your inner authority resolved by precedence, not by quiz — plus profile, definition, and the incarnation cross your Sun actually sits in.",
  },
  {
    icon: Sparkles,
    title: "The KP chart",
    body: "Krishnamurti Paddhati, and only KP: the sidereal zodiac with the KP ayanamsa, Placidus cusps, and the sign, star, sub and sub-sub lord of every graha and cusp — verified to within half an arcsecond of the Swiss Ephemeris.",
  },
  {
    icon: BookOpen,
    title: "Your Aura Avatar",
    body: "Two words drawn from the shape of your twenty-six activations. A seat taken from the gate you carry, and a format taken from the line you carry most.",
  },
];

const TIERS = [
  {
    name: "Threshold",
    price: "Free",
    cadence: "",
    tagline: "The door, open.",
    features: [
      "Your full KP chart and bodygraph",
      "Your Aura Avatar",
      "The nine centres, read in full",
      "Two foundation courses: KP Foundations and Human Design",
      "The public collective feed",
    ],
    cta: "Start free",
    href: "/enter",
    featured: false,
  },
  {
    name: "Initiate",
    price: "$15",
    cadence: "/month",
    tagline: "The work, in practice.",
    features: [
      "Everything in Threshold",
      "The Experiment course track",
      "Community channels and direct messages",
      "The weekly live call",
      "Full flashcard decks with spaced repetition",
      "Reading library for all 64 gates",
    ],
    cta: "Apply for membership",
    href: "/membership",
    featured: true,
  },
  {
    name: "Adept",
    price: "$29",
    cadence: "/month",
    tagline: "For the ones who teach it.",
    features: [
      "Everything in Initiate",
      "Signal & Transmission course track",
      "KP horary (Prashna) with ruling-planet timing",
      "Priority in the live call queue",
    ],
    cta: "Apply for membership",
    href: "/membership",
    featured: false,
  },
  {
    name: "Oracle",
    price: "$59",
    cadence: "/month",
    tagline: "The room where it is built.",
    features: [
      "Everything in Adept",
      "Monthly small-group reading circle",
      "Direct line to the studio",
      "Early access to new engines and tools",
      "Your readings archive, exportable",
    ],
    cta: "Apply for membership",
    href: "/membership",
    featured: false,
  },
];

const FAQ = [
  {
    q: "Do I need to know my exact birth time?",
    a: "Yes — to the second. KP judges every house by the sub lord of its cusp, and a cusp moves about fifteen arcseconds per second of clock time, so a sub lord can change within a minute. We ask for hours, minutes and seconds, show you the resolved time zone, UTC offset and daylight saving, and cast nothing until you confirm it. Every cusp is labelled with how many seconds of error it can absorb.",
  },
  {
    q: "Where does the calculation come from?",
    a: "The KP chart uses the full VSOP87 planetary theory and the ELP/MPP02 lunar theory, with the KP (Krishnamurti) ayanamsa and Placidus cusps, tested against the Swiss Ephemeris to within half an arcsecond for the grahas and a tenth of an arcsecond for the cusps. There is no Western or tropical chart and no fallback to one. The Human Design layer solves the Design side as exactly eighty-eight degrees of solar arc, not eighty-eight days.",
  },
  {
    q: "Why is membership an application?",
    a: "Because the collective is small on purpose. Every application is read by a person. You will hear back either way, and a denial is never permanent.",
  },
  {
    q: "What happens on the weekly call?",
    a: "One hour, once a week, recorded and archived. We read charts live, take questions in the order they were asked, and work through whatever the room is stuck on. Nothing is sold from the stage.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from your own dashboard, in two clicks. No email required, no retention call.",
  },
];

/* ---------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------- */

const PORTAL = [
  { id: "P.01", title: "Cast a chart", href: "/enter", body: "One confirmed instant, nine grahas, twelve cusps — no account needed." },
  { id: "P.02", title: "Enter the world", href: "/world", body: "The valley: the Axis, the Observatory, terraces and the Sky Wheel." },
  { id: "P.03", title: "The Collective", href: "/collective", body: "Pavilions, rooms and the record kept in common." },
  { id: "P.04", title: "The method", href: "/method", body: "Why KP, why the true node, why the Design is 88° of solar arc." },
  { id: "P.05", title: "Membership", href: "/membership", body: "Four tiers, read by a person. Nothing is charged before approval." },
  { id: "P.06", title: "Sign in", href: "/sign-in", body: "Return to your chart, your courses and your seat in the room." },
] as const;

export default function LandingPage() {
  const { play } = useSound();

  return (
    <>
      <CosmicBackdrop />
      <main id="main" className="relative z-10 flex-1">
      {/* ── The threshold ──────────────────────────────────────────────── */}
      <section className="relative flex min-h-[calc(100svh-4.5rem)] flex-col justify-end px-6 pb-10 pt-24 lg:px-12 lg:pb-14">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="intro-fade font-mono text-[9px] uppercase tracking-[0.3em] text-gold" style={{ animationDelay: "0.3s" }}>
                KP astrology · Human Design
              </p>
              <h1 className="mt-5 font-sans text-[clamp(30px,6.4vw,68px)] uppercase leading-[0.94] tracking-[-0.035em] text-bone">
                {["The sky is a record.", "We cast it to the second."].map((line, index) => (
                  <span key={line} className="block overflow-hidden pb-[0.06em]">
                    <span className="intro-line block" style={{ animationDelay: `${0.45 + index * 0.12}s` }}>
                      {line}
                    </span>
                  </span>
                ))}
              </h1>
              <div className="intro-rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.9s" }}>
                <a href="#cast" className="inline-flex items-center gap-3 rounded-full bg-bone px-6 py-3.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold">
                  Cast your chart
                  <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                </a>
                <Link href="/world" className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone">
                  Enter the world ↗
                </Link>
              </div>
            </div>
            <p className="intro-fade max-w-[42ch] font-mono text-[9px] uppercase leading-[1.7] tracking-[0.12em] text-muted lg:justify-self-end" style={{ animationDelay: "1.1s" }}>
              <span className="text-bone">+</span> KP sub-lords, Placidus cusps and a bodygraph from one confirmed instant. Nine grahas, twelve cusps, twenty-six activations. No account needed to read it.
            </p>
          </div>
          <div className="intro-fade mt-8 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-hairline pt-4" style={{ animationDelay: "1.25s" }}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Link href="/method" className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone"><span className="text-gold">S.01</span> The chart ↘</Link>
              <Link href="/world" className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone"><span className="text-gold">S.02</span> The world ↘</Link>
              <Link href="/collective" className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone"><span className="text-gold">S.03</span> The Collective ↘</Link>
            </div>
            <span className="hidden font-mono text-[8.5px] uppercase tracking-[0.2em] text-faint sm:inline">Scroll to enter</span>
          </div>
        </div>
      </section>

      <IntakeSection />

      {/* ── The world ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.12fr]">
          <Reveal>
            <Eyebrow index="S.01">The world</Eyebrow>
            <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight text-bone sm:text-4xl">
              The Cipher is also a place.
            </h2>
            <p className="mt-5 max-w-xl text-pretty leading-relaxed text-muted">
              Not a dashboard with a 3D background. A valley at dusk you can walk,
              run and fly through — with the chart you already cast hanging in the
              Observatory, the people you already know in the Commons, and a
              terrace that is yours to build in.
            </p>
            <ul className="mt-7 grid gap-3 text-sm leading-relaxed text-muted">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1 w-4 shrink-0 bg-gold" />
                Walk, run and fly: four air jumps, then the Sky Wheel at 1,800 metres.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1 w-4 shrink-0 bg-gold" />
                Make an avatar, claim a terrace, and build inside it with anyone in the room.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1 w-4 shrink-0 bg-gold" />
                Take the floor in the Amphitheatre: teach one thing, learn three.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1 w-4 shrink-0 bg-gold" />
                Every Collective room has a pavilion; live sessions are visible across the world.
              </li>
            </ul>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/world"
                onMouseEnter={() => play("hover")}
                onClick={() => play("select")}
                className="inline-flex items-center gap-2 border border-gold bg-gold px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-on-accent transition-colors hover:bg-gold-hi"
              >
                Enter the world
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
              <Link
                href="/dashboard/map"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted transition-colors hover:text-bone"
              >
                Or the flat cosmic map
              </Link>
            </div>
            <p className="mt-6 max-w-xl text-xs leading-relaxed text-faint">
              The 2D site is not replaced. Every chart, course, room and invoice
              stays exactly where it was, one click away in the world&apos;s HUD.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <figure className="relative overflow-hidden rounded-xl border border-hairline bg-abyss">
              <Image
                src="/world-preview.jpg"
                style={{ filter: "saturate(0.62) sepia(0.12) contrast(1.04)" }}
                alt="Inside the Observatory: a glowing astrolabe of the zodiac above a still basin, with the member's KP chart and Human Design bodygraph on two screens."
                width={1600}
                height={900}
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="h-auto w-full object-cover"
                priority={false}
              />
              <figcaption className="flex items-center justify-between gap-4 border-t border-hairline px-4 py-3 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
                <span>The Observatory · your chart above the floor</span>
                <span className="text-gold">A world you can walk</span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ── What it computes ───────────────────────────────────────────── */}
      <section className="relative border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Eyebrow index="S.02">The reading</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-bone sm:text-4xl">
              Your chart is not a personality. It is a set of instructions.
            </h2>
            <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-muted">
              Most readings stop at description. The Cipher computes the whole
              structure mechanically, from your birth moment, and then tells you
              what to do with it.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
            {COMPUTES.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.07}>
                <div className="group h-full bg-void p-7 transition-colors hover:bg-ink">
                  <item.icon
                    className="h-5 w-5 text-gold transition-transform duration-500 group-hover:scale-110"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <h3 className="mt-5 font-display text-lg tracking-wide text-bone">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Aura Avatar ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-5xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <Eyebrow index="S.03">Two words</Eyebrow>
            <h2 className="mt-4 font-display text-3xl leading-tight text-bone sm:text-4xl">
              Your Aura Avatar
            </h2>
            <p className="mt-5 text-pretty leading-relaxed text-muted">
              Twenty-six activations. One of them is a seat — a gate you carry
              that names what you are for. Another is a format — the line you
              carry most, which names how you say it. Put them together and you
              get two words that are yours and nobody else&apos;s.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                ["The Copywriter", "Investigator"],
                ["The Quiet", "Influencer"],
                ["The Witchy", "Tester"],
              ].map(([seat, format], index) => (
                <div
                  key={seat}
                  className={cn(
                    "rounded-lg border border-hairline bg-ink px-4 py-3",
                    index === 0 && "border-gold/40",
                  )}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                    {seat}
                  </p>
                  <p className="font-display text-base tracking-wide text-bone">
                    {format}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border border-dashed border-line px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                  yours
                </p>
                <p className="font-display text-base tracking-wide text-gold">
                  ???
                </p>
              </div>
            </div>
            <Link
              href="/enter"
              onMouseEnter={() => play("hover")}
              onClick={() => play("select")}
              className="mt-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-gold transition-colors hover:text-gold-hi"
            >
              Compute mine
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="relative mx-auto aspect-square w-full max-w-sm">
              <Cosmogram className="h-full w-full" progress={0.7} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── The collective ─────────────────────────────────────────────── */}
      <section className="relative border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Eyebrow index="S.04">The collective</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-bone sm:text-4xl">
              You cannot run an experiment alone in a room.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: MessagesSquare,
                title: "Channels and DMs",
                body: "Rooms organised by type, by centre, and by whatever you are actually working on. Direct messages when a conversation needs to leave the room.",
              },
              {
                icon: CalendarClock,
                title: "The weekly call",
                body: "One hour, every week, recorded and archived. Charts read live, questions taken in the order they arrive.",
              },
              {
                icon: Users,
                title: "Reading circles",
                body: "Small groups that meet monthly to read each other properly. The fastest way to learn a system is to use it on someone else.",
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 0.08}>
                <div className="rounded-xl border border-hairline bg-ink/60 p-7">
                  <item.icon
                    className="h-5 w-5 text-teal"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <h3 className="mt-5 font-display text-lg tracking-wide text-bone">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Membership ─────────────────────────────────────────────────── */}
      <section
        id="membership"
        className="relative border-t border-hairline px-6 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow index="S.05">Membership</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-bone sm:text-4xl">
              Four tiers. The first one is free forever.
            </h2>
            <p className="mt-5 max-w-2xl leading-relaxed text-muted">
              Membership is reviewed by a person, usually within two days. You
              choose a tier when you apply, and nothing is charged until you are
              accepted.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 lg:grid-cols-4">
            {TIERS.map((tier, index) => (
              <Reveal key={tier.name} delay={index * 0.06}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-xl border bg-ink/60 p-6 transition-all duration-300",
                    tier.featured
                      ? "border-gold/50 shadow-glow"
                      : "border-hairline hover:border-line",
                  )}
                >
                  {tier.featured && (
                    <span className="mb-4 inline-flex w-fit rounded-full bg-gold/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-gold">
                      most chosen
                    </span>
                  )}
                  <h3 className="font-display text-lg tracking-wide text-bone">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-xs text-faint">{tier.tagline}</p>
                  <p className="mt-5 font-display text-3xl text-bone">
                    {tier.price}
                    <span className="text-sm text-faint">{tier.cadence}</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-2.5 text-[13px] leading-relaxed text-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={tier.href}
                    onMouseEnter={() => play("hover")}
                    onClick={() => play("select")}
                    className={cn(
                      "mt-7 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-all",
                      tier.featured
                        ? "bg-gold text-on-accent hover:brightness-110"
                        : "border border-line text-bone hover:border-gold hover:text-gold",
                    )}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <Eyebrow index="S.06">Questions</Eyebrow>
            <h2 className="mt-4 font-display text-3xl leading-tight text-bone sm:text-4xl">
              The things people ask first.
            </h2>
          </Reveal>
          <div className="mt-12 divide-y divide-hairline border-y border-hairline">
            {FAQ.map((item, index) => (
              <Reveal key={item.q} delay={index * 0.05}>
                <details className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left">
                    <span className="font-display text-base tracking-wide text-bone">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-faint transition-all group-open:rotate-45 group-open:border-gold group-open:text-gold"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The portal ─────────────────────────────────────────────────── */}
      <section className="relative border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="flex flex-col items-start gap-6">
              <Eyebrow index="S.07">The portal</Eyebrow>
              <h2 className="max-w-2xl font-display text-4xl leading-[1.02] text-bone sm:text-5xl">
                Everything is one door away.
              </h2>
              <p className="max-w-xl leading-relaxed text-muted">
                The chart, the valley, the Collective, the membership. Choose
                where you enter — nothing here is a dead end.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {PORTAL.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => play("hover")}
                onClick={() => play("select")}
                className="group flex flex-col gap-3 bg-void/70 p-7 backdrop-blur-sm transition-colors hover:bg-raised/70"
              >
                <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold">{item.id}</span>
                <span className="flex items-center justify-between gap-4 font-display text-2xl text-bone">
                  {item.title}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-gold" strokeWidth={1.5} />
                </span>
                <span className="text-sm leading-relaxed text-muted">{item.body}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      </main>
    </>
  );
}
