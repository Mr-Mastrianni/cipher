"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Compass,
  Sparkles,
} from "lucide-react";

import { Cosmogram } from "@/components/cipher/cosmogram";
import { AuraAvatarCard } from "@/components/cipher/aura-avatar-card";
import { useSound } from "@/components/providers/sound-provider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AuraAvatar } from "@/lib/cipher/aura-avatar";
import type { MemberCategory } from "@/lib/cipher/categorization";

/**
 * Onboarding.
 *
 * A single client component because the whole flow is one interactive state
 * machine. The *server* owns authorisation and the reading: `src/proxy.ts`
 * redirects signed-out visitors away from `/onboarding`, and every read and
 * write goes through `/api/onboarding`, which re-checks the session and
 * recomputes the chart from raw birth fields. Nothing the browser computes is
 * ever trusted.
 *
 * Accessibility contract:
 *  - every control is labelled through the UI kit's `Field`/`Label`;
 *  - focus moves to the step heading on every step change;
 *  - async results and errors land in a polite live region;
 *  - all motion is skipped when `prefers-reduced-motion` is set.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Wire types (mirror the route handlers)
 * ──────────────────────────────────────────────────────────────────────────── */

interface BirthFields {
  birthDate: string;
  birthTime: string;
  birthTimeZone: string;
  birthLatitude: number;
  birthLongitude: number;
  birthPlaceName?: string | null;
}

interface BootstrapResponse {
  ok: boolean;
  onboardingCompleted?: boolean;
  hasBirthProfile?: boolean;
  timezone?: string | null;
  birth?: BirthFields | null;
  error?: string;
}

interface RevealResponse {
  ok: boolean;
  avatar?: AuraAvatar | null;
  category?: MemberCategory;
  channels?: string[];
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  warnings?: string[];
  error?: string;
}

type Knowledge = "none" | "some" | "deep";

interface Answers {
  hereToMake: string;
  workDescription: string;
  humanDesignKnowledge: Knowledge | "";
  stopDoing: string;
  wants: string[];
  timezone: string;
  callSlot: string;
}

const WANTS = [
  "community",
  "weekly calls",
  "courses",
  "readings",
  "accountability",
  "business",
] as const;

const WORK_OPTIONS = [
  { value: "founder", label: "Building my own thing", hint: "Founder, operator, or solo." },
  { value: "creative", label: "A creative practice", hint: "Writing, design, music, art." },
  { value: "employed", label: "Employed, building on the side", hint: "Day job plus the real work." },
  { value: "practitioner", label: "A practitioner of some kind", hint: "Coach, therapist, reader, teacher." },
  { value: "studying", label: "Studying or between things", hint: "In transition, on purpose." },
  { value: "other", label: "Something else", hint: "Tell us on the next screen if it matters." },
] as const;

const KNOWLEDGE_OPTIONS = [
  { value: "none", label: "None", hint: "I have never had a reading." },
  { value: "some", label: "Some", hint: "I know my type. I get lost after that." },
  { value: "deep", label: "Deep", hint: "I read charts, or I am learning to." },
] as const;

const CALL_SLOTS = [
  "Tuesday · 17:00 UTC",
  "Wednesday · 18:00 UTC",
  "Thursday · 09:00 UTC",
  "Saturday · 16:00 UTC",
] as const;

/** A small, honest set of zones for the datalist; the field stays free text. */
const TIMEZONE_SUGGESTIONS = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Lisbon",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

type StepId =
  | "birth"
  | "make"
  | "work"
  | "hd"
  | "stop"
  | "collective"
  | "schedule"
  | "reveal";

interface StepMeta {
  id: StepId;
  eyebrow: string;
  title: string;
  blurb: string;
}

const STEP_META: Record<StepId, StepMeta> = {
  birth: {
    id: "birth",
    eyebrow: "Coordinates",
    title: "Where and when did you arrive?",
    blurb:
      "The chart is cast for the exact moment and place. Minutes matter for the Moon, the Ascendant and the profile line.",
  },
  make: {
    id: "make",
    eyebrow: "01 — The work",
    title: "What are you here to make?",
    blurb:
      "Not a job title. The thing you would build even if nobody clapped. One sentence is enough, but be specific.",
  },
  work: {
    id: "work",
    eyebrow: "02 — The shape",
    title: "Which of these best describes your current work?",
    blurb: "Closest fit. This places you next to people in the same phase.",
  },
  hd: {
    id: "hd",
    eyebrow: "03 — The system",
    title: "What do you already know about Human Design?",
    blurb:
      "So we pitch the room correctly — no assumptions, and no condescension either way.",
  },
  stop: {
    id: "stop",
    eyebrow: "04 — The subtraction",
    title: "What is the one thing you want to stop doing?",
    blurb:
      "The habit, the role, the obligation. Naming it here makes it a commitment rather than a wish.",
  },
  collective: {
    id: "collective",
    eyebrow: "05 — The room",
    title: "What do you want from the collective?",
    blurb: "Choose everything that applies. This decides which channels you are added to.",
  },
  schedule: {
    id: "schedule",
    eyebrow: "06 — The clock",
    title: "Where are you, and when can you meet?",
    blurb:
      "The weekly call is one hour, recorded. Pick the slot you can actually keep.",
  },
  reveal: {
    id: "reveal",
    eyebrow: "Placement",
    title: "You are in.",
    blurb: "Here is where the chart puts you.",
  },
};

const WANTS_LABEL: Record<(typeof WANTS)[number], string> = {
  community: "Community — people to think with",
  "weekly calls": "Weekly calls — live, recorded",
  courses: "Courses — structured material",
  readings: "Readings — my chart read properly",
  accountability: "Accountability — someone expecting me",
  business: "Business — turning this into income",
};

function defaultAnswers(timezone: string): Answers {
  return {
    hereToMake: "",
    workDescription: "",
    humanDesignKnowledge: "",
    stopDoing: "",
    wants: [],
    timezone: timezone || "UTC",
    callSlot: "",
  };
}

function defaultBirth(timezone: string): BirthFields {
  return {
    birthDate: "",
    birthTime: "",
    birthTimeZone: timezone || "UTC",
    birthLatitude: 0,
    birthLongitude: 0,
    birthPlaceName: "",
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small presentational helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function StepPanel({
  children,
  panelRef,
  reduced,
}: {
  children: ReactNode;
  panelRef: React.RefObject<HTMLDivElement | null>;
  reduced: boolean;
}) {
  if (reduced) {
    return (
      <div ref={panelRef} tabIndex={-1} className="focus:outline-none">
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      className="focus:outline-none"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function PlacementCard({
  kind,
  name,
  description,
  channel,
}: {
  kind: string;
  name: string;
  description: string;
  channel: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
          {kind}
        </p>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted text-pretty">
          {description}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          #{channel}
        </p>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The flow
 * ──────────────────────────────────────────────────────────────────────────── */

type Phase = "loading" | "unauthorised" | "error" | "ready" | "submitting";

export default function OnboardingPage() {
  const reduced = useReducedMotion() ?? false;
  const { play } = useSound();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [bootError, setBootError] = useState<string | null>(null);

  const [hasBirthProfile, setHasBirthProfile] = useState(false);
  const [birth, setBirth] = useState<BirthFields>(() => defaultBirth("UTC"));
  const [answers, setAnswers] = useState<Answers>(() => defaultAnswers("UTC"));

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading your file.");
  const [reveal, setReveal] = useState<RevealResponse | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  /* ── Bootstrap ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/onboarding", {
          headers: { accept: "application/json" },
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          setPhase("unauthorised");
          return;
        }
        if (!response.ok) {
          setBootError("We could not load your onboarding state.");
          setPhase("error");
          return;
        }
        const data = (await response.json()) as BootstrapResponse;
        const zone = data.timezone ?? "UTC";
        setHasBirthProfile(Boolean(data.hasBirthProfile));
        setBirth(data.birth ? { ...data.birth, birthPlaceName: data.birth.birthPlaceName ?? "" } : defaultBirth(zone));
        setAnswers(defaultAnswers(zone));
        setStatusMessage(
          data.hasBirthProfile
            ? "Your chart is on file. Let us place you."
            : "Let us take your birth details first.",
        );
        setPhase("ready");
      } catch {
        if (cancelled) return;
        setBootError("We could not reach the server.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Steps ─────────────────────────────────────────────────────────────── */

  const steps = useMemo<StepMeta[]>(() => {
    const order: StepId[] = hasBirthProfile
      ? ["make", "work", "hd", "stop", "collective", "schedule"]
      : ["birth", "make", "work", "hd", "stop", "collective", "schedule"];
    return order.map((id) => STEP_META[id]);
  }, [hasBirthProfile]);

  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[clampedIndex] ?? STEP_META.make;
  const isReveal = stepIndex >= steps.length;

  // Move focus into the new step so keyboard and screen-reader users are not
  // left behind at the top of the page.
  useEffect(() => {
    if (phase !== "ready") return;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stepIndex, phase]);

  useEffect(() => {
    if (phase !== "ready") return;
    setStatusMessage(`${step.eyebrow}: ${step.title}`);
  }, [phase, step.eyebrow, step.title]);

  /* ── Validation ────────────────────────────────────────────────────────── */

  const validate = useCallback(
    (id: StepId): string | null => {
      switch (id) {
        case "birth":
          if (!birth.birthDate) return "Enter your date of birth.";
          if (!birth.birthTime) return "Enter your time of birth (00:00 if unknown).";
          if (!birth.birthTimeZone.trim()) return "Enter the time zone of your birthplace.";
          if (!birth.birthPlaceName?.trim())
            return "Add the nearest city, so the coordinates are checkable.";
          if (!Number.isFinite(birth.birthLatitude) || Math.abs(birth.birthLatitude) > 90)
            return "Latitude must be between -90 and 90.";
          if (!Number.isFinite(birth.birthLongitude) || Math.abs(birth.birthLongitude) > 180)
            return "Longitude must be between -180 and 180.";
          return null;
        case "make":
          return answers.hereToMake.trim().length >= 3
            ? null
            : "Give us at least a short sentence.";
        case "work":
          return answers.workDescription ? null : "Choose the closest fit.";
        case "hd":
          return answers.humanDesignKnowledge ? null : "Choose one.";
        case "stop":
          return answers.stopDoing.trim().length >= 3
            ? null
            : "Name the one thing, even roughly.";
        case "collective":
          return answers.wants.length > 0 ? null : "Choose at least one.";
        case "schedule":
          if (!answers.timezone.trim()) return "Enter your time zone.";
          return answers.callSlot ? null : "Pick the slot you can keep.";
        default:
          return null;
      }
    },
    [answers, birth],
  );

  const focusFirstField = useCallback(() => {
    window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const control = panel.querySelector<HTMLElement>(
        "input, textarea, select, button",
      );
      control?.focus();
    });
  }, []);

  const goNext = useCallback(() => {
    const error = validate(step.id);
    if (error) {
      setFieldError(error);
      setStatusMessage(error);
      play("error");
      focusFirstField();
      return;
    }
    setFieldError(null);
    play("advance");
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [focusFirstField, play, step.id, steps.length, validate]);

  const goBack = useCallback(() => {
    setFieldError(null);
    play("tick");
    setStepIndex((current) => Math.max(current - 1, 0));
  }, [play]);

  /* ── Submit ────────────────────────────────────────────────────────────── */

  const submit = useCallback(async () => {
    const error = validate("schedule");
    if (error) {
      setFieldError(error);
      setStatusMessage(error);
      play("error");
      return;
    }

    setPhase("submitting");
    setFieldError(null);
    setStatusMessage("Computing your chart and placing you.");

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Only send birth data when there is no stored profile; otherwise the
          // server recomputes from what it already holds.
          birth: hasBirthProfile ? undefined : birth,
          answers,
        }),
      });

      const data = (await response.json()) as RevealResponse;
      if (!response.ok || !data.ok) {
        setPhase("ready");
        setFieldError(data.error ?? "We could not save that. Try once more.");
        setStatusMessage(data.error ?? "We could not save that.");
        play("error");
        return;
      }

      setReveal(data);
      setPhase("ready");
      setStatusMessage("Your placement is ready.");
      play("reveal");
      // Reveal replaces the step list; render it by pointing past the end.
      setStepIndex(steps.length);
    } catch {
      setPhase("ready");
      setFieldError("The connection dropped. Try once more.");
      setStatusMessage("The connection dropped.");
      play("error");
    }
  }, [answers, birth, hasBirthProfile, play, steps.length, validate]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (phase === "loading") {
    return (
      <main id="main" className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="flex flex-col items-center gap-5 text-center">
          <Spinner size="lg" />
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
            Reading your file
          </p>
        </div>
      </main>
    );
  }

  if (phase === "unauthorised" || phase === "error") {
    const unauthorised = phase === "unauthorised";
    return (
      <main id="main" className="mx-auto w-full max-w-lg px-6 py-24">
        <EmptyState
          icon={<Compass aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
          title={unauthorised ? "Sign in to be placed" : "Something went wrong"}
          description={
            unauthorised
              ? "Onboarding is where your chart, cohort and channels are assigned, so it needs a signed-in account. If this deployment has no auth configured you will not be able to pass this point."
              : (bootError ?? "We could not load your onboarding state.")
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {unauthorised && (
                <Button asChild>
                  <Link href="/sign-in?redirect_url=/onboarding">Sign in</Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href="/">Back to the threshold</Link>
              </Button>
            </div>
          }
        />
      </main>
    );
  }

  const revealAvatar = reveal?.avatar ?? null;

  return (
    <main id="main" className="relative flex-1">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hairline-grid opacity-[0.25]"
      />

      {/* Live region: step announcements, async results and errors. */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[280px_minmax(0,1fr)] lg:py-20">
        {/* ── Rail ───────────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted transition-colors hover:text-gold"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            The Cipher
          </Link>

          <div className="hidden h-28 w-28 lg:block">
            <Cosmogram
              className="h-full w-full"
              progress={isReveal ? 1 : clampedIndex / Math.max(steps.length, 1)}
            />
          </div>

          {!isReveal && (
            <Progress
              value={clampedIndex + 1}
              max={steps.length}
              label={`Step ${clampedIndex + 1} of ${steps.length}`}
              showValue
            />
          )}

          <ol className="hidden flex-col gap-2 lg:flex" aria-label="Onboarding steps">
            {steps.map((entry, index) => (
              <li
                key={entry.id}
                aria-current={index === clampedIndex ? "step" : undefined}
                className={cn(
                  "flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em]",
                  index === clampedIndex
                    ? "text-gold"
                    : index < clampedIndex
                      ? "text-muted"
                      : "text-faint",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full border",
                    index < clampedIndex
                      ? "border-gold/50 text-gold"
                      : index === clampedIndex
                        ? "border-gold text-gold"
                        : "border-line text-faint",
                  )}
                >
                  {index < clampedIndex ? (
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                {entry.title}
              </li>
            ))}
          </ol>
        </aside>

        {/* ── Panel ──────────────────────────────────────────────────────── */}
        <section className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            {isReveal ? STEP_META.reveal.eyebrow : step.eyebrow}
          </p>

          {fieldError && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={1.5}
              />
              {fieldError}
            </p>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <StepPanel key={isReveal ? "reveal" : step.id} panelRef={panelRef} reduced={reduced}>
              {isReveal ? (
                <RevealView reveal={reveal} avatar={revealAvatar} />
              ) : (
                <>
                  <h1 className="mt-4 font-display text-3xl leading-tight text-bone text-balance">
                    {step.title}
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted text-pretty">
                    {step.blurb}
                  </p>

                  <div className="mt-9">
                    {step.id === "birth" && (
                      <BirthStep
                        birth={birth}
                        onChange={setBirth}
                        firstFieldRef={firstFieldRef}
                      />
                    )}

                    {step.id === "make" && (
                      <Field
                        label="What you are here to make"
                        description="One or two sentences. The concrete version, not the impressive one."
                        required
                      >
                        <Textarea
                          value={answers.hereToMake}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              hereToMake: event.target.value,
                            }))
                          }
                          maxLength={2000}
                          rows={5}
                          autoFocus
                        />
                      </Field>
                    )}

                    {step.id === "work" && (
                      <RadioGroup label="Current work" description="Closest fit — you can change it later.">
                        {WORK_OPTIONS.map((option) => (
                          <Radio
                            key={option.value}
                            name="workDescription"
                            value={option.value}
                            checked={answers.workDescription === option.value}
                            onChange={() => {
                              play("select");
                              setAnswers((current) => ({
                                ...current,
                                workDescription: option.value,
                              }));
                            }}
                            label={option.label}
                            description={option.hint}
                          />
                        ))}
                      </RadioGroup>
                    )}

                    {step.id === "hd" && (
                      <RadioGroup label="Human Design" description="No wrong answer.">
                        {KNOWLEDGE_OPTIONS.map((option) => (
                          <Radio
                            key={option.value}
                            name="humanDesignKnowledge"
                            value={option.value}
                            checked={answers.humanDesignKnowledge === option.value}
                            onChange={() => {
                              play("select");
                              setAnswers((current) => ({
                                ...current,
                                humanDesignKnowledge: option.value,
                              }));
                            }}
                            label={option.label}
                            description={option.hint}
                          />
                        ))}
                      </RadioGroup>
                    )}

                    {step.id === "stop" && (
                      <Field
                        label="The one thing you want to stop doing"
                        description="A behaviour, a role, a commitment. One line is fine."
                        required
                      >
                        <Textarea
                          value={answers.stopDoing}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              stopDoing: event.target.value,
                            }))
                          }
                          maxLength={2000}
                          rows={4}
                          autoFocus
                        />
                      </Field>
                    )}

                    {step.id === "collective" && (
                      <fieldset className="flex flex-col gap-4">
                        <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                          What you want from the collective
                        </legend>
                        <p className="text-xs leading-relaxed text-faint">
                          Pick everything that is true. These map onto channels.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {WANTS.map((want) => (
                            <label
                              key={want}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                                answers.wants.includes(want)
                                  ? "border-gold/50 bg-gold/5"
                                  : "border-hairline hover:border-line",
                              )}
                            >
                              <Checkbox
                                name="wants"
                                value={want}
                                checked={answers.wants.includes(want)}
                                onChange={(event) => {
                                  play("tick");
                                  setAnswers((current) => ({
                                    ...current,
                                    wants: event.target.checked
                                      ? [...current.wants, want]
                                      : current.wants.filter((item) => item !== want),
                                  }));
                                }}
                              />
                              <span className="text-sm leading-snug text-bone">
                                {WANTS_LABEL[want]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {step.id === "schedule" && (
                      <div className="flex flex-col gap-6">
                        <Field
                          label="Your time zone"
                          description="IANA name — the one your calendar uses."
                          required
                        >
                          <Input
                            value={answers.timezone}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                timezone: event.target.value,
                              }))
                            }
                            list="cipher-timezones"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Europe/London"
                          />
                        </Field>
                        <datalist id="cipher-timezones">
                          {TIMEZONE_SUGGESTIONS.map((zone) => (
                            <option key={zone} value={zone} />
                          ))}
                        </datalist>

                        <Field
                          label="Preferred weekly call"
                          description="One hour, recorded if you miss it."
                          required
                        >
                          <Select
                            value={answers.callSlot}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                callSlot: event.target.value,
                              }))
                            }
                          >
                            <option value="">Choose a slot…</option>
                            {CALL_SLOTS.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    )}
                  </div>

                  <div className="mt-10 flex flex-wrap items-center gap-3">
                      {clampedIndex > 0 && (
                        <Button
                          variant="ghost"
                          onClick={goBack}
                          iconLeft={
                            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                          }
                        >
                          Back
                        </Button>
                      )}
                      {step.id === "schedule" ? (
                        <Button
                          onClick={submit}
                          loading={phase === "submitting"}
                          iconRight={
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                          }
                        >
                          Complete and be placed
                        </Button>
                      ) : (
                        <Button
                          onClick={goNext}
                          iconRight={
                            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                          }
                        >
                          Continue
                        </Button>
                      )}
                    </div>
                </>
              )}
            </StepPanel>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Birth step
 * ──────────────────────────────────────────────────────────────────────────── */

function BirthStep({
  birth,
  onChange,
  firstFieldRef,
}: {
  birth: BirthFields;
  onChange: (next: BirthFields) => void;
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field label="Date of birth" required>
        <Input
          ref={firstFieldRef}
          type="date"
          value={birth.birthDate}
          max="2100-12-31"
          onChange={(event) => onChange({ ...birth, birthDate: event.target.value })}
        />
      </Field>

      <Field
        label="Time of birth"
        description="On the birth record or certificate. Use 00:00 if unknown."
        required
      >
        <Input
          type="time"
          value={birth.birthTime}
          onChange={(event) => onChange({ ...birth, birthTime: event.target.value })}
        />
      </Field>

      <Field
        label="Birth city"
        description="Nearest town is enough — used for the coordinates below."
        required
      >
        <Input
          value={birth.birthPlaceName ?? ""}
          onChange={(event) =>
            onChange({ ...birth, birthPlaceName: event.target.value })
          }
          placeholder="Leeds, England"
          autoComplete="off"
        />
      </Field>

      <Field label="Time zone at birth" description="IANA name, including historical DST." required>
        <Input
          value={birth.birthTimeZone}
          onChange={(event) => onChange({ ...birth, birthTimeZone: event.target.value })}
          list="cipher-timezones-birth"
          autoComplete="off"
          spellCheck={false}
          placeholder="Europe/London"
        />
      </Field>
      <datalist id="cipher-timezones-birth">
        {TIMEZONE_SUGGESTIONS.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>

      <Field label="Latitude" description="Decimal degrees, negative for south." required>
        <Input
          type="number"
          step="0.0001"
          min={-90}
          max={90}
          value={String(birth.birthLatitude)}
          onChange={(event) =>
            onChange({ ...birth, birthLatitude: Number(event.target.value) })
          }
        />
      </Field>

      <Field label="Longitude" description="Decimal degrees, negative for west." required>
        <Input
          type="number"
          step="0.0001"
          min={-180}
          max={180}
          value={String(birth.birthLongitude)}
          onChange={(event) =>
            onChange({ ...birth, birthLongitude: Number(event.target.value) })
          }
        />
      </Field>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reveal
 * ──────────────────────────────────────────────────────────────────────────── */

function RevealView({
  reveal,
  avatar,
}: {
  reveal: RevealResponse | null;
  avatar: AuraAvatar | null;
}) {
  const router = useRouter();

  if (!reveal?.category) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={<CircleAlert aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
          title="The placement did not come back"
          description="Your answers were saved. Reload the page to see your placement."
        />
      </div>
    );
  }

  const { category } = reveal;

  return (
    <div className="mt-4 flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl leading-tight text-bone text-balance sm:text-4xl">
          {avatar ? avatar.label : "You are placed"}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted text-pretty">
          {reveal.summary}
        </p>
      </div>

      {avatar && (
        <AuraAvatarCard avatar={avatar} size="md" animate />
      )}

      <section aria-labelledby="placement-heading" className="flex flex-col gap-4">
        <h2
          id="placement-heading"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold"
        >
          Your placement
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <PlacementCard
            kind="Cohort"
            name={category.cohort.name}
            description={category.cohort.description}
            channel={category.cohort.channel}
          />
          <PlacementCard
            kind="Archetype"
            name={category.archetype.name}
            description={category.archetype.description}
            channel={category.archetype.channel}
          />
          <PlacementCard
            kind="Lane"
            name={category.lane.name}
            description={category.lane.description}
            channel={category.lane.channel}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ok">
              Strengths
            </p>
            <CardTitle>What the defined centres give you</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {(reveal.strengths ?? category.strengths).map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ok"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-warn">
              Growth edges
            </p>
            <CardTitle>What the open centres are teaching</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {(reveal.weaknesses ?? category.growthEdges).map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="channels-heading" className="flex flex-col gap-4">
        <h2
          id="channels-heading"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold"
        >
          Channels you were added to
        </h2>
        <div className="flex flex-wrap gap-2">
          {(reveal.channels ?? []).map((channel) => (
            <Badge key={channel} tone="teal">
              #{channel}
            </Badge>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          These open in the collective once your membership is approved. You can
          read and post there from your dashboard.
        </p>
      </section>

      {(reveal.warnings?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-warn">
            Birth-time sensitivity
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {reveal.warnings?.map((warning) => (
              <li key={warning} className="text-xs leading-relaxed text-muted">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          iconRight={<ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />}
        >
          Enter your dashboard
        </Button>
        <Button variant="outline" asChild>
          <Link href="/membership">Apply for membership</Link>
        </Button>
      </div>
    </div>
  );
}
