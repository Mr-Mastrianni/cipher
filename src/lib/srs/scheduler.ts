/**
 * The Cipher — spaced-repetition scheduler.
 *
 * ## Why this file exists
 *
 * `ts-fsrs` is not a dependency of this project (installing one was outside the
 * brief), so the scheduling maths is implemented here directly from the FSRS-6
 * specification: <https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm>.
 * It is a faithful, self-contained transcription of the published formulas —
 * no proprietary behaviour, no network calls, and no hidden state.
 *
 * ## The model
 *
 * FSRS ("Free Spaced Repetition Scheduler") is a three-variable model of
 * memory. Every card carries:
 *
 * - **Stability `S`** — the number of days after which the probability of
 *   recall falls to 90%. Bigger is better; it grows with each successful review
 *   and shrinks (a "lapse") on `Again`.
 * - **Difficulty `D`** — a heuristic in `[1, 10]` describing how hard the item
 *   is *for this member*. It rises on `Again`/`Hard` and falls on `Easy`, with
 *   linear damping so it approaches the bounds asymptotically, and a mean
 *   reversion towards the `Easy` default so it cannot ratchet.
 * - **Retrievability `R`** — the predicted probability of recall right now. It
 *   is derived, never stored, from `S` and the elapsed time.
 *
 * The scheduler answers one question: given a card's current state and a grade,
 * what are its next state and due date? It is deliberately pure and synchronous
 * apart from `Date.now()` defaults, so it is trivial to test and to reason about.
 *
 * ## The formulas (FSRS-6, 21 parameters)
 *
 * With `w` the weight vector, `G ∈ {1,2,3,4}` = Again/Hard/Good/Easy, `t` the
 * elapsed days and `DECAY = −w₂₀`, `FACTOR = 0.9^(−1/w₂₀) − 1`:
 *
 * ```
 * R(t, S)          = (1 + FACTOR · t / S)^DECAY
 * I(r, S)          = (S / FACTOR) · (r^(−1/w₂₀) − 1)      // solve R = r for t
 * S₀(G)            = w[G−1]
 * D₀(G)            = w₄ − e^(w₅·(G−1)) + 1                  // clamped to [1, 10]
 * ΔD(G)            = −w₆·(G − 3)
 * D′               = D + ΔD·(10 − D)/9                      // linear damping
 * D″               = w₇·D₀(4) + (1 − w₇)·D′                 // mean reversion
 * S′_recall        = S · (1 + e^(w₈)·(11 − D)·S^(−w₉)
 *                        ·(e^(w₁₀·(1−R)) − 1)
 *                        ·hardPenalty·easyBonus)            // G ≥ 2
 * S′_forget        = w₁₁·D^(−w₁₂)·((S+1)^(w₁₃) − 1)·e^(w₁₄·(1−R))
 * S′_forget        = min(S′_forget, S)                      // never worse than before
 * S′_sameDay       = S · e^(w₁₇·(G−3+w₁₈)) · S^(−w₁₉)       // SInc ≥ 1 when G ≥ 2
 * ```
 *
 * `hardPenalty = w₁₅` for `Hard`, otherwise `1`; `easyBonus = w₁₆` for `Easy`,
 * otherwise `1`.
 *
 * ## Deliberate departures
 *
 * - **Day granularity.** The `flashcard_reviews` table stores whole
 *   `scheduled_days`, so intervals are rounded to a minimum of one day rather
 *   than the 10-minute learning steps a minute-precision client would use.
 * - **No fuzz by default.** Anki jitters intervals to avoid review pile-ups;
 *   that is available via `enableFuzz` but off by default so scheduling is
 *   deterministic and testable.
 * - **State names** use the values of the schema's `flashcard_state` enum
 *   (`new | learning | review | relearning`) rather than FSRS's integer states.
 */

/** A grade, matching the `ts-fsrs` `Rating` values stored in the review log. */
export type Grade = 1 | 2 | 3 | 4;

/** The lifecycle state of a card, matching the `flashcard_state` enum. */
export type CardState = "new" | "learning" | "review" | "relearning";

/** The memory state of one (member, card) pair. All dates are absolute. */
export interface MemoryState {
  /** Lifecycle state. */
  state: CardState;
  /** Absolute instant the card should next be shown. */
  due: Date;
  /** FSRS stability, in days. `0` for a card that has never been reviewed. */
  stability: number;
  /** FSRS difficulty, in `[1, 10]`. `0` for a card that has never been reviewed. */
  difficulty: number;
  /** Whole days since the previous review at the time it was reviewed. */
  elapsedDays: number;
  /** Whole days assigned by the previous review. */
  scheduledDays: number;
  /** Total successful-or-not reviews recorded. */
  reps: number;
  /** Number of times the card was failed (`Again`). */
  lapses: number;
  /** When the card was last reviewed, or `null` if it never has been. */
  lastReview: Date | null;
}

/** Tunable scheduler behaviour. The defaults are the FSRS-6 defaults. */
export interface SchedulerConfig {
  /** Target probability of recall at the moment a card comes due. */
  requestRetention: number;
  /** Floor/ceiling on any assigned interval, in days. */
  maximumInterval: number;
  /** FSRS-6 weight vector, `w[0]` … `w[20]`. */
  weights: readonly number[];
  /** Use the FSRS-5/6 same-day formula when a card is reviewed twice in a day. */
  enableSameDay: boolean;
  /** Randomly jitter intervals by ±5% to spread the review load. */
  enableFuzz: boolean;
}

/** The FSRS-6 default weights, as published for Anki 25.07 and later. */
export const DEFAULT_WEIGHTS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
  0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
  0.0912, 0.0658, 0.1542,
];

/** The defaults used whenever a caller does not supply a configuration. */
export const DEFAULT_CONFIG: SchedulerConfig = {
  requestRetention: 0.9,
  maximumInterval: 36_500,
  weights: DEFAULT_WEIGHTS,
  enableSameDay: true,
  enableFuzz: false,
};

/** Human labels for the four grades, in button order. */
export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

/** A single grade's schedule preview, as returned by {@link previewGrades}. */
export interface GradePreview {
  grade: Grade;
  label: string;
  /** Whole days until the card would next be due. */
  intervalDays: number;
  /** The state the card would move to. */
  state: CardState;
  /** The stability the card would carry. */
  stability: number;
  /** The difficulty the card would carry. */
  difficulty: number;
}

const DAY_MS = 86_400_000;

/** Clamp `value` into an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Whole days between two instants, never negative. */
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);
}

/** Guard every weight read so a malformed vector cannot poison a schedule. */
function weight(config: SchedulerConfig, index: number): number {
  const value = config.weights[index];
  return Number.isFinite(value) ? value : DEFAULT_WEIGHTS[index] ?? 0;
}

/**
 * The forgetting-curve decay exponent, `−w₂₀`.
 *
 * FSRS-4.5 and FSRS-5 used a fixed `−0.5`; FSRS-6 makes it trainable.
 */
export function decay(config: SchedulerConfig = DEFAULT_CONFIG): number {
  return -weight(config, 20);
}

/**
 * The forgetting-curve scale constant, chosen so that `R(S, S) = 0.9`.
 *
 * @param config - Scheduler configuration.
 * @returns `0.9^(1/DECAY) − 1`.
 */
export function factor(config: SchedulerConfig = DEFAULT_CONFIG): number {
  const d = decay(config);
  return Math.pow(0.9, 1 / d) - 1;
}

/**
 * Predict the probability of recalling a card.
 *
 * @param elapsedDays - Whole days since the last review.
 * @param stability - The card's stability, in days.
 * @param config - Scheduler configuration.
 * @returns Probability in `(0, 1]`.
 */
export function forgettingCurve(
  elapsedDays: number,
  stability: number,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  if (!(stability > 0)) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + factor(config) * (t / stability), decay(config));
}

/**
 * The retrievability of a stored memory state right now.
 *
 * A brand-new card has never been seen, so its retrievability is `0` rather
 * than "certain" — the UI uses that to avoid implying prior knowledge.
 *
 * @param state - The card's stored memory state.
 * @param now - The instant to evaluate at. Defaults to the current time.
 * @param config - Scheduler configuration.
 * @returns Probability in `[0, 1]`.
 */
export function retrievability(
  state: MemoryState,
  now: Date = new Date(),
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  if (state.state === "new" || !state.lastReview || !(state.stability > 0)) {
    return 0;
  }
  return forgettingCurve(daysBetween(state.lastReview, now), state.stability, config);
}

/**
 * Convert a stability into an interval at the requested retention.
 *
 * Solving `R(t, S) = r` for `t` gives `I(r, S) = (S / FACTOR)·(r^(1/DECAY) − 1)`.
 *
 * @param stability - The card's stability, in days.
 * @param config - Scheduler configuration.
 * @returns Whole days, clamped to `[1, maximumInterval]`.
 */
export function intervalForStability(
  stability: number,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  if (!(stability > 0)) return 1;
  const raw =
    (stability / factor(config)) *
    (Math.pow(config.requestRetention, 1 / decay(config)) - 1);
  return clamp(Math.round(raw), 1, config.maximumInterval);
}

/** The initial stability after the first review: `S₀(G) = w[G−1]`. */
export function initialStability(
  grade: Grade,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  return Math.max(0.01, weight(config, grade - 1));
}

/** The initial difficulty after the first review, clamped to `[1, 10]`. */
export function initialDifficulty(
  grade: Grade,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  const value = weight(config, 4) - Math.exp(weight(config, 5) * (grade - 1)) + 1;
  return clamp(value, 1, 10);
}

/**
 * Update difficulty after a review.
 *
 * Three steps, in order: a grade-dependent change `ΔD = −w₆·(G−3)`; linear
 * damping `ΔD·(10 − D)/9` so `D` never quite reaches 10; and mean reversion
 * towards `D₀(4)` weighted by `w₇` so difficulty cannot ratchet upwards.
 *
 * @param difficulty - The difficulty before the review.
 * @param grade - The grade given.
 * @param config - Scheduler configuration.
 * @returns The new difficulty, clamped to `[1, 10]`.
 */
export function nextDifficulty(
  difficulty: number,
  grade: Grade,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  const delta = -weight(config, 6) * (grade - 3);
  const damped = difficulty + delta * ((10 - difficulty) / 9);
  const target = initialDifficulty(4, config);
  const reverted = weight(config, 7) * target + (1 - weight(config, 7)) * damped;
  return clamp(reverted, 1, 10);
}

/**
 * Stability after a successful review (`Hard`, `Good` or `Easy`).
 *
 * @param difficulty - Difficulty used for this review.
 * @param stability - Stability before the review.
 * @param recall - Retrievability at the moment of review.
 * @param grade - The grade given; `Hard` and `Easy` apply their multipliers.
 * @param config - Scheduler configuration.
 * @returns The new stability, never below the previous stability.
 */
export function nextStabilityAfterRecall(
  difficulty: number,
  stability: number,
  recall: number,
  grade: Grade,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  const hardPenalty = grade === 2 ? weight(config, 15) : 1;
  const easyBonus = grade === 4 ? weight(config, 16) : 1;
  const increase =
    Math.exp(weight(config, 8)) *
    (11 - difficulty) *
    Math.pow(stability, -weight(config, 9)) *
    (Math.exp(weight(config, 10) * (1 - recall)) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(stability, stability * (1 + increase));
}

/**
 * Stability after a lapse (`Again`).
 *
 * Post-lapse stability can never exceed pre-lapse stability; the `min` is part
 * of the specification, not a safety net here.
 *
 * @param difficulty - Difficulty used for this review.
 * @param stability - Stability before the review.
 * @param recall - Retrievability at the moment of review.
 * @param config - Scheduler configuration.
 * @returns The new stability, in `(0, stability]`.
 */
export function nextStabilityAfterForget(
  difficulty: number,
  stability: number,
  recall: number,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  const value =
    weight(config, 11) *
    Math.pow(difficulty, -weight(config, 12)) *
    (Math.pow(stability + 1, weight(config, 13)) - 1) *
    Math.exp(weight(config, 14) * (1 - recall));
  return Math.max(0.01, Math.min(value, stability));
}

/**
 * Stability after a same-day review (FSRS-5/6 short-term heuristic).
 *
 * `SInc = e^(w₁₇·(G−3+w₁₈)) · S^(−w₁₉)`. Because there is no proper model of
 * short-term memory, the specification adds one guarantee: a `Good` or `Easy`
 * cannot lower stability.
 *
 * @param stability - Stability before the review.
 * @param grade - The grade given.
 * @param config - Scheduler configuration.
 * @returns The new stability.
 */
export function nextStabilitySameDay(
  stability: number,
  grade: Grade,
  config: SchedulerConfig = DEFAULT_CONFIG,
): number {
  const increase =
    Math.exp(weight(config, 17) * (grade - 3 + weight(config, 18))) *
    Math.pow(Math.max(stability, 0.01), -weight(config, 19));
  const guaranteed = grade >= 3 ? Math.max(increase, 1) : increase;
  return Math.max(0.01, stability * guaranteed);
}

/**
 * A fresh, never-reviewed card, due immediately.
 *
 * @param now - The instant the card enters the queue. Defaults to now.
 * @returns A `new` memory state with zeroed stability and difficulty.
 */
export function createNewCard(now: Date = new Date()): MemoryState {
  return {
    state: "new",
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
  };
}

/**
 * Apply optional interval fuzz.
 *
 * Anki spreads due dates by up to ±5% so that a large deck does not produce a
 * single enormous review day. The jitter is derived from the current time so it
 * stays cheap and dependency-free; set `enableFuzz: false` for determinism.
 */
function applyFuzz(days: number, config: SchedulerConfig): number {
  if (!config.enableFuzz || days < 3) return days;
  const jitter = (Math.random() * 2 - 1) * 0.05;
  return clamp(Math.round(days * (1 + jitter)), 1, config.maximumInterval);
}

/** The result of scheduling one review. */
export interface ScheduleResult extends MemoryState {
  /** Whole days assigned to this review. */
  intervalDays: number;
  /** Retrievability at the moment of the review, for display and diagnostics. */
  recall: number;
}

/**
 * Schedule one review.
 *
 * The elapsed time decides which stability formula applies: cards reviewed on
 * the same day use the short-term heuristic, later reviews use the recall or
 * lapse formula. Difficulty is updated first because the recall formula reads
 * the *new* difficulty, exactly as the specification does.
 *
 * @param state - The card's state before the review.
 * @param grade - The grade the member gave.
 * @param now - The instant of the review. Defaults to now.
 * @param config - Scheduler configuration.
 * @returns The next memory state, its interval, and the retrievability at review.
 */
export function schedule(
  state: MemoryState,
  grade: Grade,
  now: Date = new Date(),
  config: SchedulerConfig = DEFAULT_CONFIG,
): ScheduleResult {
  // Never-reviewed cards take the initial-stability/initial-difficulty branch:
  // there is no previous S to grow from.
  const isFirstReview = state.state === "new" || state.reps === 0 || !state.lastReview;

  let stability: number;
  let difficulty: number;
  let recall: number;

  if (isFirstReview) {
    stability = initialStability(grade, config);
    difficulty = initialDifficulty(grade, config);
    recall = 0;
  } else {
    const elapsed = daysBetween(state.lastReview as Date, now);
    const previousRecall = forgettingCurve(elapsed, state.stability, config);
    recall = previousRecall;
    difficulty = nextDifficulty(state.difficulty, grade, config);

    const sameDay = config.enableSameDay && elapsed < 1;
    if (sameDay) {
      stability = nextStabilitySameDay(state.stability, grade, config);
    } else if (grade === 1) {
      stability = nextStabilityAfterForget(
        difficulty,
        state.stability,
        previousRecall,
        config,
      );
    } else {
      stability = nextStabilityAfterRecall(
        difficulty,
        state.stability,
        previousRecall,
        grade,
        config,
      );
    }
  }

  // `Again` schedules the short relearning step; everything else reads the
  // interval straight off the new stability.
  const rawInterval = grade === 1 ? 1 : intervalForStability(stability, config);
  const intervalDays = applyFuzz(
    clamp(Math.round(rawInterval), 1, config.maximumInterval),
    config,
  );

  const nextState: CardState =
    grade === 1 ? "relearning" : state.state === "new" ? "review" : "review";

  return {
    state: nextState,
    due: new Date(now.getTime() + intervalDays * DAY_MS),
    stability,
    difficulty,
    elapsedDays: isFirstReview
      ? 0
      : Math.round(daysBetween(state.lastReview as Date, now)),
    scheduledDays: intervalDays,
    reps: state.reps + 1,
    lapses: state.lapses + (grade === 1 ? 1 : 0),
    lastReview: now,
    intervalDays,
    recall,
  };
}

/**
 * Preview all four grades without mutating anything.
 *
 * Powers the four buttons' "next interval" captions.
 *
 * @param state - The card's state before the review.
 * @param now - The instant of a hypothetical review. Defaults to now.
 * @param config - Scheduler configuration.
 * @returns One {@link GradePreview} per grade, in Again→Easy order.
 */
export function previewGrades(
  state: MemoryState,
  now: Date = new Date(),
  config: SchedulerConfig = DEFAULT_CONFIG,
): GradePreview[] {
  return ([1, 2, 3, 4] as const).map((grade) => {
    const result = schedule(state, grade, now, config);
    return {
      grade,
      label: GRADE_LABELS[grade],
      intervalDays: result.intervalDays,
      state: result.state,
      stability: result.stability,
      difficulty: result.difficulty,
    };
  });
}

/**
 * Whether a card belongs in the study queue at `now`.
 *
 * @param state - The card's memory state.
 * @param now - The instant to test. Defaults to now.
 * @returns `true` when the card is due, including a never-reviewed card.
 */
export function isDue(state: MemoryState, now: Date = new Date()): boolean {
  return state.due.getTime() <= now.getTime();
}

/**
 * Render an interval as a short human phrase, e.g. `"12 d"` or `"1.4 mo"`.
 *
 * @param days - A whole-day interval.
 * @returns A compact label suitable for a grading button.
 */
export function formatInterval(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 31) return `${Math.round(days)} days`;
  if (days < 365) return `${(days / 30.44).toFixed(1)} mo`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

/** The queue-facing projection of a stored review row. */
export interface StoredReviewShape {
  state: CardState;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

/**
 * Convert a `flashcard_reviews` row (or `null` for a new card) into a
 * {@link MemoryState}.
 *
 * @param review - The stored row, or `null` when the member has no state yet.
 * @param now - Used as the due date for a brand-new card. Defaults to now.
 * @returns A memory state the scheduler can consume.
 */
export function fromStoredReview(
  review: StoredReviewShape | null,
  now: Date = new Date(),
): MemoryState {
  if (!review) return createNewCard(now);
  return {
    state: review.state,
    due: review.due,
    stability: review.stability,
    difficulty: review.difficulty,
    elapsedDays: review.elapsedDays,
    scheduledDays: review.scheduledDays,
    reps: review.reps,
    lapses: review.lapses,
    lastReview: review.lastReview,
  };
}

/**
 * Project a scheduled result onto the fields `upsertFlashcardReview` accepts.
 *
 * @param userId - The member's id.
 * @param cardId - The card's id.
 * @param result - A result from {@link schedule}.
 * @returns A plain object ready to pass to the store.
 */
export function toUpsertInput(
  userId: string,
  cardId: string,
  result: ScheduleResult,
): {
  userId: string;
  cardId: string;
  state: CardState;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: Date;
} {
  return {
    userId,
    cardId,
    state: result.state,
    due: result.due,
    stability: result.stability,
    difficulty: result.difficulty,
    elapsedDays: result.elapsedDays,
    scheduledDays: result.scheduledDays,
    reps: result.reps,
    lapses: result.lapses,
    lastReview: result.lastReview ?? new Date(),
  };
}
