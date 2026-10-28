"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DotGlobe, type GlobePlace } from "@/components/cipher/dot-globe";
import { Starfield } from "@/components/cipher/starfield";
import { cn } from "@/lib/utils";

/**
 * The hero.
 *
 * A page rather than a form: one statement, one line of proof, the intake in a
 * hairline band, and the planet's limb along the bottom — drawn from the same
 * land data as the Atlas, in brass instead of ice. The form is still the
 * action; it has simply stopped being the whole composition.
 *
 * Submitting hands off to `/enter` with date, time and place, because the time
 * zone and any daylight-saving fold must still be confirmed there. A place
 * chosen from the list hands over its coordinates and zone too, so the intake
 * can skip its geocode.
 */

const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
  { id: "london", name: "London", note: "Greenwich", city: "London, England", lat: 51.51, lon: -0.13, timeZone: "Europe/London" },
  { id: "new-york", name: "New York", note: "West gate", city: "New York, USA", lat: 40.71, lon: -74.01, timeZone: "America/New_York" },
  { id: "tokyo", name: "Tokyo", note: "First light", city: "Tokyo, Japan", lat: 35.68, lon: 139.69, timeZone: "Asia/Tokyo" },
];

const FIELD =
  "field w-full bg-transparent pb-2 pt-1 text-base text-bone placeholder:text-faint focus-visible:outline-none";

const LABEL = "font-mono text-[9px] uppercase tracking-[0.22em] text-faint";

const INDEX = [
  {
    id: "S.01",
    title: "The chart",
    body: "Nine grahas, twelve cusps, sub-lords to the arcsecond.",
    href: "/method",
  },
  {
    id: "S.02",
    title: "The world",
    body: "A valley you walk, with your chart hanging in the Observatory.",
    href: "/world",
  },
  {
    id: "S.03",
    title: "The Collective",
    body: "The record kept in common, read in pavilions and rooms.",
    href: "/collective",
  },
] as const;

export function HeroIntake() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [chosenPlace, setChosenPlace] = useState<string | null>(null);
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

    // When the place came from the list and the field still reads that place,
    // hand the coordinates and the zone over too. The intake then skips its
    // geocode and lands on the one screen that matters: confirming the instant.
    const pinned = PLACES.find((candidate) => candidate.id === chosenPlace);
    if (pinned && place.trim() === pinned.city) {
      params.set("lat", String(pinned.lat));
      params.set("lon", String(pinned.lon));
      params.set("tz", pinned.timeZone);
      params.set("n", pinned.city);
    }

    router.push(`/enter?${params.toString()}`);
  }

  return (
    <section className="relative isolate flex min-h-[92vh] flex-col overflow-hidden border-b border-hairline">
      {/* ── Sky ─────────────────────────────────────────────────────── */}
      <Starfield />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[58%] aspect-square w-[210vw] max-w-[2600px] -translate-x-1/2 lg:top-[54%] lg:w-[150vw]"
      >
        <DotGlobe
          places={PLACES}
          variant="horizon"
          onSelect={() => {}}
          initialLon={18}
          initialLat={14}
          className="h-full w-full cursor-grab active:cursor-grabbing"
        />
      </div>
      {/* The ground rises to meet the limb, so type never sits on a lit edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-void via-void/85 to-transparent"
      />

      {/* ── Page ────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pb-8 pt-14 sm:pt-20 lg:px-12">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-gold">
          KP astrology · Human Design
        </p>

        <h1 className="mt-6 max-w-[14ch] font-display text-[13vw] leading-[0.94] tracking-[-0.02em] text-bone sm:text-6xl lg:mt-7 lg:text-[76px]">
          Where you stand changes <em className="italic text-gold">the sky.</em>
        </h1>

        <p className="mt-6 max-w-[38ch] text-sm leading-relaxed text-muted text-pretty sm:text-[15px]">
          One confirmed instant — to the second — cast into a KP chart and a
          bodygraph. No account needed to read it.
        </p>

        <form
          onSubmit={submit}
          className="mt-10 border-t border-hairline pt-6 lg:max-w-4xl"
        >
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-end">
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Date of birth</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={FIELD}
                aria-label="Date of birth"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Time · to the second</span>
              <input
                type="time"
                step={1}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className={FIELD}
                aria-label="Time of birth, to the second"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Nearest city</span>
              <input
                type="text"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Leeds, England"
                autoComplete="off"
                className={FIELD}
                aria-label="Nearest city of birth"
              />
            </label>

            <Button type="submit" className="lg:mb-0.5">
              Read my chart
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className={cn(LABEL, "mr-1")}>Places</span>
            {PLACES.map((option) => {
              const active = option.id === chosenPlace;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  title={option.note}
                  onClick={() => {
                    setPlace(option.city);
                    setChosenPlace(option.id);
                    setError(null);
                  }}
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-[0.18em] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                    active ? "text-gold" : "text-muted hover:text-bone",
                  )}
                >
                  {option.name}
                </button>
              );
            })}
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint sm:ml-auto">
              then confirm the time zone
            </span>
          </div>

          <p
            role="alert"
            aria-live="polite"
            className="mt-2 min-h-4 text-sm text-danger"
          >
            {error ?? ""}
          </p>
        </form>

        {/* ── Contents ───────────────────────────────────────────────── */}
        <div className="mt-auto pt-16">
          <div className="grid border-t border-hairline sm:grid-cols-3">
            {INDEX.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group border-b border-hairline py-5 pr-6 transition-colors hover:bg-raised/30 sm:border-b-0 sm:border-r sm:pl-6 sm:first:pl-0 sm:last:border-r-0"
              >
                <span className="block font-mono text-[8.5px] uppercase tracking-[0.22em] text-gold">
                  {item.id}
                </span>
                <span className="mt-2 block font-display text-xl text-bone">
                  {item.title}
                </span>
                <span className="mt-1 block max-w-[30ch] text-xs leading-relaxed text-muted">
                  {item.body}
                </span>
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline py-4">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-faint">
              Drag the planet
            </span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-faint">
              23.18° N &nbsp; 75.78° E
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
