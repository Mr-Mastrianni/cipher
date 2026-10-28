"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DotGlobe, type GlobePlace } from "@/components/cipher/dot-globe";
import { cn } from "@/lib/utils";

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

/**
 * The pins on the globe.
 *
 * Six, not six hundred: the point is to answer "where am I casting from" in one
 * gesture, not to be a gazetteer. Each one writes a city the geocoder already
 * resolves, so choosing Paris or Osaka is still a matter of typing.
 *
 * `note` is only read by the list under the globe; the canvas label is the name.
 */
const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
  { id: "london", name: "London", note: "Greenwich", city: "London, England", lat: 51.51, lon: -0.13, timeZone: "Europe/London" },
  { id: "new-york", name: "New York", note: "West gate", city: "New York, USA", lat: 40.71, lon: -74.01, timeZone: "America/New_York" },
  { id: "tokyo", name: "Tokyo", note: "First light", city: "Tokyo, Japan", lat: 35.68, lon: 139.69, timeZone: "Asia/Tokyo" },
];

const GLASS =
  "w-full rounded-md border border-hairline bg-ink/60 px-3 py-2.5 text-sm text-bone placeholder:text-faint focus-visible:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30";

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

    // When the place came from a pin and the field still reads that place, hand
    // the coordinates and the zone over too. The intake then skips its geocode
    // and lands on the one screen that matters: confirming the instant.
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
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
        {/* ── The intake ─────────────────────────────────────────────── */}
        <div className="contents lg:flex lg:flex-col">
          <p className="order-1 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            KP astrology · Human Design
          </p>

          <h1 className="order-2 mt-4 max-w-xl font-display text-3xl leading-[1.06] text-bone text-balance sm:text-4xl lg:mt-5 lg:text-6xl">
            Your birth moment,{" "}
            <span className="text-gold">read to the second.</span>
          </h1>

          <p className="order-3 mt-4 max-w-xl text-sm leading-relaxed text-muted text-pretty lg:mt-5 lg:text-base">
            One confirmed instant, cast into a KP chart and a bodygraph — no
            account needed to read it.
          </p>

          <form onSubmit={submit} className="order-6 mt-6 flex max-w-xl flex-col gap-3 lg:mt-8">
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

            <div className="order-5 mt-1 flex flex-wrap items-center gap-4">
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

        {/* ── The globe ──────────────────────────────────────────────── */}
        <div className="order-4 relative mx-auto w-full max-w-[19rem] justify-self-center lg:max-w-[26rem]">
          <DotGlobe
            places={PLACES}
            activeId={chosenPlace}
            onSelect={(chosen) => {
              setPlace(chosen.city);
              setChosenPlace(chosen.id);
              setError(null);
            }}
            className="-mx-2 w-[calc(100%+1rem)]"
          />

          <div
            role="group"
            aria-label="Choose a place"
            className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5"
          >
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
                    "rounded-full border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                    active
                      ? "border-gold/60 bg-gold/5 text-gold"
                      : "border-hairline text-muted hover:border-gold/40 hover:text-bone",
                  )}
                >
                  {option.name}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
            Drag to spin · tap a pin
          </p>
        </div>
      </div>
    </section>
  );
}
