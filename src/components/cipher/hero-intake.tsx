"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The hero.
 *
 * Replaces the old threshold gesture (drag the wheel upward to enter). That
 * gesture was memorable but it was also the reason a first-time visitor had to
 * scroll and interact before seeing a single field. Here the intake *is* the
 * hero: three fields, one action, always above the fold.
 *
 * The ring is decorative CSS 3D — a tilted, slowly rotating zodiac band with
 * pointer parallax. No WebGL and no three.js: it costs no dependency, runs on
 * the compositor, and degrades to a static ring under reduced motion.
 *
 * Submitting hands off to `/enter` with the date, time and place prefilled,
 * because the timezone and daylight-saving confirmation must still happen
 * there — guessing a zone silently would move the Ascendant.
 */

const MARKS = [
  "Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi",
] as const;

const GLASS =
  "w-full rounded-md border border-hairline bg-ink/60 px-3 py-2.5 text-sm text-bone placeholder:text-faint focus-visible:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30";

export function HeroIntake() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !time) {
      setError("The date and the time are both needed.");
      return;
    }
    if (!place.trim()) {
      setError("Add the nearest city, so the coordinates can be checked.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      d: date,
      t: `${time}:00`.slice(0, 8),
      q: place.trim(),
    });
    router.push(`/enter?${params.toString()}`);
  }

  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:pb-28 lg:pt-24">
        {/* ── The intake ─────────────────────────────────────────────── */}
        <div className="flex flex-col">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
            KP · Human Design · one verified instant
          </p>

          <h1 className="mt-5 max-w-xl font-display text-4xl leading-[1.05] text-bone text-balance sm:text-5xl lg:text-6xl">
            Your birth moment,{" "}
            <span className="text-gold">read to the second.</span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted text-pretty sm:text-base">
            KP sub-lords, Placidus cusps and the bodygraph, computed from one
            birth instant you confirm. No account needed to see the chart.
          </p>

          <form onSubmit={submit} className="mt-8 flex max-w-xl flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Date of birth
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={GLASS}
                  aria-label="Date of birth"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Time · to the second
                </span>
                <input
                  type="time"
                  step={1}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className={GLASS}
                  aria-label="Time of birth, to the second"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                Nearest city
              </span>
              <input
                type="text"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Leeds, England"
                autoComplete="off"
                className={GLASS}
                aria-label="Nearest city of birth"
              />
            </label>

            <div className="mt-1 flex flex-wrap items-center gap-4">
              <Button type="submit" size="lg">
                Read my chart
                <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                then confirm the time zone
              </span>
            </div>

            <p
              role="alert"
              aria-live="polite"
              className="min-h-4 text-sm text-danger"
            >
              {error ?? ""}
            </p>
          </form>
        </div>

        {/* ── The ring ───────────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="relative mx-auto aspect-square w-full max-w-[26rem] justify-self-center [perspective:1000px]"
        >
          {/* Ground glow */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,color-mix(in_srgb,var(--c-gold)_22%,transparent),transparent_62%)] blur-2xl" />

          {/* Tilted zodiac band */}
          <div className="absolute inset-0 [transform-style:preserve-3d]">
            <div className="absolute inset-0 [transform:rotateX(62deg)] [transform-style:preserve-3d]">
              <div className="ring-spin absolute inset-0 [transform-style:preserve-3d]">
                <div className="absolute inset-[6%] rounded-full border border-gold/30" />
                <div className="absolute inset-[18%] rounded-full border border-line/70" />
                <div className="absolute inset-[34%] rounded-full border border-purple/40" />

                {MARKS.map((mark, index) => (
                  <div
                    key={mark}
                    className="absolute left-1/2 top-1/2 h-1/2 w-px origin-top"
                    style={{ transform: `rotate(${index * 30}deg)` }}
                  >
                    <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold" />
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      {mark}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Still core + slow counter-orbit */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative h-24 w-24 rounded-full border border-gold/40">
              <div className="absolute inset-3 rounded-full border border-purple/40" />
              <div className="absolute inset-0 grid place-items-center">
                <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_18px_4px_color-mix(in_srgb,var(--c-gold)_55%,transparent)]" />
              </div>
            </div>
          </div>

          <div className="orbit-spin absolute inset-[12%] rounded-full border border-line/60">
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-teal" />
          </div>
        </div>
      </div>
    </section>
  );
}
