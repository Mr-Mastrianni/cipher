"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLenis } from "lenis/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { IntakeForm } from "@/components/cipher/hero-intake";
import { CosmicBackdrop } from "@/components/cipher/cosmic-backdrop";
import type { Transit } from "@/components/cipher/sky/planets";
import { ThreeReadings } from "@/components/cipher/three-readings";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { Reveal, RiseText } from "@/components/motion/reveal";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { useSound } from "@/components/providers/sound-provider";
import { Sheet } from "@/components/ui/sheet";

/* ---------------------------------------------------------------------------
   Pieces
   ------------------------------------------------------------------------- */

/**
 * The section marker: a numbered badge in the programme's voice — `S.02 · The
 * world` — so a section reads as part of a sequence.
 */
function Eyebrow({ children, index }: { children: React.ReactNode; index: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gold/35 px-3 py-1 font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold">
      <span className="text-gold-hi">{index}</span>
      <span aria-hidden="true" className="text-gold/40">
        ·
      </span>
      {children}
    </span>
  );
}

/**
 * The world's preview opens like an aperture as it scrolls through: a clip
 * that widens and an image that settles, tied to the scroll rather than played
 * once.
 */
function Aperture({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        const frame = ref.current;
        if (!frame) return;
        gsap.fromTo(
          frame,
          { clipPath: "inset(14% 10% 14% 10% round 12px)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 12px)",
            ease: "none",
            scrollTrigger: { trigger: frame, start: "top 95%", end: "center 55%", scrub: 0.6 },
          },
        );
        gsap.fromTo(
          frame.querySelector("img"),
          { scale: 1.18 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: 0.6 },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-hairline bg-abyss">
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Content
   ------------------------------------------------------------------------- */

const COLLECTIVE = [
  { id: "C.01", title: "Rooms for every question", body: "Channels by type, by centre, by whatever you're working through." },
  { id: "C.02", title: "The weekly call", body: "One hour, live. Bring your chart and ask anything." },
  { id: "C.03", title: "Reading circles", body: "Small groups that meet monthly to read each other." },
] as const;

function portal(joinHref: string) {
  return [
    { id: "P.01", title: "Join the community", href: joinHref },
    { id: "P.02", title: "Become a member", href: "/membership/apply" },
    { id: "P.03", title: "Cast your chart", href: "/enter" },
    { id: "P.04", title: "Enter the world", href: "/world" },
    { id: "P.05", title: "Learn the method", href: "/method" },
  ];
}

const SECTION = "relative px-6 py-24 sm:py-36 lg:px-12";

/* ---------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------- */

export function Landing({
  transits,
  joinHref,
}: {
  transits: readonly Transit[];
  joinHref: string;
}) {
  const { play } = useSound();
  const [casting, setCasting] = useState(false);
  const moon = transits.find((transit) => transit.graha === "moon");

  // The smooth scroller would keep turning the page under an open sheet.
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (casting) lenis.stop();
    else lenis.start();
  }, [casting, lenis]);

  return (
    <>
      <SmoothScroll />
      <CosmicBackdrop transits={transits} />
      <main id="main" className="relative z-10 flex-1">
        {/* ── The threshold ────────────────────────────────────────────── */}
        <section className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-end px-6 pb-8 pt-24 lg:px-12 lg:pb-12">
          <div className="mx-auto w-full max-w-[1400px]">
            <p className="intro-fade font-mono text-[9px] uppercase tracking-[0.3em] text-gold" style={{ animationDelay: "0.3s" }}>
              A KP &amp; Human Design community
            </p>
            <h1 className="mt-5 font-sans text-[clamp(32px,7vw,76px)] uppercase leading-[0.94] tracking-[-0.035em] text-bone">
              {["Read the sky", "together."].map((line, index) => (
                <span key={line} className="block overflow-hidden pb-[0.06em]">
                  <span className="intro-line block" style={{ animationDelay: `${0.45 + index * 0.12}s` }}>
                    {line}
                  </span>
                </span>
              ))}
            </h1>
            <p className="intro-rise mt-6 max-w-[38ch] text-pretty text-[15px] leading-relaxed text-muted" style={{ animationDelay: "0.8s" }}>
              Cast your chart, learn to read it, and meet the people reading theirs beside you.
            </p>
            <div className="intro-rise mt-7 flex flex-wrap items-center gap-x-6 gap-y-4" style={{ animationDelay: "0.95s" }}>
              <Link
                href={joinHref}
                onMouseEnter={() => play("hover")}
                onClick={() => play("select")}
                className="inline-flex items-center gap-3 rounded-full bg-bone px-6 py-3.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                Join the community
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  play("select");
                  setCasting(true);
                }}
                className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Cast your chart free ↗
              </button>
            </div>
            <div className="intro-fade mt-10 flex items-center justify-between gap-6 border-t border-hairline pt-4 font-mono text-[8.5px] uppercase tracking-[0.2em] text-faint" style={{ animationDelay: "1.2s" }}>
              <span className="whitespace-nowrap">
                <span className={moon ? "hidden sm:inline" : undefined}>Free to join</span>
                {moon ? (
                  <>
                    <span aria-hidden="true" className="hidden px-2 text-gold/40 sm:inline">·</span>
                    Tonight&apos;s Moon <span className="text-gold">{moon.place}</span>
                  </>
                ) : null}
              </span>
              <span className="inline-flex items-center gap-2">
                Scroll
                <ArrowDown aria-hidden="true" className="h-3 w-3 animate-bounce" strokeWidth={1.6} />
              </span>
            </div>
          </div>
        </section>

        {/* ── One instant, three readings (pinned) ─────────────────────── */}
        <ThreeReadings />

        {/* ── The world ───────────────────────────────────────────────── */}
        <section className={SECTION}>
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <Reveal>
                <Eyebrow index="S.02">The world</Eyebrow>
              </Reveal>
              <RiseText className="mt-5 max-w-[14ch] font-display text-[clamp(32px,5.4vw,56px)] leading-[1.02] text-bone">
                A place to meet each other.
              </RiseText>
              <Reveal delay={0.15}>
                <p className="mt-5 max-w-[34ch] text-pretty text-[15px] leading-relaxed text-muted">
                  Walk, run and fly through a valley at dusk. Your chart hangs in the Observatory; your people gather in the Commons.
                </p>
                <Link
                  href="/world"
                  onMouseEnter={() => play("hover")}
                  onClick={() => play("select")}
                  className="mt-8 inline-flex items-center gap-2 border border-gold bg-gold px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-on-accent transition-colors hover:bg-gold-hi"
                >
                  Enter the world
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                </Link>
              </Reveal>
            </div>
            <Aperture>
              <Image
                src="/world-preview.jpg"
                style={{ filter: "saturate(0.62) sepia(0.12) contrast(1.04)" }}
                alt="Inside the Observatory: a glowing astrolabe of the zodiac above a still basin, with the member's KP chart and Human Design bodygraph on two screens."
                width={1600}
                height={900}
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="h-auto w-full object-cover"
              />
            </Aperture>
          </div>
        </section>

        {/* ── The collective ──────────────────────────────────────────── */}
        <section className={SECTION}>
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <Eyebrow index="S.03">The collective</Eyebrow>
            </Reveal>
            <RiseText className="mt-5 max-w-[18ch] font-display text-[clamp(32px,5.4vw,56px)] leading-[1.02] text-bone">
              No one reads their chart alone here.
            </RiseText>
            <Reveal stagger={0.12} className="mt-12 grid gap-px sm:grid-cols-3 sm:gap-8">
              {COLLECTIVE.map((item) => (
                <div key={item.id} className="border-t border-hairline py-5 sm:py-6">
                  <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gold">{item.id}</p>
                  <h3 className="mt-3 font-display text-2xl text-bone">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{item.body}</p>
                </div>
              ))}
            </Reveal>
            <Reveal delay={0.1}>
              <Link
                href={joinHref}
                onMouseEnter={() => play("hover")}
                onClick={() => play("select")}
                className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold transition-colors hover:text-gold-hi"
              >
                Join the community
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── Membership ──────────────────────────────────────────────── */}
        <section id="membership" className={SECTION}>
          <div className="mx-auto flex max-w-6xl flex-col items-start">
            <Reveal>
              <Eyebrow index="S.04">Membership</Eyebrow>
            </Reveal>
            <RiseText className="mt-5 max-w-[14ch] font-display text-[clamp(36px,6.4vw,72px)] leading-[1] text-bone">
              Come in. There&apos;s a seat for you.
            </RiseText>
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[40ch] text-pretty text-[15px] leading-relaxed text-muted">
                Joining is free. Become a member from $15 a month for the weekly call, the courses and the reading circles. Every application is read by a person, and nothing is charged until you&apos;re welcomed in.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  href="/membership/apply"
                  onMouseEnter={() => play("hover")}
                  onClick={() => play("select")}
                  className="inline-flex items-center gap-2 rounded-full bg-bone px-6 py-3.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold"
                >
                  Become a member
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                </Link>
                <Link href={joinHref} className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-bone">
                  Join free ↗
                </Link>
                <Link href="/membership" className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-bone">
                  Compare the tiers
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── The portal ──────────────────────────────────────────────── */}
        <section className={SECTION}>
          <div className="mx-auto max-w-6xl">
            <RiseText className="max-w-[16ch] font-display text-[clamp(32px,5.4vw,56px)] leading-[1.02] text-bone">
              Wherever you start, we&apos;ll meet you there.
            </RiseText>
            <Reveal stagger={0.08} className="mt-10 border-b border-hairline">
              {portal(joinHref).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => play("hover")}
                  onClick={() => play("select")}
                  className="group flex items-center gap-5 border-t border-hairline py-5 transition-colors hover:text-gold sm:py-6"
                >
                  <span className="w-10 font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold">{item.id}</span>
                  <span className="flex-1 font-display text-2xl text-bone transition-colors group-hover:text-gold sm:text-3xl">
                    {item.title}
                  </span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-gold" strokeWidth={1.5} />
                </Link>
              ))}
            </Reveal>
          </div>
        </section>
      </main>

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
    </>
  );
}
