"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleCheck,
  Clock,
  Info,
  Lock,
  CircleAlert,
} from "lucide-react";
import { COURSES, type ContentBlock } from "@/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { Spinner } from "@/components/ui/spinner";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";

/**
 * The course player.
 *
 * Renders one lesson at a time from the content library, maps every
 * `ContentBlock` variant to a component, persists completion through the
 * progress API, and keeps the module/lesson navigation one click away.
 *
 * The quiz is the only genuinely stateful block; it is keyboard operable
 * (arrow keys move between options, 1–4 select, Enter checks) and announces
 * the result through a live region.
 */

interface ProgressEntry {
  lessonSlug: string;
  lessonKey: string;
  status: string;
  progressPct: number;
  completedAt: string | null;
}

interface ProgressPayload {
  ok: boolean;
  error?: string;
  course?: { slug: string; title: string; tier: string; lessonKeys: Record<string, string> };
  tier?: string;
  locked?: boolean;
  progress?: ProgressEntry[];
}

/* ---------------------------------------------------------------------------
 * Blocks
 * ------------------------------------------------------------------------- */

/** Render a `prose` block as headed paragraphs. */
function ProseBlock({ block }: { block: Extract<ContentBlock, { type: "prose" }> }) {
  const paragraphs = block.body.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-4">
      {block.heading ? (
        <h3 className="font-display text-xl text-bone">{block.heading}</h3>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed text-muted">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

const CALLOUT_STYLE: Readonly<Record<"note" | "warning" | "key", string>> = {
  note: "border-info/40 bg-info/5",
  warning: "border-warn/40 bg-warn/5",
  key: "border-gold/50 bg-gold/5",
};

const CALLOUT_LABEL: Readonly<Record<"note" | "warning" | "key", string>> = {
  note: "Note",
  warning: "Careful",
  key: "Key idea",
};

/** Render a `callout` block with a tone-dependent frame. */
function CalloutBlock({ block }: { block: Extract<ContentBlock, { type: "callout" }> }) {
  return (
    <aside className={cn("rounded-lg border p-4", CALLOUT_STYLE[block.tone])}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
        {CALLOUT_LABEL[block.tone]}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-bone">{block.body}</p>
    </aside>
  );
}

/** Render a `list` block. */
function ListBlock({ block }: { block: Extract<ContentBlock, { type: "list" }> }) {
  return (
    <div className="flex flex-col gap-3">
      {block.heading ? (
        <h3 className="font-display text-xl text-bone">{block.heading}</h3>
      ) : null}
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Render a `practice` block as a numbered exercise. */
function PracticeBlock({ block }: { block: Extract<ContentBlock, { type: "practice" }> }) {
  return (
    <section
      aria-label={`Practice: ${block.title}`}
      className="surface rounded-lg border-gold/30 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg text-bone">{block.title}</h3>
        <Badge tone="gold" size="sm">
          <Clock aria-hidden="true" className="mr-1 h-3 w-3" />
          {block.minutes} min
        </Badge>
      </div>
      <ol className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {block.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[10px] text-gold"
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The interactive `check` block.
 *
 * @param props.block - The quiz block.
 */
function CheckBlock({ block }: { block: Extract<ContentBlock, { type: "check" }> }) {
  const { play } = useSound();
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = choice !== null && choice === block.answerIndex;

  const check = () => {
    if (choice === null) return;
    setSubmitted(true);
    play(correct ? "success" : "error");
  };

  return (
    <section
      aria-label="Check your understanding"
      className="surface rounded-lg p-5"
      onKeyDown={(event) => {
        // Number keys pick an option; Enter checks the answer.
        const numeric = Number.parseInt(event.key, 10);
        if (Number.isInteger(numeric) && numeric >= 1 && numeric <= block.options.length) {
          setChoice(numeric - 1);
          setSubmitted(false);
          play("select");
        }
        if (event.key === "Enter" && choice !== null && !submitted) {
          event.preventDefault();
          check();
        }
      }}
    >
      <Badge tone="info" size="sm">
        Check
      </Badge>
      <h3 className="mt-3 font-display text-lg text-bone">{block.question}</h3>

      <RadioGroup className="mt-4" label="Choose one">
        {block.options.map((option, index) => (
          <Radio
            key={option}
            name={`check-${block.question.slice(0, 12)}`}
            value={String(index)}
            checked={choice === index}
            onChange={() => {
              setChoice(index);
              setSubmitted(false);
              play("select");
            }}
            label={
              <span>
                <span className="mr-2 font-mono text-[10px] text-faint">{index + 1}</span>
                {option}
              </span>
            }
          />
        ))}
      </RadioGroup>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={check}
          disabled={choice === null || submitted}
        >
          Check answer
        </Button>
        <span aria-live="polite" className="text-sm">
          {submitted ? (
            <span className={correct ? "text-ok" : "text-danger"}>
              {correct ? "Correct." : "Not quite."}
            </span>
          ) : (
            <span className="text-faint">Press 1–{block.options.length} to choose.</span>
          )}
        </span>
      </div>

      {submitted ? (
        <div
          className={cn(
            "mt-4 rounded-md border p-4",
            correct ? "border-ok/40 bg-ok/5" : "border-warn/40 bg-warn/5",
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            {correct ? "Why that is right" : `The answer is option ${block.answerIndex + 1}`}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{block.explanation}</p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Map one content block to its renderer.
 *
 * @param block - Any `ContentBlock` variant.
 */
function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "prose":
      return <ProseBlock block={block} />;
    case "callout":
      return <CalloutBlock block={block} />;
    case "list":
      return <ListBlock block={block} />;
    case "practice":
      return <PracticeBlock block={block} />;
    case "check":
      return <CheckBlock block={block} />;
  }
}

/* ---------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */

/**
 * The lesson page.
 *
 * @returns The lesson player for one lesson.
 */
export default function LessonPage() {
  const params = useParams<{ slug: string; lesson: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const lessonSlug = typeof params.lesson === "string" ? params.lesson : "";

  const { play } = useSound();
  const reduced = useReducedMotion();

  const course = useMemo(() => COURSES.find((entry) => entry.slug === slug) ?? null, [slug]);
  const lessons = useMemo(
    () => (course ? course.modules.flatMap((module) => module.lessons) : []),
    [course],
  );
  const index = lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  const lesson = index >= 0 ? lessons[index] : null;
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  const [data, setData] = useState<ProgressPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const response = await fetch(`/api/courses/${slug}/progress`, { cache: "no-store" });
      const payload = (await response.json()) as ProgressPayload;
      setData(payload);
      setStatus(payload.ok ? "ready" : "error");
    } catch {
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    setStatus("loading");
    void load();
  }, [load]);

  const lessonKey = data?.course?.lessonKeys?.[lessonSlug] ?? null;
  const entry = data?.progress?.find((row) => row.lessonSlug === lessonSlug) ?? null;
  const complete = entry?.status === "complete";
  const locked = data?.locked === true;

  const markComplete = async () => {
    if (!lessonKey || saving || locked) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/courses/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonKey, progressPct: 100 }),
      });
      const payload = (await response.json()) as { ok: boolean; progress?: ProgressEntry[]; error?: string };
      if (!response.ok || !payload.ok || !payload.progress) {
        setAnnouncement(payload.error ?? "Your progress was not saved.");
        play("error");
        return;
      }
      setData((current) => (current ? { ...current, progress: payload.progress } : current));
      setAnnouncement("Lesson marked complete.");
      play("success");
    } catch {
      setAnnouncement("Your progress was not saved.");
      play("error");
    } finally {
      setSaving(false);
    }
  };

  if (!course || !lesson) {
    return (
      <EmptyState
        icon={<CircleAlert className="h-5 w-5" />}
        title="Lesson not found"
        description="That lesson does not exist in this course. The catalogue has the current curriculum."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/courses">Back to courses</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 border-b border-hairline pb-6">
        <Link
          href="/dashboard/courses"
          className="inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted hover:text-gold"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          All courses
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              {course.title}
            </p>
            <h1 className="mt-2 font-display text-3xl text-bone">{lesson.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {lesson.summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              {course.tier}
            </Badge>
            <Badge tone="neutral" size="sm">
              <Clock aria-hidden="true" className="mr-1 h-3 w-3" />
              {lesson.minutes} min
            </Badge>
            {complete ? (
              <Badge tone="ok" size="sm">
                <CircleCheck aria-hidden="true" className="mr-1 h-3 w-3" />
                Complete
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Module / lesson navigation -------------------------------------- */}
        <nav aria-label="Course contents" className="surface h-fit rounded-lg p-4">
          {course.modules.map((module) => (
            <div key={module.slug} className="mb-4 last:mb-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                {module.title}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {module.lessons.map((item) => {
                  const active = item.slug === lessonSlug;
                  const done =
                    data?.progress?.find((row) => row.lessonSlug === item.slug)?.status ===
                    "complete";
                  return (
                    <li key={item.slug}>
                      <Link
                        href={`/dashboard/courses/${course.slug}/${item.slug}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                          active
                            ? "bg-raised text-gold"
                            : "text-muted hover:bg-raised hover:text-bone",
                        )}
                      >
                        <span className="min-w-0 truncate">{item.title}</span>
                        {done ? (
                          <CircleCheck
                            aria-label="Completed"
                            className="h-3.5 w-3.5 shrink-0 text-ok"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Lesson body ------------------------------------------------------ */}
        <article className="flex flex-col gap-8" aria-busy={status === "loading"}>
          {status === "loading" ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted">
              <Spinner size="sm" label="Loading lesson state" /> Loading your progress…
            </div>
          ) : null}

          {locked ? (
            <div className="rounded-lg border border-warn/40 bg-warn/5 p-5">
              <p className="flex items-center gap-2 font-display text-lg text-bone">
                <Lock aria-hidden="true" className="h-4 w-4" />
                This course unlocks at {course.tier}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                You are on the {data?.tier ?? "free"} tier. The lesson text is held
                back until the course is in your tier; the outcomes are listed on the
                catalogue.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href="/dashboard/courses">Back to the catalogue</Link>
              </Button>
            </div>
          ) : (
            <>
              {status === "error" ? (
                <p className="flex items-center gap-2 text-sm text-warn">
                  <Info aria-hidden="true" className="h-4 w-4" />
                  Progress could not be loaded. You can still read the lesson; marking
                  complete may not persist.
                </p>
              ) : null}

              <div className="flex flex-col gap-8">
                {lesson.blocks.map((block, blockIndex) => (
                  <motion.div
                    key={`${lesson.slug}-${blockIndex}`}
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduced ? 0 : 0.4,
                      delay: reduced ? 0 : Math.min(blockIndex * 0.04, 0.2),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Block block={block} />
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
                <div>
                  {complete ? (
                    <p className="flex items-center gap-2 text-sm text-ok">
                      <CircleCheck aria-hidden="true" className="h-4 w-4" />
                      Completed
                      {entry?.completedAt
                        ? ` ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(entry.completedAt))}`
                        : ""}
                    </p>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void markComplete()}
                      loading={saving}
                      disabled={!lessonKey}
                    >
                      <BookOpen aria-hidden="true" className="h-4 w-4" />
                      Mark complete
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {previous ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/dashboard/courses/${course.slug}/${previous.slug}`}>
                        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                        Previous
                      </Link>
                    </Button>
                  ) : null}
                  {next ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/dashboard/courses/${course.slug}/${next.slug}`}>
                        Next
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/courses">Finish course</Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          <p
            aria-live="polite"
            className="min-h-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
          >
            {announcement}
          </p>
        </article>
      </div>
    </div>
  );
}
