"use client";

/**
 * `/membership/apply` — the application entry point.
 *
 * The form is deliberately short: it asks what a person makes and why they want
 * in, because those are the two answers a human reviewer actually uses. Every
 * application is read by a person, so the copy does not promise instant access.
 *
 * The request body carries the answers both nested under `answers` (the shape
 * the store's `CreateApplicationInput` expects) and flattened at the top level,
 * because the applications endpoint is a separate surface with its own schema.
 * Sending both makes the form robust to either contract without a second round
 * trip; unknown keys are ignored by a conventional object schema.
 */

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, RadioGroup, Radio, Textarea } from "@/components/ui";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";

const EXPERIENCE_LEVELS = [
  {
    value: "none",
    label: "Completely new",
    description: "I have never had a reading and I am starting from zero.",
  },
  {
    value: "beginner",
    label: "Beginner",
    description: "I know my type and I am still learning the centres.",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "I read my own chart and I am working through the gates.",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "I read other people's charts and want the deeper material.",
  },
  {
    value: "professional",
    label: "Professional",
    description: "This is part of my practice or my work.",
  },
] as const;

const TIER_CHOICES = [
  {
    value: "initiate",
    label: "Initiate — $15/month",
    description: "The rooms, the course library, the weekly call, unlimited flashcards.",
  },
  {
    value: "adept",
    label: "Adept — $29/month",
    description: "Everything in Initiate plus recordings, comparison and transits.",
  },
  {
    value: "oracle",
    label: "Oracle — $59/month",
    description: "Everything in Adept plus the monthly circle and a direct line.",
  },
] as const;

type ExperienceValue = (typeof EXPERIENCE_LEVELS)[number]["value"];
type TierValue = (typeof TIER_CHOICES)[number]["value"];

const applicationSchema = z.object({
  why: z
    .string()
    .trim()
    .min(20, "A couple of real sentences, please — at least twenty characters.")
    .max(2000, "Please keep this under 2000 characters."),
  whatYouMake: z
    .string()
    .trim()
    .min(2, "Tell us what you make, build or do.")
    .max(400, "Please keep this under 400 characters."),
  experienceLevel: z.string().min(1, "Choose an experience level."),
  referral: z
    .string()
    .trim()
    .max(200, "Please keep this under 200 characters.")
    .optional(),
  tier: z.enum(["initiate", "adept", "oracle"]),
});

type FormErrors = Partial<Record<keyof z.infer<typeof applicationSchema>, string>>;

interface ApplicationApiResponse {
  ok?: boolean;
  error?: string;
}

/**
 * The membership application form.
 *
 * Validation happens locally with the same `zod` used elsewhere in the app, so
 * a person sees the problem before a round trip; the server remains the
 * authority on whether the application is accepted.
 */
export default function ApplyPage() {
  const reduced = useReducedMotion();
  const { play } = useSound();

  const [why, setWhy] = useState("");
  const [whatYouMake, setWhatYouMake] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceValue | "">("");
  const [referral, setReferral] = useState("");
  const [tier, setTier] = useState<TierValue>("initiate");

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    const parsed = applicationSchema.safeParse({
      why,
      whatYouMake,
      experienceLevel,
      referral: referral.trim() || undefined,
      tier,
    });

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in nextErrors)) {
          nextErrors[key as keyof FormErrors] = issue.message;
        }
      }
      setErrors(nextErrors);
      setSubmitError("Please fix the highlighted fields and send it again.");
      play("error");
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    play("confirm");

    const answers = {
      why: parsed.data.why,
      whatYouMake: parsed.data.whatYouMake,
      experienceLevel: parsed.data.experienceLevel,
      referral: parsed.data.referral ?? null,
      tier: parsed.data.tier,
    };

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, answers }),
      });
      const data = (await response.json().catch(() => ({}))) as ApplicationApiResponse;
      if (!response.ok || data.ok === false) {
        setSubmitError(
          data.error ??
            "We could not record that application. Try again in a moment.",
        );
        setSubmitting(false);
        play("error");
        return;
      }
      setSubmitting(false);
      setSubmitted(true);
      play("success");
    } catch {
      setSubmitError(
        "We could not reach the server. Check your connection and try again.",
      );
      setSubmitting(false);
      play("error");
    }
  }

  return (
    <>
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
          {submitted ? (
            <motion.section
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              aria-labelledby="apply-done-title"
              className="surface flex flex-col items-start gap-5 rounded-xl p-8 sm:p-10"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-full border border-ok/40 bg-ok/10 text-ok"
              >
                <Check className="h-5 w-5" strokeWidth={2} />
              </span>
              <h1
                id="apply-done-title"
                className="font-display text-2xl leading-tight text-bone sm:text-3xl"
              >
                Your application is in.
              </h1>
              <p className="max-w-xl text-pretty leading-relaxed text-muted">
                A person reads every application, usually within two days. You
                will hear back either way, and a no is never permanent. Nothing
                has been charged and nothing will be until you are accepted and
                choose to subscribe.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary">
                  <Link href="/enter">
                    Compute a reading while you wait
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/collective">See the collective</Link>
                </Button>
              </div>
            </motion.section>
          ) : (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <header className="flex flex-col gap-4 border-b border-hairline pb-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
                  Application
                </p>
                <h1 className="font-display text-3xl leading-tight text-bone text-balance sm:text-4xl">
                  Tell us what you make.
                </h1>
                <p className="max-w-2xl text-pretty leading-relaxed text-muted">
                  Five answers. It takes two minutes, it costs nothing, and it is
                  read by a person rather than scored by a form. The free tier
                  needs no application at all — this is for the rooms, the calls
                  and the circles.
                </p>
              </header>

              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
                className="mt-10 flex flex-col gap-8"
              >
                <Field
                  label="Why do you want in?"
                  description="What you are looking for, and what you would bring to a room."
                  error={errors.why}
                  required
                >
                  <Textarea
                    value={why}
                    onChange={(event) => setWhy(event.target.value)}
                    rows={5}
                    placeholder="I have been studying alone and I want the mirror of a group that actually runs the experiment."
                  />
                </Field>

                <Field
                  label="What do you make?"
                  description="A craft, a practice, a business, a body of work — whatever is true."
                  error={errors.whatYouMake}
                  required
                >
                  <Input
                    value={whatYouMake}
                    onChange={(event) => setWhatYouMake(event.target.value)}
                    placeholder="Sound design for documentary film"
                    autoComplete="off"
                  />
                </Field>

                <RadioGroup
                  label="Your experience with Human Design"
                  description="There is no wrong answer here, and none of the tiers require prior study."
                >
                  {EXPERIENCE_LEVELS.map((level) => (
                    <Radio
                      key={level.value}
                      name="experienceLevel"
                      value={level.value}
                      checked={experienceLevel === level.value}
                      onChange={() => {
                        setExperienceLevel(level.value);
                        play("select");
                      }}
                      label={level.label}
                      description={level.description}
                    />
                  ))}
                </RadioGroup>
                {errors.experienceLevel ? (
                  <p role="alert" className="-mt-4 text-xs leading-relaxed text-danger">
                    {errors.experienceLevel}
                  </p>
                ) : null}

                <Field
                  label="How did you find The Cipher?"
                  description="Optional — a person, a post, a search. It helps us know what is working."
                  error={errors.referral}
                >
                  <Input
                    value={referral}
                    onChange={(event) => setReferral(event.target.value)}
                    placeholder="A friend sent me a reading"
                    autoComplete="off"
                  />
                </Field>

                <RadioGroup
                  label="Which tier are you applying for?"
                  description="Threshold is free and needs no application. You can change tier later."
                >
                  {TIER_CHOICES.map((choice) => (
                    <Radio
                      key={choice.value}
                      name="tier"
                      value={choice.value}
                      checked={tier === choice.value}
                      onChange={() => {
                        setTier(choice.value);
                        play("select");
                      }}
                      label={choice.label}
                      description={choice.description}
                    />
                  ))}
                </RadioGroup>

                {submitError ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm leading-relaxed text-danger"
                  >
                    <TriangleAlert
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    {submitError}
                  </p>
                ) : null}

                <p aria-live="polite" className="sr-only">
                  {submitting ? "Sending your application." : ""}
                </p>

                <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-8">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    iconRight={
                      submitting ? undefined : (
                        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                      )
                    }
                  >
                    Send application
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <Link href="/membership">Back to membership</Link>
                  </Button>
                  <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em] text-faint")}>
                    Nothing is charged now
                  </span>
                </div>
              </form>
            </motion.div>
          )}

          <footer className="mt-16 border-t border-hairline pt-6">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { href: "/", label: "Threshold" },
                { href: "/method", label: "Method" },
                { href: "/collective", label: "Collective" },
                { href: "/membership", label: "Membership" },
                { href: "/enter", label: "Enter your coordinates" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </footer>
        </div>
      </main>
    </>
  );
}
