"use client";

import {
  useCallback,
  useEffect,
  useId,
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
  CircleAlert,
  Compass,
  Save,
  Sparkles,
} from "lucide-react";

import { Cosmogram } from "@/components/cipher/cosmogram";
import { AuraAvatarCard } from "@/components/cipher/aura-avatar-card";
import {
  BirthVerification,
  type BirthMomentDraft,
  type VerifiedBirth,
} from "@/components/cipher/birth-verification";
import {
  PlaceAutocomplete,
  type PlaceSuggestion,
} from "@/components/onboarding/place-autocomplete";
import { StepDots, StepProgress } from "@/components/onboarding/step-progress";
import { ShortcutHints } from "@/components/onboarding/shortcut-hints";
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
  Label,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { readDraft, removeDraft, writeDraft } from "@/lib/onboarding/draft";
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

/**
 * Per-field validation, run while typing rather than only on Continue.
 *
 * Each rule returns an error string or `null`. The rules are deliberately
 * gentler than `validate`: an empty field is not an error until it is left,
 * because flagging a field the person has not reached yet is just noise.
 */
const INLINE_RULES: Record<string, (value: string) => string | null> = {
  birthDate: (value) => (value ? null : "Enter your date of birth."),
  birthTime: (value) =>
    /^\d{2}:\d{2}:\d{2}$/.test(value)
      ? null
      : "Include seconds, as HH:MM:SS.",
  birthTimeZone: (value) => (value.trim() ? null : "The zone is required."),
  birthPlaceName: (value) => (value.trim() ? null : "Name the nearest town."),
  birthLatitude: (value) => {
    const parsed = Number(value);
    if (value.trim() === "" || !Number.isFinite(parsed)) return "Enter a decimal degree.";
    return Math.abs(parsed) <= 90 ? null : "Latitude runs from −90 to 90.";
  },
  birthLongitude: (value) => {
    const parsed = Number(value);
    if (value.trim() === "" || !Number.isFinite(parsed)) return "Enter a decimal degree.";
    return Math.abs(parsed) <= 180 ? null : "Longitude runs from −180 to 180.";
  },
  timezone: (value) => (value.trim() ? null : "The zone is required."),
  hereToMake: (value) =>
    value.trim().length >= 3 ? null : "Give us at least a few words.",
  stopDoing: (value) =>
    value.trim().length >= 3 ? null : "Name it, even roughly.",
};

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
  | "verify"
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
      "Your KP chart is cast for the exact second and place. A cusp crosses a sub lord in as little as a minute of clock time.",
  },
  verify: {
    id: "verify",
    eyebrow: "Verification",
    title: "Confirm the exact moment",
    blurb:
      "Check the time zone, UTC offset and daylight saving. KP is cast only from a moment you have confirmed.",
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

  const [phase, setPhase] = useState<Phase>("loading");
  const [bootError, setBootError] = useState<string | null>(null);

  const [hasBirthProfile, setHasBirthProfile] = useState(false);
  const [birth, setBirth] = useState<BirthFields>(() => defaultBirth("UTC"));
  // Set only once the person confirms the resolved moment in the verify step.
  const [verifiedBirth, setVerifiedBirth] = useState<VerifiedBirth | null>(null);
  const [answers, setAnswers] = useState<Answers>(() => defaultAnswers("UTC"));

  const [stepIndex, setStepIndex] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading your file.");
  const [reveal, setReveal] = useState<RevealResponse | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // While-typing validation, separate from the per-step gate `validate` below.
  // Errors are only *shown* once a field has been left (see `touched`), because
  // flagging the first character someone types is noise, not help.
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const inlineTimers = useRef<Record<string, number>>({});

  // Draft save/resume. `draftSavedAt` is what the header reports, so the
  // control reflects a real write rather than an optimistic one.
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  /**
   * Validate one field as it is typed, debounced so a fast typist is not
   * scolded mid-word.
   *
   * @param name - The key in {@link INLINE_RULES}.
   * @param value - The current control value.
   */
  const validateField = useCallback((name: string, value: string) => {
    const rule = INLINE_RULES[name];
    if (!rule) return;
    const timers = inlineTimers.current;
    window.clearTimeout(timers[name]);
    timers[name] = window.setTimeout(() => {
      const error = rule(value);
      setInlineErrors((current) => {
        const next = { ...current };
        if (error) next[name] = error;
        else delete next[name];
        return next;
      });
    }, 260);
  }, []);

  useEffect(() => {
    const timers = inlineTimers.current;
    return () => {
      for (const id of Object.values(timers)) window.clearTimeout(id);
    };
  }, []);

  /**
   * Mark a field as visited, so its error may be displayed.
   *
   * @param name - The field key.
   */
  const markTouched = useCallback((name: string) => {
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
  }, []);

  // The draft line is a confirmation, not a permanent status: it fades back to
  // the stored timestamp so the header keeps telling the truth over time.
  const draftMessageTimer = useRef<number | null>(null);
  const flashDraftMessage = useCallback((message: string | null) => {
    if (draftMessageTimer.current !== null) {
      window.clearTimeout(draftMessageTimer.current);
      draftMessageTimer.current = null;
    }
    setDraftMessage(message);
    if (message) {
      draftMessageTimer.current = window.setTimeout(() => {
        draftMessageTimer.current = null;
        setDraftMessage(null);
      }, 4000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (draftMessageTimer.current !== null) {
        window.clearTimeout(draftMessageTimer.current);
      }
    };
  }, []);

  /** Store the current answers on this device. */
  const saveDraft = useCallback(() => {
    const stored = writeDraft<BirthFields, Answers>({
      stepIndex,
      hasBirthProfile,
      birth,
      answers,
    });
    if (stored) {
      setDraftSavedAt(Date.now());
      flashDraftMessage("Draft saved on this device.");
      play("confirm");
      setStatusMessage("Draft saved on this device.");
    } else {
      flashDraftMessage("This browser would not store a draft.");
      play("error");
      setStatusMessage("This browser would not store a draft.");
    }
  }, [answers, birth, flashDraftMessage, hasBirthProfile, play, stepIndex]);

  /** Forget the stored draft and its status line. */
  const discardDraft = useCallback(() => {
    removeDraft();
    setDraftSavedAt(null);
    flashDraftMessage(null);
  }, [flashDraftMessage]);

  /* ── Bootstrap ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // A stored draft is restored before the server is consulted, so answers
      // already given are never replaced by fresh defaults. It is read inside
      // the async body rather than the effect body: the restore is a normal
      // async update, not a cascading synchronous one.
      const draft = readDraft<BirthFields, Answers>();
      if (!cancelled && draft) {
        setBirth(draft.birth);
        setAnswers(draft.answers);
        setStepIndex(draft.stepIndex);
        setHasBirthProfile(draft.hasBirthProfile);
        setDraftSavedAt(draft.savedAt);
        flashDraftMessage("Draft restored from this device.");
      }

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

        // The server knows whether a chart is already on file; that is the one
        // fact it may override, because it decides which steps exist at all.
        if (data.hasBirthProfile) setHasBirthProfile(true);

        if (!draft) {
          setHasBirthProfile(Boolean(data.hasBirthProfile));
          setBirth(
            data.birth
              ? { ...data.birth, birthPlaceName: data.birth.birthPlaceName ?? "" }
              : defaultBirth(zone),
          );
          setAnswers(defaultAnswers(zone));
          setStatusMessage(
            data.hasBirthProfile
              ? "Your chart is on file. Let us place you."
              : "Let us take your birth details first.",
          );
        }
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
  }, [flashDraftMessage]);

  /* ── Steps ─────────────────────────────────────────────────────────────── */

  const steps = useMemo<StepMeta[]>(() => {
    const order: StepId[] = hasBirthProfile
      ? ["make", "work", "hd", "stop", "collective", "schedule"]
      : ["birth", "verify", "make", "work", "hd", "stop", "collective", "schedule"];
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

  // Announce each new step. Adjusting state during render when an input
  // changes is React's recommended alternative to a setState-in-effect.
  const stepLabel = phase === "ready" ? `${step.eyebrow}: ${step.title}` : null;
  const [announcedStep, setAnnouncedStep] = useState(stepLabel);
  if (stepLabel !== announcedStep) {
    setAnnouncedStep(stepLabel);
    if (stepLabel) setStatusMessage(stepLabel);
  }

  /* ── Validation ────────────────────────────────────────────────────────── */

  const validate = useCallback(
    (id: StepId): string | null => {
      switch (id) {
        case "birth":
          if (!birth.birthDate) return "Enter your date of birth.";
          if (!/^\d{2}:\d{2}:\d{2}$/.test(birth.birthTime))
            return "Enter your time of birth to the second (HH:MM:SS). KP charts are not cast without it.";
          if (!birth.birthTimeZone.trim()) return "Enter the time zone of your birthplace.";
          if (!birth.birthPlaceName?.trim())
            return "Add the nearest city, so the coordinates are checkable.";
          if (!Number.isFinite(birth.birthLatitude) || Math.abs(birth.birthLatitude) > 90)
            return "Latitude must be between -90 and 90.";
          if (!Number.isFinite(birth.birthLongitude) || Math.abs(birth.birthLongitude) > 180)
            return "Longitude must be between -180 and 180.";
          return null;
        case "verify":
          return verifiedBirth ? null : "Confirm the birth moment to continue.";
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
    [answers, birth, verifiedBirth],
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
      // A failed attempt is a request for help: reveal every inline message so
      // the person sees which field to fix, not merely that something is wrong.
      setTouched((current) => {
        const next = { ...current };
        for (const key of Object.keys(INLINE_RULES)) next[key] = true;
        return next;
      });
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
          birth: hasBirthProfile
            ? undefined
            : { ...birth, fold: verifiedBirth?.fold, nodeType: verifiedBirth?.nodeType },
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
      // The answers are now on the server; a local draft would only go stale.
      discardDraft();
    } catch {
      setPhase("ready");
      setFieldError("The connection dropped. Try once more.");
      setStatusMessage("The connection dropped.");
      play("error");
    }
  }, [answers, birth, discardDraft, hasBirthProfile, play, steps.length, validate, verifiedBirth]);

  /* ── Keyboard shortcuts ────────────────────────────────────────────────── */

  // Enter advances, Escape goes back, and ⌘S keeps a draft. The flow is a
  // sequence of short screens, so this is the difference between a mouse
  // journey and a keyboard one. Declared after its callbacks so nothing is
  // referenced before it exists.
  useEffect(() => {
    if (phase !== "ready") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDraft();
        return;
      }

      if (typing) return;

      if (event.key === "Enter" && !isReveal && event.target === panelRef.current) {
        event.preventDefault();
        goNext();
        return;
      }

      if (event.key === "Escape" && stepIndex > 0 && !isReveal) {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack, goNext, isReveal, phase, saveDraft, stepIndex]);

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
            <div className="flex flex-col gap-2">
              <Progress
                value={clampedIndex + 1}
                max={steps.length}
                label={`Step ${clampedIndex + 1} of ${steps.length}`}
                showValue
              />
              {/* The rail's compact form: the same logic, one line, and the
                  only progress cue a phone gets. */}
              <StepDots
                className="lg:hidden"
                steps={steps}
                currentIndex={clampedIndex}
                isReveal={isReveal}
              />
            </div>
          )}

          <div className="hidden lg:block">
            <StepProgress
              steps={steps}
              currentIndex={clampedIndex}
              isReveal={isReveal}
              reveal={STEP_META.reveal}
            />
          </div>

          <ShortcutHints className="lg:mt-2" />
        </aside>

        {/* ── Panel ──────────────────────────────────────────────────────── */}
        <section className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
              {isReveal ? STEP_META.reveal.eyebrow : step.eyebrow}
            </p>

            {/* Keeping the draft is a first-class action, not a hidden one:
                six screens of answers are worth more than a reload. */}
            {!isReveal ? (
              <div className="flex shrink-0 items-center gap-2">
                <p
                  aria-live="polite"
                  className={cn(
                    "hidden font-mono text-[9px] uppercase tracking-[0.16em] sm:block",
                    draftMessage ? "text-muted" : "text-faint",
                  )}
                >
                  {draftMessage ??
                    (draftSavedAt
                      ? `Saved ${timeAgo(new Date(draftSavedAt))}`
                      : "")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveDraft}
                  disabled={phase !== "ready"}
                  aria-label="Save a draft on this device (⌘S)"
                  title="Save a draft on this device (⌘S)"
                >
                  <Save aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Save</span>
                </Button>
              </div>
            ) : null}
          </div>

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
                        inlineErrors={inlineErrors}
                        touched={touched}
                        validateField={validateField}
                        markTouched={markTouched}
                      />
                    )}

                    {step.id === "verify" && birthDraft(birth) ? (
                      <BirthVerification
                        key={JSON.stringify(birthDraft(birth))}
                        draft={birthDraft(birth) as BirthMomentDraft}
                        onChange={setVerifiedBirth}
                      />
                    ) : null}

                    {step.id === "make" && (
                      <Field
                        label="What you are here to make"
                        description="One or two sentences. The concrete version, not the impressive one."
                        required
                        error={touched.hereToMake ? inlineErrors.hereToMake : undefined}
                      >
                        <Textarea
                          value={answers.hereToMake}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAnswers((current) => ({
                              ...current,
                              hereToMake: value,
                            }));
                            validateField("hereToMake", value);
                          }}
                          onBlur={(event) => {
                            markTouched("hereToMake");
                            validateField("hereToMake", event.target.value);
                          }}
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
                        error={touched.stopDoing ? inlineErrors.stopDoing : undefined}
                      >
                        <Textarea
                          value={answers.stopDoing}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAnswers((current) => ({
                              ...current,
                              stopDoing: value,
                            }));
                            validateField("stopDoing", value);
                          }}
                          onBlur={(event) => {
                            markTouched("stopDoing");
                            validateField("stopDoing", event.target.value);
                          }}
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
                          error={touched.timezone ? inlineErrors.timezone : undefined}
                        >
                          <Input
                            value={answers.timezone}
                            onChange={(event) => {
                              const value = event.target.value;
                              setAnswers((current) => ({
                                ...current,
                                timezone: value,
                              }));
                              validateField("timezone", value);
                            }}
                            onBlur={(event) => {
                              markTouched("timezone");
                              validateField("timezone", event.target.value);
                            }}
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

/** The entered birth moment for verification, or `null` while incomplete. */
function birthDraft(birth: BirthFields): BirthMomentDraft | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth.birthDate);
  const time = /^(\d{2}):(\d{2}):(\d{2})$/.exec(birth.birthTime);
  if (!date || !time || !birth.birthTimeZone.trim()) return null;
  return {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2]),
    second: Number(time[3]),
    timeZone: birth.birthTimeZone.trim(),
    latitude: birth.birthLatitude,
    longitude: birth.birthLongitude,
    placeName: birth.birthPlaceName ?? undefined,
  };
}

function BirthStep({
  birth,
  onChange,
  firstFieldRef,
  inlineErrors,
  touched,
  validateField,
  markTouched,
}: {
  birth: BirthFields;
  onChange: (next: BirthFields) => void;
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
  inlineErrors: Record<string, string>;
  touched: Record<string, boolean>;
  validateField: (name: string, value: string) => void;
  markTouched: (name: string) => void;
}) {
  const placeId = useId();

  /** Only surface an error once the field has been left. */
  const errorFor = (name: string) => (touched[name] ? inlineErrors[name] : undefined);

  // The coordinates are edited as text. A number input bound to the stored
  // value turns a cleared field into 0 — the equator — so the text is kept
  // local and only a parseable entry is committed. That keeps "empty, not yet
  // filled" distinguishable from "0°", which matters: 0,0 is a real place.
  const [latitudeText, setLatitudeText] = useState(() => String(birth.birthLatitude));
  const [longitudeText, setLongitudeText] = useState(() => String(birth.birthLongitude));

  // Adopt coordinates chosen with the place picker. This is React's documented
  // "adjust state when a prop changes" pattern rather than an effect: it runs
  // during render, only when the stored value actually changed, and it leaves
  // half-typed text alone when the text already parses to the new value.
  const [syncedLatitude, setSyncedLatitude] = useState(birth.birthLatitude);
  if (birth.birthLatitude !== syncedLatitude) {
    setSyncedLatitude(birth.birthLatitude);
    const parsed = Number(latitudeText);
    if (!Number.isFinite(parsed) || Math.abs(parsed - birth.birthLatitude) > 1e-9) {
      setLatitudeText(String(birth.birthLatitude));
    }
  }

  const [syncedLongitude, setSyncedLongitude] = useState(birth.birthLongitude);
  if (birth.birthLongitude !== syncedLongitude) {
    setSyncedLongitude(birth.birthLongitude);
    const parsed = Number(longitudeText);
    if (!Number.isFinite(parsed) || Math.abs(parsed - birth.birthLongitude) > 1e-9) {
      setLongitudeText(String(birth.birthLongitude));
    }
  }

  /** Commit a typed coordinate, ignoring text that is not a number yet. */
  const commitCoordinate = (
    key: "birthLatitude" | "birthLongitude",
    text: string,
  ) => {
    validateField(key, text);
    if (text.trim() === "") return;
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;
    if (key === "birthLatitude" && Math.abs(parsed) > 90) return;
    if (key === "birthLongitude" && Math.abs(parsed) > 180) return;
    onChange({ ...birth, [key]: parsed });
  };

  /** Fill the whole place from a picked suggestion. */
  const pickPlace = (place: PlaceSuggestion) => {
    onChange({
      ...birth,
      birthPlaceName: place.displayName,
      birthLatitude: place.latitude,
      birthLongitude: place.longitude,
      // A resolved zone is a real answer; an unresolved one leaves whatever the
      // person already typed rather than guessing from the country.
      birthTimeZone: place.timeZone ?? birth.birthTimeZone,
    });
    markTouched("birthPlaceName");
    validateField("birthPlaceName", place.displayName);
    setLatitudeText(String(place.latitude));
    setLongitudeText(String(place.longitude));
    if (place.timeZone) validateField("birthTimeZone", place.timeZone);
  };

  const placeErrorId = `${placeId}-error`;
  const placeHelpId = `${placeId}-help`;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field
        label="Date of birth"
        required
        error={errorFor("birthDate")}
      >
        <Input
          ref={firstFieldRef}
          type="date"
          value={birth.birthDate}
          max="2100-12-31"
          onChange={(event) => {
            onChange({ ...birth, birthDate: event.target.value });
            validateField("birthDate", event.target.value);
          }}
          onBlur={(event) => { markTouched("birthDate"); validateField("birthDate", event.target.value); }}
        />
      </Field>

      <Field
        label="Time of birth, to the second"
        description="From the birth record. If it gives only minutes, use :00 seconds."
        required
        error={errorFor("birthTime")}
      >
        <Input
          type="time"
          step={1}
          value={birth.birthTime}
          onChange={(event) => {
            onChange({ ...birth, birthTime: event.target.value });
            validateField("birthTime", event.target.value);
          }}
          onBlur={(event) => { markTouched("birthTime"); validateField("birthTime", event.target.value); }}
        />
      </Field>

      {/* The place picker is not wrapped in `Field`: its control is nested in a
          combobox wrapper, which `Field`'s id injection cannot reach, so the
          label is wired by hand. */}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={placeId} required>
          Birthplace
        </Label>
        <PlaceAutocomplete
          inputId={placeId}
          value={birth.birthPlaceName ?? ""}
          onValueChange={(next) => {
            onChange({ ...birth, birthPlaceName: next });
            validateField("birthPlaceName", next);
          }}
          onPlacePicked={pickPlace}
          invalid={Boolean(errorFor("birthPlaceName"))}
          describedBy={errorFor("birthPlaceName") ? placeErrorId : placeHelpId}
        />
        {errorFor("birthPlaceName") ? (
          <p id={placeErrorId} role="alert" className="text-xs leading-relaxed text-danger">
            {errorFor("birthPlaceName")}
          </p>
        ) : (
          <p id={placeHelpId} className="text-xs leading-relaxed text-faint">
            Search for the nearest town. Choosing it fills the coordinates and,
            when the service can resolve one, the time zone below.
          </p>
        )}
      </div>

      <Field
        label="Time zone at birth"
        description="IANA name, including historical DST."
        required
        error={errorFor("birthTimeZone")}
      >
        <Input
          value={birth.birthTimeZone}
          onChange={(event) => {
            onChange({ ...birth, birthTimeZone: event.target.value });
            validateField("birthTimeZone", event.target.value);
          }}
          onBlur={(event) => { markTouched("birthTimeZone"); validateField("birthTimeZone", event.target.value); }}
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

      <Field
        label="Latitude"
        description="Decimal degrees, negative for south."
        required
        error={errorFor("birthLatitude")}
      >
        <Input
          type="text"
          inputMode="decimal"
          value={latitudeText}
          onChange={(event) => {
            setLatitudeText(event.target.value);
            commitCoordinate("birthLatitude", event.target.value);
          }}
          onBlur={(event) => { markTouched("birthLatitude"); validateField("birthLatitude", event.target.value); }}
          placeholder="51.5074"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label="Longitude"
        description="Decimal degrees, negative for west."
        required
        error={errorFor("birthLongitude")}
      >
        <Input
          type="text"
          inputMode="decimal"
          value={longitudeText}
          onChange={(event) => {
            setLongitudeText(event.target.value);
            commitCoordinate("birthLongitude", event.target.value);
          }}
          onBlur={(event) => { markTouched("birthLongitude"); validateField("birthLongitude", event.target.value); }}
          placeholder="-0.1276"
          autoComplete="off"
          spellCheck={false}
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
