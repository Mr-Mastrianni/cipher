"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  BookOpen,
  CircleCheck,
  Layers,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useSound } from "@/components/providers/sound-provider";
import {
  GRADE_LABELS,
  fromStoredReview,
  previewGrades,
  type CardState,
  type Grade,
} from "@/lib/srs/scheduler";
import { cn } from "@/lib/utils";

/**
 * Flashcards.
 *
 * The deck list and the study session in one surface. Grading calls
 * `POST /api/flashcards/[deck]/review`, which persists the FSRS-6 memory state
 * through `store.upsertFlashcardReview`; the queue comes from
 * `GET /api/flashcards/[deck]/review`, which reads `store.getDueFlashcards`.
 *
 * Keyboard-first: Space flips the card, 1–4 grade it, Escape leaves the
 * session. Every state change is announced through a live region, and the
 * card's interval previews are computed client-side with the same scheduler the
 * server uses, so the button captions cannot drift from what is saved.
 */

interface DeckSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tierRequired: string;
  cardCount: number;
  dueCount: number;
  locked: boolean;
}

interface StoredReview {
  state: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: string | null;
}

interface QueueItem {
  card: { id: string; front: string; back: string; tags: string[] };
  review: StoredReview | null;
}

interface QueuePayload {
  ok: boolean;
  error?: string;
  decks?: DeckSummary[];
  deck?: { id: string; slug: string; title: string; tierRequired: string };
  queue?: QueueItem[];
}

interface GradedRow {
  cardId: string;
  grade: Grade;
  intervalDays: number;
}

/** The four grade buttons, in keyboard order. */
const GRADES: readonly Grade[] = [1, 2, 3, 4];

const GRADE_STYLE: Readonly<Record<Grade, string>> = {
  1: "border-danger/50 text-danger hover:bg-danger/10",
  2: "border-warn/50 text-warn hover:bg-warn/10",
  3: "border-ok/50 text-ok hover:bg-ok/10",
  4: "border-gold/50 text-gold hover:bg-gold/10",
};

/** Convert the wire review shape into the scheduler's memory state. */
function toMemoryState(review: StoredReview | null) {
  if (!review) return fromStoredReview(null);
  return fromStoredReview({
    state: review.state as CardState,
    due: new Date(review.due),
    stability: review.stability,
    difficulty: review.difficulty,
    elapsedDays: review.elapsedDays,
    scheduledDays: review.scheduledDays,
    reps: review.reps,
    lapses: review.lapses,
    lastReview: review.lastReview ? new Date(review.lastReview) : null,
  });
}

/**
 * The flashcards page.
 *
 * @returns The deck list, or the active study session and its summary.
 */
/** Fetch the deck list; resolves to the decks or an error message, never throws. */
async function fetchOverview(): Promise<{ decks: DeckSummary[] } | { error: string }> {
  try {
    const response = await fetch("/api/flashcards/all/review?limit=100", {
      cache: "no-store",
    });
    const payload = (await response.json()) as QueuePayload;
    if (!response.ok || !payload.ok) {
      return { error: payload.error ?? "Decks could not be loaded." };
    }
    return { decks: payload.decks ?? [] };
  } catch {
    return { error: "Decks could not be loaded." };
  }
}

export default function FlashcardsPage() {
  const { play } = useSound();
  const reduced = useReducedMotion();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deckSlug, setDeckSlug] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [graded, setGraded] = useState<GradedRow[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const activeCard = queue[position] ?? null;

  /* ── Load the deck list and the "all due" queue ────────────────────────── */

  const applyOverview = useCallback(
    (result: Awaited<ReturnType<typeof fetchOverview>>) => {
      if ("error" in result) setError(result.error);
      else setDecks(result.decks);
      setLoading(false);
    },
    [],
  );

  // `loading` starts true; callers that reload set it themselves.
  const loadOverview = useCallback(
    () => fetchOverview().then(applyOverview),
    [applyOverview],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchOverview().then((result) => {
      if (!cancelled) applyOverview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyOverview]);

  /* ── Start a session on a specific deck ────────────────────────────────── */

  const startDeck = async (slug: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/flashcards/${slug}/review?limit=100`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as QueuePayload;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "That deck could not be opened.");
        play("error");
        return;
      }
      setDecks(payload.decks ?? decks);
      setDeckSlug(slug);
      setQueue(payload.queue ?? []);
      setPosition(0);
      setFlipped(false);
      setGraded([]);
      setAnnouncement(
        (payload.queue?.length ?? 0) > 0
          ? `${payload.queue?.length ?? 0} cards due. Space to reveal, 1 to 4 to grade.`
          : "Nothing is due in this deck.",
      );
      play("advance");
    } catch {
      setError("That deck could not be opened.");
      play("error");
    } finally {
      setBusy(false);
    }
  };

  const exitSession = useCallback(() => {
    setDeckSlug(null);
    setQueue([]);
    setPosition(0);
    setFlipped(false);
    setGraded([]);
    setError(null);
    setAnnouncement("Session closed.");
    play("tick");
    setLoading(true);
    void loadOverview();
  }, [loadOverview, play]);

  const flip = useCallback(() => {
    setFlipped((current) => {
      const nextValue = !current;
      setAnnouncement(nextValue ? "Answer revealed." : "Question shown.");
      play("reveal");
      return nextValue;
    });
  }, [play]);

  const grade = useCallback(
    async (value: Grade) => {
      if (!activeCard || !deckSlug || busy || !flipped) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/flashcards/${deckSlug}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: activeCard.card.id, grade: value }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          intervalDays?: number;
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          setError(payload.error ?? "That review was not saved.");
          play("error");
          return;
        }
        const intervalDays = payload.intervalDays ?? 1;
        setGraded((rows) => [...rows, { cardId: activeCard.card.id, grade: value, intervalDays }]);
        setPosition((current) => current + 1);
        setFlipped(false);
        setAnnouncement(
          `${GRADE_LABELS[value]} — next review in ${intervalDays === 1 ? "1 day" : `${intervalDays} days`}.`,
        );
        play(value === 1 ? "error" : "confirm");
      } catch {
        setError("That review was not saved.");
        play("error");
      } finally {
        setBusy(false);
      }
    },
    [activeCard, busy, deckSlug, flipped, play],
  );

  /* ── Keyboard ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (deckSlug === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never hijack keys while the member is typing in a control.
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      // A focused button already handles Space natively; handling it here too
      // would flip the card twice.
      const focusedButton = target?.tagName === "BUTTON";

      if (event.key === "Escape") {
        event.preventDefault();
        exitSession();
        return;
      }
      if (event.code === "Space" || event.key === " ") {
        if (focusedButton) return;
        event.preventDefault();
        if (!activeCard) return;
        flip();
        return;
      }
      const numeric = Number.parseInt(event.key, 10);
      if (numeric >= 1 && numeric <= 4) {
        event.preventDefault();
        void grade(numeric as Grade);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCard, deckSlug, exitSession, flip, grade]);

  /* ── Derived ───────────────────────────────────────────────────────────── */

  const previews = useMemo(() => {
    if (!activeCard) return null;
    return previewGrades(toMemoryState(activeCard.review), new Date()).map((preview) => ({
      ...preview,
      label: GRADE_LABELS[preview.grade],
    }));
  }, [activeCard]);

  const total = graded.length;
  const recalled = graded.filter((row) => row.grade >= 2).length;
  const accuracy = total === 0 ? 0 : Math.round((recalled / total) * 100);
  const averageInterval =
    total === 0
      ? 0
      : graded.reduce((sum, row) => sum + row.intervalDays, 0) / total;
  const finished = deckSlug !== null && queue.length > 0 && position >= queue.length;
  const emptyDeck = deckSlug !== null && queue.length === 0;

  const dueAcrossDecks = decks.reduce((sum, deck) => sum + deck.dueCount, 0);

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted">
        <Spinner size="sm" label="Loading decks" /> Loading the decks…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-6">
        <div>
          <h1 className="font-display text-3xl text-bone">Flashcards</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Spaced repetition on the FSRS-6 scheduler. Space reveals, 1–4 grades,
            Escape leaves the session. Nothing is scheduled by streak — only by
            your own recall.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={dueAcrossDecks > 0 ? "gold" : "ok"} size="sm">
            {dueAcrossDecks} due
          </Badge>
          {deckSlug !== null ? (
            <Button variant="ghost" size="sm" onClick={exitSession}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Exit session
            </Button>
          ) : null}
        </div>
      </header>

      <p aria-live="polite" className="min-h-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {announcement}
        {error ? ` · ${error}` : ""}
      </p>

      {/* Deck list ---------------------------------------------------------- */}
      {deckSlug === null ? (
        decks.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No decks yet"
            description="Decks appear here once the first one is published."
          />
        ) : (
          <section aria-labelledby="decks-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="decks-heading" className="font-display text-2xl text-bone">
                Decks
              </h2>
              {dueAcrossDecks > 0 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void startDeck("all")}
                  loading={busy}
                >
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  Study all {dueAcrossDecks} due
                </Button>
              ) : null}
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {decks.map((deck) => (
                <li key={deck.id} className="surface flex flex-col gap-3 rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg text-bone">{deck.title}</p>
                      {deck.description ? (
                        <p className="mt-1 text-sm text-muted">{deck.description}</p>
                      ) : null}
                    </div>
                    <Badge tone={deck.tierRequired === "free" ? "ok" : "teal"} size="sm">
                      {deck.tierRequired}
                    </Badge>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {deck.cardCount} cards · {deck.dueCount} due
                  </p>
                  {deck.locked ? (
                    <Badge tone="warn" size="sm">
                      Unlocks at {deck.tierRequired}
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-fit"
                      onClick={() => void startDeck(deck.slug)}
                      loading={busy}
                      disabled={deck.dueCount === 0}
                    >
                      {deck.dueCount === 0 ? "Nothing due" : `Study ${deck.dueCount}`}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      ) : null}

      {/* Empty session ------------------------------------------------------ */}
      {emptyDeck ? (
        <EmptyState
          icon={<CircleCheck className="h-5 w-5" />}
          title="Nothing is due"
          description="The scheduler has nothing for you right now. Come back when a card matures."
          action={
            <Button variant="secondary" size="sm" onClick={exitSession}>
              Back to decks
            </Button>
          }
        />
      ) : null}

      {/* Study session ------------------------------------------------------ */}
      {deckSlug !== null && activeCard && !finished ? (
        <section aria-labelledby="card-heading" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="card-heading" className="font-display text-xl text-bone">
              {decks.find((deck) => deck.slug === deckSlug)?.title ?? "Study session"}
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Card {position + 1} of {queue.length} · {recalled}/{total} recalled
            </p>
          </div>
          <Progress
            value={((position) / Math.max(queue.length, 1)) * 100}
            label={`Card ${position + 1} of ${queue.length}`}
          />

          <button
            type="button"
            onClick={flip}
            aria-label={flipped ? "Hide the answer" : "Reveal the answer"}
            className="surface min-h-[16rem] w-full rounded-xl border-gold/20 p-8 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={flipped ? "back" : "front"}
                initial={reduced ? false : { opacity: 0, y: flipped ? -10 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: flipped ? 10 : -10 }}
                transition={{ duration: reduced ? 0 : 0.28 }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
                  {flipped ? "Answer" : "Question"}
                </p>
                <p className="mt-4 whitespace-pre-wrap font-display text-2xl leading-snug text-bone">
                  {flipped ? activeCard.card.back : activeCard.card.front}
                </p>
                {activeCard.card.tags.length > 0 ? (
                  <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {activeCard.card.tags.join(" · ")}
                  </p>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </button>

          {flipped ? (
            <div
              className="grid gap-3 sm:grid-cols-4"
              role="group"
              aria-label="Grade your recall"
            >
              {GRADES.map((value) => {
                const preview = previews?.find((row) => row.grade === value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void grade(value)}
                    disabled={busy}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border bg-transparent px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50",
                      GRADE_STYLE[value],
                    )}
                  >
                    <span>
                      <span className="mr-2 opacity-60">{value}</span>
                      {GRADE_LABELS[value]}
                    </span>
                    <span className="text-[10px] tracking-[0.12em] text-faint">
                      {preview
                        ? preview.intervalDays === 1
                          ? "1 day"
                          : `${preview.intervalDays} days`
                        : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Press <kbd className="font-mono text-bone">Space</kbd> or click the card
              to reveal the answer. Grade honestly — the schedule is only as good as
              the grade.
            </p>
          )}
        </section>
      ) : null}

      {/* Summary ------------------------------------------------------------ */}
      {finished ? (
        <section aria-labelledby="summary-heading" className="surface rounded-xl p-6">
          <h2 id="summary-heading" className="font-display text-2xl text-bone">
            Session complete
          </h2>
          <p className="mt-2 text-sm text-muted">
            {total} {total === 1 ? "card" : "cards"} reviewed · {recalled} recalled ·{" "}
            {total - recalled} lapsed.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                Accuracy
              </p>
              <p className="mt-1 font-display text-3xl text-gold">{accuracy}%</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                Average next interval
              </p>
              <p className="mt-1 font-display text-3xl text-bone">
                {averageInterval.toFixed(1)}d
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                Breakdown
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                {GRADES.map((value) => (
                  <li key={value}>
                    {GRADE_LABELS[value]}:{" "}
                    <span className="text-bone">
                      {graded.filter((row) => row.grade === value).length}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" size="sm" onClick={exitSession}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Back to decks
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard">
                <BookOpen aria-hidden="true" className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
