"use client";

/**
 * `/enter` — the intake.
 *
 * Three movements rather than three form fields: the date, the hour, the
 * place. The ritual framing is not decoration — it sets the expectation that
 * the answers matter, which is exactly when people go and find the birth
 * certificate instead of guessing.
 *
 * Two design commitments drive the implementation:
 *
 * 1. **Honesty about a missing birth time.** Skipping the hour is allowed and
 *    never cosmetically "fixed": the time is marked unknown, computed at noon
 *    local, and the screen states plainly which parts of the reading survive.
 * 2. **Never guess a timezone.** A place with no resolved IANA zone is a
 *    first-class state that asks the person to choose, because a silent default
 *    relocates the Ascendant and can move the whole bodygraph.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  MapPin,
  Search,
  TriangleAlert,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui";
import { Cosmogram } from "@/components/cipher/cosmogram";
import { SiteHeader } from "@/components/chrome/site-header";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";
import type { BirthInput } from "@/lib/astrology/types";

/* ---------------------------------------------------------------------------
   Constants and small helpers
   ------------------------------------------------------------------------- */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const STEPS = [
  {
    id: "date",
    label: "The date",
    title: "When did you arrive?",
    blurb: "The date sets the slow bodies — the outer planets and the nodes.",
  },
  {
    id: "time",
    label: "The hour",
    title: "At what hour?",
    blurb:
      "The hour sets the Moon, the Ascendant, and everything built on them.",
  },
  {
    id: "place",
    label: "The place",
    title: "Where on the planet?",
    blurb: "Coordinates and an IANA timezone fix the chart to a single instant.",
  },
] as const;

const LOADING_LINES = [
  "Resolving your birth instant…",
  "Placing the Sun, Moon and angles…",
  "Casting the Design chart at 88° of solar arc…",
  "Tracing the 36 channels and 9 centres…",
  "Drawing your Aura Avatar…",
];

const CURRENT_YEAR = new Date().getFullYear();

/** One place suggestion, mirroring the geocode API's result shape. */
interface PlaceResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  timeZone: string | null;
  country: string | null;
  admin1: string | null;
}

interface ChartApiResponse {
  ok?: boolean;
  code?: string;
  error?: string;
}

type FieldName = "date" | "time" | "place" | "manual";
type Errors = Partial<Record<FieldName, string>>;

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/[^0-9]/g, "").slice(0, maxLength);
}

function isRealCalendarDate(value: {
  year: number;
  month: number;
  day: number;
}): boolean {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  return (
    date.getUTCFullYear() === value.year &&
    date.getUTCMonth() === value.month - 1 &&
    date.getUTCDate() === value.day
  );
}

/** Validate an IANA zone by asking the platform to format with it. */
function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const datePartsSchema = z
  .object({
    year: z
      .number()
      .int()
      .min(1900, "We can only compute charts from 1900 onwards.")
      .max(CURRENT_YEAR, "That year is still ahead of us."),
    month: z.number().int().min(1, "Choose a month."),
    day: z.number().int().min(1, "Enter a day."),
  })
  .refine(isRealCalendarDate, { message: "That date does not exist." });

const timePartsSchema = z.object({
  hour: z.number().int().min(0, "Hours run from 0 to 23.").max(23, "Hours run from 0 to 23."),
  minute: z.number().int().min(0, "Minutes run from 0 to 59.").max(59, "Minutes run from 0 to 59."),
});

const manualSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude runs from -90 to 90.")
    .max(90, "Latitude runs from -90 to 90."),
  longitude: z
    .number()
    .min(-180, "Longitude runs from -180 to 180.")
    .max(180, "Longitude runs from -180 to 180."),
  timeZone: z.string().min(1, "Enter the IANA timezone, e.g. Europe/London."),
});

/* ---------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------- */

/**
 * The three-step birth-data intake.
 *
 * Everything is validated with the same `zod` schemas the API route enforces, so
 * a value that passes here is a value the server will accept. Keyboard users can
 * complete the whole flow: Enter advances, the place search is a proper
 * combobox with arrow-key selection, and every error is announced.
 */
export default function EnterPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { play } = useSound();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);

  // Step 1 — the date.
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  // Step 2 — the hour.
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);

  // Step 3 — the place.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchState, setSearchState] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualZone, setManualZone] = useState("");
  const [zones, setZones] = useState<string[]>([]);

  const [lastCode, setLastCode] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  /* Focus should follow a step change, but not steal focus on first paint. */
  const mountedRef = useRef(false);

  /* The IANA zone list is only used to power the manual datalist, so it is read
     after mount — `Intl.supportedValuesOf` is not present in every runtime. */
  useEffect(() => {
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        setZones([...Intl.supportedValuesOf("timeZone")]);
      }
    } catch {
      setZones([]);
    }
  }, []);

  /* A returning visitor should not have to re-enter their birth data. */
  useEffect(() => {
    try {
      setLastCode(window.localStorage.getItem("cipher:last-chart"));
    } catch {
      setLastCode(null);
    }
  }, []);

  /* Debounce the type-ahead so a fast typist makes one request, not ten. */
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      320,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setSearchState("idle");
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setSearchState("loading");
    void (async () => {
      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          results?: PlaceResult[];
          error?: string;
        };
        if (!response.ok) {
          setResults([]);
          setSearchState("error");
          setSearchError(
            data.error ??
              "The place lookup is unavailable. Enter your coordinates by hand below.",
          );
          return;
        }
        const found = data.results ?? [];
        setResults(found);
        setActiveIndex(found.length > 0 ? 0 : -1);
        setSearchState(found.length > 0 ? "ready" : "empty");
        setSearchError(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setSearchState("error");
        setSearchError(
          "We could not reach the place lookup. Enter your coordinates by hand below.",
        );
      }
    })();
    return () => controller.abort();
  }, [debouncedQuery]);

  /* The loading screen narrates the pipeline rather than spinning mutely. */
  useEffect(() => {
    if (!submitting || reduced) return;
    const timer = window.setInterval(
      () => setLoadingIndex((index) => (index + 1) % LOADING_LINES.length),
      1400,
    );
    return () => window.clearInterval(timer);
  }, [submitting, reduced]);

  /* Move focus to the new step heading so a keyboard user is not stranded. */
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const isoValue = useMemo(() => {
    if (!year || !month || !day) return "";
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }, [year, month, day]);

  function validateDate(): Errors {
    if (!year || !month || !day) {
      return { date: "Enter your full date of birth — day, month and year." };
    }
    const parsed = datePartsSchema.safeParse({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    });
    if (!parsed.success) {
      return { date: parsed.error.issues[0]?.message ?? "That date is not valid." };
    }
    return {};
  }

  function validateTime(): Errors {
    if (timeUnknown) return {};
    if (hour === "" || minute === "") {
      return {
        time: "Enter the hour and minute, or mark the time as unknown below.",
      };
    }
    const parsed = timePartsSchema.safeParse({
      hour: Number(hour),
      minute: Number(minute),
    });
    if (!parsed.success) {
      return { time: parsed.error.issues[0]?.message ?? "That time is not valid." };
    }
    return {};
  }

  function validatePlace(): Errors {
    if (!place) {
      return {
        place: "Choose a birthplace from the search, or enter coordinates by hand.",
      };
    }
    if (!place.timeZone) {
      return {
        place:
          "We could not resolve a timezone for that place. Enter one below — we will not guess it.",
      };
    }
    if (!isValidZone(place.timeZone)) {
      return {
        place: `"${place.timeZone}" is not a timezone we recognise. Use an IANA name such as Europe/London.`,
      };
    }
    return {};
  }

  function validateStep(index: number): Errors {
    if (index === 0) return validateDate();
    if (index === 1) return validateTime();
    return validatePlace();
  }

  function goNext() {
    const found = validateStep(step);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      play("error");
      return;
    }
    setErrors({});
    play("advance");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    play("select");
    setStep((current) => Math.max(current - 1, 0));
  }

  function choosePlace(result: PlaceResult) {
    setPlace(result);
    setErrors({});
    setQuery(result.displayName);
    setResults([]);
    setSearchState("idle");
    setActiveIndex(-1);
    play("confirm");
    if (!result.timeZone) {
      // The coordinate is known but the zone is not. Prefill the fallback and
      // let the person supply it rather than shipping a default.
      setManualLat(String(result.latitude));
      setManualLon(String(result.longitude));
      setManualZone("");
      setManualOpen(true);
    }
  }

  function applyManual() {
    const parsed = manualSchema.safeParse({
      latitude: Number(manualLat),
      longitude: Number(manualLon),
      timeZone: manualZone.trim(),
    });
    if (!parsed.success) {
      setErrors({
        manual: parsed.error.issues[0]?.message ?? "Check those coordinates.",
      });
      play("error");
      return;
    }
    if (!isValidZone(parsed.data.timeZone)) {
      setErrors({
        manual: `"${parsed.data.timeZone}" is not a timezone we recognise. Use an IANA name such as America/New_York.`,
      });
      play("error");
      return;
    }
    setPlace({
      name: place?.name ?? "Dropped pin",
      displayName: `${parsed.data.latitude.toFixed(4)}, ${parsed.data.longitude.toFixed(4)}`,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      timeZone: parsed.data.timeZone,
      country: place?.country ?? null,
      admin1: place?.admin1 ?? null,
    });
    setErrors({});
    setManualOpen(false);
    play("confirm");
  }

  async function submit() {
    const found = validatePlace();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      play("error");
      return;
    }
    if (!place?.timeZone) return;

    const input: BirthInput = {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      // Noon is the conventional placeholder for an unknown time, and the code
      // carries no flag to lie about: the reveal screen is told separately.
      hour: timeUnknown ? 12 : Number(hour),
      minute: timeUnknown ? 0 : Number(minute),
      second: 0,
      timeZone: place.timeZone,
      latitude: place.latitude,
      longitude: place.longitude,
      placeName: place.name,
    };

    setSubmitting(true);
    setErrors({});
    play("confirm");

    try {
      const response = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as ChartApiResponse;
      if (!response.ok || !data.ok || !data.code) {
        setErrors({
          place: data.error ?? "The chart could not be computed from that data.",
        });
        setSubmitting(false);
        play("error");
        return;
      }
      try {
        window.localStorage.setItem("cipher:last-chart", data.code);
      } catch {
        // Private mode can refuse storage; the reading is still reachable by URL.
      }
      router.push(
        timeUnknown
          ? `/reading/${data.code}?time=unknown`
          : `/reading/${data.code}`,
      );
    } catch {
      setErrors({
        place:
          "We could not reach the server. Check your connection and try again.",
      });
      setSubmitting(false);
      play("error");
    }
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "A") return;
    if (target.tagName === "TEXTAREA") return;
    event.preventDefault();
    if (step < STEPS.length - 1) goNext();
    else void submit();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setResults([]);
      setSearchState("idle");
      return;
    }
    if (searchState !== "ready" || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      const chosen = results[activeIndex];
      if (chosen) choosePlace(chosen);
    }
  }

  const activeStep = STEPS[step];
  const stepError = errors[activeStep.id as FieldName];

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
          {lastCode && step === 0 && !submitting ? (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3"
            >
              <p className="text-sm text-muted">
                You have a reading from earlier on this device.
              </p>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/reading/${lastCode}`}>Return to it</Link>
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.localStorage.removeItem("cipher:last-chart");
                    } catch {
                      // Ignore storage failures; the banner is cosmetic.
                    }
                    setLastCode(null);
                  }}
                  className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          ) : null}

          {/* ── Progress ─────────────────────────────────────────────── */}
          <ol
            aria-label="Progress"
            className="flex list-none flex-wrap items-center gap-x-6 gap-y-3 p-0"
          >
            {STEPS.map((item, index) => {
              const done = index < step;
              const current = index === step;
              return (
                <li
                  key={item.id}
                  aria-current={current ? "step" : undefined}
                  className="flex items-center gap-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full border font-mono text-[10px] transition-colors",
                      done && "border-gold bg-gold text-on-accent",
                      current && "border-gold text-gold",
                      !done && !current && "border-line text-faint",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.2em]",
                      current ? "text-bone" : "text-faint",
                    )}
                  >
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (step < STEPS.length - 1) goNext();
              else void submit();
            }}
            onKeyDown={handleFormKeyDown}
            noValidate
            className="mt-12"
          >
            <motion.section
              key={activeStep.id}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              aria-labelledby="enter-step-title"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
                {`Step ${step + 1} of ${STEPS.length}`}
              </p>
              <h1
                id="enter-step-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-4 font-display text-3xl leading-tight text-bone outline-none sm:text-4xl"
              >
                {activeStep.title}
              </h1>
              <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted">
                {activeStep.blurb}
              </p>

              <div className="mt-10">
                {/* ── Step 1: the date ───────────────────────────────── */}
                {step === 0 ? (
                  <fieldset className="flex flex-col gap-6">
                    <legend className="sr-only">Date of birth</legend>
                    <div className="grid gap-5 sm:grid-cols-[0.8fr_1.4fr_1fr]">
                      <Field label="Day" required>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="bday-day"
                          placeholder="14"
                          value={day}
                          invalid={Boolean(errors.date)}
                          onChange={(event) =>
                            setDay(digitsOnly(event.target.value, 2))
                          }
                          aria-label="Day of birth"
                        />
                      </Field>
                      <Field label="Month" required>
                        <Select
                          value={month}
                          invalid={Boolean(errors.date)}
                          onChange={(event) => setMonth(event.target.value)}
                          aria-label="Month of birth"
                        >
                          <option value="">Choose a month</option>
                          {MONTHS.map((name, index) => (
                            <option key={name} value={String(index + 1)}>
                              {name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Year" required>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="bday-year"
                          placeholder="1988"
                          value={year}
                          invalid={Boolean(errors.date)}
                          onChange={(event) =>
                            setYear(digitsOnly(event.target.value, 4))
                          }
                          aria-label="Year of birth"
                        />
                      </Field>
                    </div>

                    <Field
                      label="Or pick it from a calendar"
                      description="Both controls set the same date."
                    >
                      <input
                        type="date"
                        value={isoValue}
                        min="1900-01-01"
                        max={`${CURRENT_YEAR}-12-31`}
                        onChange={(event) => {
                          const [nextYear, nextMonth, nextDay] = event.target.value
                            .split("-")
                            .map((part) => part ?? "");
                          setYear(nextYear.replace(/[^0-9]/g, ""));
                          setMonth(nextMonth.replace(/[^0-9]/g, ""));
                          setDay(nextDay.replace(/[^0-9]/g, ""));
                        }}
                        className="field w-full px-0 py-2 text-sm text-bone [color-scheme:dark]"
                        aria-label="Date of birth from a calendar"
                      />
                    </Field>
                  </fieldset>
                ) : null}

                {/* ── Step 2: the hour ───────────────────────────────── */}
                {step === 1 ? (
                  <fieldset className="flex flex-col gap-6">
                    <legend className="sr-only">Time of birth</legend>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field
                        label="Hour (24-hour)"
                        description="0–23, local clock time at the place of birth."
                        required={!timeUnknown}
                      >
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="07"
                          value={timeUnknown ? "" : hour}
                          disabled={timeUnknown}
                          invalid={Boolean(errors.time)}
                          onChange={(event) =>
                            setHour(digitsOnly(event.target.value, 2))
                          }
                          aria-label="Hour of birth"
                        />
                      </Field>
                      <Field
                        label="Minute"
                        description="If the record says 7:24, the minute is 24."
                        required={!timeUnknown}
                      >
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="30"
                          value={timeUnknown ? "" : minute}
                          disabled={timeUnknown}
                          invalid={Boolean(errors.time)}
                          onChange={(event) =>
                            setMinute(digitsOnly(event.target.value, 2))
                          }
                          aria-label="Minute of birth"
                        />
                      </Field>
                    </div>

                    <div
                      className={cn(
                        "rounded-lg border p-5 transition-colors",
                        timeUnknown
                          ? "border-gold/40 bg-gold/5"
                          : "border-hairline bg-ink/50",
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={timeUnknown}
                          onChange={(event) => {
                            setTimeUnknown(event.target.checked);
                            setErrors({});
                            play(event.target.checked ? "confirm" : "select");
                          }}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-line bg-transparent transition-colors checked:border-gold checked:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                        />
                        <span className="flex flex-col gap-1">
                          <span className="text-sm text-bone">
                            I don&apos;t know my birth time
                          </span>
                          <span className="text-xs leading-relaxed text-faint">
                            We will compute for noon, local time, and label the
                            result honestly.
                          </span>
                        </span>
                      </label>

                      {timeUnknown ? (
                        <div className="mt-5 space-y-3 border-t border-hairline pt-5 text-sm leading-relaxed text-muted">
                          <p className="flex items-start gap-2">
                            <Clock
                              aria-hidden="true"
                              strokeWidth={1.5}
                              className="mt-0.5 h-4 w-4 shrink-0 text-teal"
                            />
                            <span>
                              <span className="text-bone">Still accurate:</span>{" "}
                              the Sun, Mercury, Venus, Mars and the outer planets
                              barely move in a day, so their signs, gates and the
                              Aura Avatar seat survive.
                            </span>
                          </p>
                          <p className="flex items-start gap-2">
                            <TriangleAlert
                              aria-hidden="true"
                              strokeWidth={1.5}
                              className="mt-0.5 h-4 w-4 shrink-0 text-warn"
                            />
                            <span>
                              <span className="text-bone">Not accurate:</span>{" "}
                              the Moon travels about 13° a day, and the Ascendant
                              crosses the entire zodiac in 24 hours. The Moon&apos;s
                              gate, the profile, the Ascendant and Midheaven, and
                              all twelve houses are unreliable, and we will say so
                              on the reading rather than dress them up.
                            </span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </fieldset>
                ) : null}

                {/* ── Step 3: the place ──────────────────────────────── */}
                {step === 2 ? (
                  <fieldset className="flex flex-col gap-6">
                    <legend className="sr-only">Place of birth</legend>

                    {place ? (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gold/30 bg-gold/5 px-5 py-4">
                        <div className="flex items-start gap-3">
                          <MapPin
                            aria-hidden="true"
                            strokeWidth={1.5}
                            className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                          />
                          <div>
                            <p className="text-sm text-bone">
                              {place.displayName}
                            </p>
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                              {`${Math.abs(place.latitude).toFixed(4)}°${place.latitude >= 0 ? "N" : "S"} ${Math.abs(place.longitude).toFixed(4)}°${place.longitude >= 0 ? "E" : "W"}`}
                              {place.timeZone
                                ? ` · ${place.timeZone}`
                                : " · timezone still needed"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPlace(null);
                            setManualOpen(true);
                            play("select");
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Field
                          label="Search for the town or city"
                          description="Type at least two characters. Use the arrow keys and Enter to pick a result."
                        >
                          <Input
                            type="search"
                            value={query}
                            placeholder="Montreal, Quebec"
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={searchState === "ready"}
                            aria-controls="geocode-results"
                            aria-autocomplete="list"
                            aria-activedescendant={
                              activeIndex >= 0
                                ? `geocode-option-${activeIndex}`
                                : undefined
                            }
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={handleSearchKeyDown}
                          />
                        </Field>
                        <Search
                          aria-hidden="true"
                          strokeWidth={1.5}
                          className="pointer-events-none absolute right-0 top-[26px] h-4 w-4 text-faint"
                        />
                      </div>
                    )}

                    <p
                      role="status"
                      aria-live="polite"
                      className="min-h-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint"
                    >
                      {searchState === "loading"
                        ? "Searching…"
                        : searchState === "empty"
                          ? "No places matched. Try a nearby larger town, or enter coordinates below."
                          : searchState === "error"
                            ? (searchError ?? "Search failed.")
                            : searchState === "ready"
                              ? `${results.length} place${results.length === 1 ? "" : "s"} found.`
                              : ""}
                    </p>

                    {results.length > 0 ? (
                      <ul
                        id="geocode-results"
                        role="listbox"
                        aria-label="Place suggestions"
                        className="surface list-none divide-y divide-hairline overflow-hidden rounded-lg p-0"
                      >
                        {results.map((result, index) => (
                          <li
                            key={`${result.latitude},${result.longitude},${result.displayName}`}
                            id={`geocode-option-${index}`}
                            role="option"
                            aria-selected={index === activeIndex}
                            onClick={() => choosePlace(result)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                              "cursor-pointer px-5 py-4 transition-colors",
                              index === activeIndex ? "bg-raised" : "bg-transparent",
                            )}
                          >
                            <p className="text-sm text-bone">{result.name}</p>
                            <p className="mt-1 text-xs leading-relaxed text-faint">
                              {result.displayName}
                            </p>
                            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                              {result.timeZone ?? "timezone unknown — you choose"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="border-t border-hairline pt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setManualOpen((open) => !open);
                          play("select");
                        }}
                        aria-expanded={manualOpen}
                        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                      >
                        {manualOpen
                          ? "Hide manual entry"
                          : "Enter latitude, longitude and timezone by hand"}
                      </button>

                      {manualOpen ? (
                        <div className="mt-6 grid gap-5 sm:grid-cols-3">
                          <Field label="Latitude" description="-90 to 90">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={manualLat}
                              invalid={Boolean(errors.manual)}
                              onChange={(event) => setManualLat(event.target.value)}
                              placeholder="45.5019"
                              aria-label="Latitude"
                            />
                          </Field>
                          <Field label="Longitude" description="-180 to 180">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={manualLon}
                              invalid={Boolean(errors.manual)}
                              onChange={(event) => setManualLon(event.target.value)}
                              placeholder="-73.5674"
                              aria-label="Longitude"
                            />
                          </Field>
                          <Field
                            label="Timezone"
                            description="IANA name"
                          >
                            <Input
                              type="text"
                              list="iana-zones"
                              value={manualZone}
                              invalid={Boolean(errors.manual)}
                              onChange={(event) =>
                                setManualZone(event.target.value)
                              }
                              placeholder="America/Toronto"
                              aria-label="IANA timezone"
                            />
                          </Field>
                          <datalist id="iana-zones">
                            {zones.map((zone) => (
                              <option key={zone} value={zone} />
                            ))}
                          </datalist>
                          <div className="sm:col-span-3">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={applyManual}
                            >
                              Use these coordinates
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </fieldset>
                ) : null}
              </div>

              {/* ── Errors ─────────────────────────────────────────── */}
              {stepError ? (
                <p
                  role="alert"
                  className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-danger"
                >
                  <TriangleAlert
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  {stepError}
                </p>
              ) : null}
              {errors.manual && step === 2 ? (
                <p role="alert" className="mt-3 text-sm leading-relaxed text-danger">
                  {errors.manual}
                </p>
              ) : null}

              {/* ── Navigation ─────────────────────────────────────── */}
              <div className="mt-10 flex items-center justify-between gap-4 border-t border-hairline pt-8">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={step === 0}
                  iconLeft={<ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}
                >
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button
                    variant="primary"
                    onClick={goNext}
                    iconRight={<ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => void submit()}
                    loading={submitting}
                    iconRight={
                      submitting ? undefined : (
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )
                    }
                  >
                    Compute my reading
                  </Button>
                )}
              </div>
            </motion.section>
          </form>
        </div>
      </main>

      {/* ── Computing overlay ──────────────────────────────────────── */}
      {submitting ? (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-void/95 px-6 backdrop-blur-sm"
        >
          <div
            role="status"
            aria-live="polite"
            className="flex max-w-sm flex-col items-center text-center"
          >
            <motion.div
              className="h-40 w-40"
              animate={reduced ? undefined : { rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            >
              <Cosmogram
                className="h-full w-full"
                progress={0.8}
                animated={!reduced}
              />
            </motion.div>
            <p className="mt-8 font-display text-xl tracking-wide text-bone">
              Tuning the wheel
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
              {LOADING_LINES[loadingIndex]}
            </p>
            <p className="mt-6 text-xs leading-relaxed text-faint">
              The ephemeris is resolving twenty-six activations and the chart
              behind them. This takes a moment and no account.
            </p>
          </div>
        </motion.div>
      ) : null}
    </>
  );
}
