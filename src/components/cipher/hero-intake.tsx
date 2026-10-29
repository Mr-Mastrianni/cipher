"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GlobePlace } from "@/components/cipher/dot-globe";
import { cn } from "@/lib/utils";

/**
 * The landing's intake: date, time and place, in the page's hairline language.
 *
 * It lives in a sheet the hero's "Cast your chart" opens, so the landing itself
 * stays short. Submitting carries date, time and place to `/enter`, because
 * the zone and any daylight-saving fold must still be confirmed there. A place
 * chosen from the list carries its coordinates and zone too, so the intake can
 * skip its geocode.
 */

const PLACES: readonly GlobePlace[] = [
  { id: "ujjain", name: "Ujjain", note: "The KP meridian", city: "Ujjain, India", lat: 23.18, lon: 75.78, timeZone: "Asia/Kolkata" },
  { id: "london", name: "London", note: "Greenwich", city: "London, England", lat: 51.51, lon: -0.13, timeZone: "Europe/London" },
  { id: "new-york", name: "New York", note: "West gate", city: "New York, USA", lat: 40.71, lon: -74.01, timeZone: "America/New_York" },
  { id: "tokyo", name: "Tokyo", note: "First light", city: "Tokyo, Japan", lat: 35.68, lon: 139.69, timeZone: "Asia/Tokyo" },
];

const FIELD =
  "field w-full bg-transparent pb-2 pt-1 text-base text-bone placeholder:text-faint focus-visible:outline-none";

const LABEL = "font-display text-[15px] italic text-muted";

const RAIL = "font-display text-[14px] italic text-faint";

export function IntakeForm() {
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
    // hand the coordinates and the zone over too.
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
    <form onSubmit={submit} className="flex flex-col gap-7">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
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
      </div>

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

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
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
                "font-display text-[16px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                active ? "text-gold" : "text-muted hover:text-bone",
              )}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-5 pt-1">
        <Button type="submit" size="lg">
          Read my chart
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <span className={RAIL}>Then confirm the time zone</span>
      </div>

      <p role="alert" aria-live="polite" className="min-h-4 text-sm text-danger">
        {error ?? ""}
      </p>
    </form>
  );
}
