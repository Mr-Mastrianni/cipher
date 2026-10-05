import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore, type DueFlashcard } from "@/lib/db/store";
import type { FlashcardDeck } from "@/lib/db/schema";
import {
  DEFAULT_CONFIG,
  fromStoredReview,
  schedule,
  toUpsertInput,
  type Grade,
} from "@/lib/srs/scheduler";

/**
 * `/api/flashcards/[deck]/review`
 *
 * - `GET`  — the study queue due now, plus every deck with its due count.
 * - `POST` — record one graded review and return the card's next due date.
 *
 * The scheduler lives in `@/lib/srs/scheduler` (FSRS-6). The route owns only
 * two things: authorisation and the round trip to the store. The current
 * memory state is always read back from the store rather than trusted from the
 * request, so a tampered client cannot inflate its own stability.
 */

/** Ascending tier order used for membership comparisons. */
const TIER_RANK: Readonly<Record<string, number>> = {
  free: 0,
  initiate: 1,
  adept: 2,
  oracle: 3,
};

const reviewSchema = z.object({
  cardId: z.string().min(1),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
});

/** A deck summary for the deck list. */
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

/** The wire shape of a queued card. */
interface QueueItem {
  card: { id: string; front: string; back: string; tags: string[] };
  review: {
    state: string;
    due: string;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    lastReview: string | null;
  } | null;
}

/** Project a due row onto the wire shape. */
function toQueueItem(row: DueFlashcard): QueueItem {
  return {
    card: {
      id: row.card.id,
      front: row.card.front,
      back: row.card.back,
      tags: row.card.tags,
    },
    review: row.review
      ? {
          state: row.review.state,
          due: row.review.due.toISOString(),
          stability: row.review.stability,
          difficulty: row.review.difficulty,
          elapsedDays: row.review.elapsedDays,
          scheduledDays: row.review.scheduledDays,
          reps: row.review.reps,
          lapses: row.review.lapses,
          lastReview: row.review.lastReview
            ? row.review.lastReview.toISOString()
            : null,
        }
      : null,
  };
}

/**
 * Build the deck list with per-deck due counts.
 *
 * @param decks - Every deck.
 * @param userId - The caller.
 * @param tier - The caller's tier key.
 * @param role - The caller's role, so admins bypass tier gates.
 * @returns One summary per deck.
 */
async function summariseDecks(
  decks: FlashcardDeck[],
  userId: string,
  tier: string,
  role: string,
): Promise<DeckSummary[]> {
  const store = getStore();
  const out: DeckSummary[] = [];
  for (const deck of decks) {
    const withCards = await store.getDeckWithCards(deck.id);
    const due = await store.getDueFlashcards(userId, deck.id, 500);
    const locked =
      role !== "admin" &&
      (TIER_RANK[tier] ?? 0) < (TIER_RANK[deck.tierRequired] ?? 0);
    out.push({
      id: deck.id,
      slug: deck.slug,
      title: deck.title,
      description: deck.description,
      tierRequired: deck.tierRequired,
      cardCount: withCards?.cards.length ?? 0,
      dueCount: locked ? 0 : due.length,
      locked,
    });
  }
  return out;
}

/**
 * Resolve a deck by slug or uuid.
 *
 * @param decks - Every deck.
 * @param key - A slug or uuid, or `"all"`.
 * @returns The matching deck, or `null` for `"all"`/no match.
 */
function resolveDeck(decks: FlashcardDeck[], key: string): FlashcardDeck | null {
  if (key === "all") return null;
  return decks.find((deck) => deck.slug === key || deck.id === key) ?? null;
}

/**
 * Read the deck list and the due queue.
 *
 * @param request - The incoming request; `limit` caps the queue size.
 * @param context - Route context carrying the deck `slug` (or `all`).
 * @returns Decks, the selected deck, and the due queue.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/flashcards/[deck]/review">,
) {
  try {
    const user = await requireMember();
    const { deck: deckKey } = await context.params;
    const store = getStore();

    const limitParam = Number.parseInt(
      new URL(request.url).searchParams.get("limit") ?? "60",
      10,
    );
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 60;

    const decks = await store.listFlashcardDecks();
    const summaries = await summariseDecks(decks, user.id, user.tier, user.role);
    const selected = resolveDeck(decks, deckKey);

    if (deckKey !== "all" && !selected) {
      return Response.json({ ok: false, error: "Deck not found." }, { status: 404 });
    }

    let queue: QueueItem[] = [];
    if (selected) {
      const locked =
        user.role !== "admin" &&
        (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[selected.tierRequired] ?? 0);
      if (!locked) {
        const rows = await store.getDueFlashcards(user.id, selected.id, limit);
        queue = rows.map(toQueueItem);
      }
    } else {
      const rows = await store.getDueFlashcards(user.id, undefined, limit);
      queue = rows.map(toQueueItem);
    }

    return Response.json({
      ok: true,
      decks: summaries,
      deck: selected
        ? {
            id: selected.id,
            slug: selected.slug,
            title: selected.title,
            tierRequired: selected.tierRequired,
          }
        : { id: "all", slug: "all", title: "All decks", tierRequired: "free" },
      queue,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load the study queue." }, { status: 500 })
    );
  }
}

/**
 * Record a graded review.
 *
 * @param request - JSON body `{ cardId, grade: 1|2|3|4, durationMs? }`.
 * @param context - Route context carrying the deck `slug` (or `all`).
 * @returns The card's next due date and the remaining queue length.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/flashcards/[deck]/review">,
) {
  try {
    const user = await requireMember();
    const { deck: deckKey } = await context.params;
    const store = getStore();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const parsed = reviewSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "A card id and a grade from 1 to 4 are required." },
        { status: 400 },
      );
    }

    const decks = await store.listFlashcardDecks();
    const selected = resolveDeck(decks, deckKey);
    if (deckKey !== "all" && !selected) {
      return Response.json({ ok: false, error: "Deck not found." }, { status: 404 });
    }

    if (
      selected &&
      user.role !== "admin" &&
      (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[selected.tierRequired] ?? 0)
    ) {
      return Response.json(
        { ok: false, error: `This deck needs the ${selected.tierRequired} tier.` },
        { status: 403 },
      );
    }

    // Read the queue (not the client's copy of it) so the memory state used for
    // scheduling is always the authoritative one.
    const rows = await store.getDueFlashcards(
      user.id,
      selected ? selected.id : undefined,
      500,
    );
    const entry = rows.find((row) => row.card.id === parsed.data.cardId);
    if (!entry) {
      return Response.json(
        { ok: false, error: "That card is not in your due queue." },
        { status: 409 },
      );
    }

    const now = new Date();
    const state = fromStoredReview(entry.review, now);
    const result = schedule(state, parsed.data.grade as Grade, now, DEFAULT_CONFIG);
    const saved = await store.upsertFlashcardReview(
      toUpsertInput(user.id, entry.card.id, result),
    );

    return Response.json({
      ok: true,
      cardId: entry.card.id,
      due: saved.due.toISOString(),
      intervalDays: result.intervalDays,
      state: saved.state,
      stability: saved.stability,
      difficulty: saved.difficulty,
      recall: result.recall,
      remaining: Math.max(0, rows.length - 1),
      durationMs: parsed.data.durationMs ?? null,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not save the review." }, { status: 500 })
    );
  }
}
