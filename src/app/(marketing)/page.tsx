"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Layers,
  MessagesSquare,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { Threshold } from "@/components/cipher/threshold";
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
      {children}
    </p>
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
      "One foundation course",
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
      "KP horary and ruling-planet timing (in development)",
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

export default function LandingPage() {
  const { play } = useSound();

  return (
    <main id="main" className="flex-1">
      {/* ── The threshold ──────────────────────────────────────────────── */}
      <Threshold destination="/enter" />

      {/* ── What it computes ───────────────────────────────────────────── */}
      <section className="relative border-t border-hairline px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Eyebrow>The reading</Eyebrow>
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
            <Eyebrow>Two words</Eyebrow>
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
            <Eyebrow>The collective</Eyebrow>
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
            <Eyebrow>Membership</Eyebrow>
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
            <Eyebrow>Questions</Eyebrow>
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

      {/* ── Final call ─────────────────────────────────────────────────── */}
      <section className="relative border-t border-hairline px-6 py-28 text-center sm:py-36">
        <Reveal>
          <div className="mx-auto flex max-w-xl flex-col items-center">
            <Cosmogram className="h-24 w-24" progress={0.4} animated={false} />
            <h2 className="mt-8 font-display text-3xl leading-tight text-bone sm:text-4xl">
              Enter your coordinates.
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              It takes a minute. It costs nothing. You will see the whole
              structure of your design before anyone asks you for anything.
            </p>
            <Link
              href="/enter"
              onMouseEnter={() => play("hover")}
              onClick={() => play("confirm")}
              className="mt-9 inline-flex items-center gap-2 rounded-md bg-gold px-7 py-3 text-sm font-semibold text-on-accent transition-all hover:brightness-110"
            >
              Compute my chart
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
