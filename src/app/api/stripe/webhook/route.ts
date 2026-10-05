/**
 * `POST /api/stripe/webhook` — the Stripe event receiver.
 *
 * Design notes:
 *  - The **raw** body is read with `await request.text()` and verified with
 *    `stripe.webhooks.constructEvent`, because any re-serialisation breaks the
 *    signature. A genuine verification failure is the only 400 this route
 *    returns.
 *  - Idempotency uses the `webhook_events` table, keyed by `event.id`. Stripe
 *    delivers at least once, so a duplicate is acknowledged with 200 and
 *    skipped. When no database is configured the ledger falls back to a
 *    process-local set, which is exactly as durable as the `MemoryStore` the
 *    rest of the app falls back to.
 *  - Unhandled event types are acknowledged with 200 so Stripe stops retrying
 *    them; only an unexpected processing failure returns 500 (which asks Stripe
 *    to retry, the correct behaviour for a transient database error).
 *  - Only the five subscription-relevant event types are acted on; the payload
 *    column stores a compact sanitised summary, never the full event body.
 */

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/lib/db/client";
import { webhookEvents, type TierKey } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";
import { getStripe, tierFromPriceId } from "@/lib/payments/stripe";
import type Stripe from "stripe";

/** Stripe signature verification requires the Node.js runtime. */
export const runtime = "nodejs";
/** Webhooks are always dynamic and must never be cached. */
export const dynamic = "force-dynamic";

/** Event types this route understands. */
const HANDLED_EVENTS: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

/** Cap on the in-memory fallback ledger, so a long-lived process cannot leak. */
const MEMORY_LEDGER_LIMIT = 1000;

/** Process-local idempotency fallback used only when no database is present. */
const memoryLedger = new Set<string>();

/** Remember an event id in the bounded process-local ledger. */
function rememberLocally(eventId: string): void {
  if (memoryLedger.size >= MEMORY_LEDGER_LIMIT) {
    const oldest = memoryLedger.values().next().value;
    if (typeof oldest === "string") memoryLedger.delete(oldest);
  }
  memoryLedger.add(eventId);
}

/** Extract an id from a Stripe field that may be an id or an expanded object. */
function idOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/** Whether this event id has already been processed. */
async function hasProcessed(eventId: string): Promise<boolean> {
  const database = db;
  if (!database) return memoryLedger.has(eventId);
  const rows = await database
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, eventId))
    .limit(1);
  return rows.length > 0;
}

/** Record an event id in the durable (or fallback) ledger. */
async function markProcessed(event: Stripe.Event): Promise<void> {
  const database = db;
  if (!database) {
    rememberLocally(event.id);
    return;
  }
  await database
    .insert(webhookEvents)
    .values({
      id: event.id,
      provider: "stripe",
      type: event.type,
      payload: { type: event.type, created: event.created },
    })
    .onConflictDoNothing();
}

/**
 * Mirror a subscription onto the owning user row.
 *
 * The tier is only granted while the subscription is `active` or `trialing`;
 * a deletion always downgrades to `free`. A price id we do not recognise leaves
 * the current tier untouched rather than guessing.
 */
async function applySubscription(
  subscription: Stripe.Subscription,
  options: { deleted: boolean },
): Promise<void> {
  const store = getStore();
  const customerId = idOf(subscription.customer);
  if (!customerId) return;

  const user = await store.getUserByStripeCustomerId(customerId);
  if (!user) return;

  const firstItem = subscription.items.data[0] ?? null;
  const priceId = firstItem?.price?.id ?? null;
  const periodEndSeconds =
    firstItem?.current_period_end ?? subscription.trial_end ?? null;
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  const derived = tierFromPriceId(priceId);

  const nextTier: TierKey = options.deleted
    ? "free"
    : isActive && derived
      ? derived
      : user.tier;

  await store.updateUser(user.id, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: periodEndSeconds
      ? new Date(periodEndSeconds * 1000)
      : user.currentPeriodEnd,
    tier: nextTier,
  });
}

/** Handle one verified event. Returns whether the type was acted upon. */
async function handleEvent(event: Stripe.Event): Promise<boolean> {
  const store = getStore();
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as Stripe.Checkout.Session;
      const customerId = idOf(session.customer);
      const subscriptionId = idOf(session.subscription);
      const userId =
        session.client_reference_id ?? session.metadata?.userId ?? null;

      const user = userId
        ? await store.getUserById(userId)
        : customerId
          ? await store.getUserByStripeCustomerId(customerId)
          : null;
      if (!user) return true;

      // Link the ids first so a concurrent subscription event can reconcile.
      await store.updateUser(user.id, {
        stripeCustomerId: customerId ?? user.stripeCustomerId,
        stripeSubscriptionId: subscriptionId ?? user.stripeSubscriptionId,
      });

      if (stripe && subscriptionId) {
        try {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          await applySubscription(subscription, { deleted: false });
        } catch {
          // The `customer.subscription.*` events will arrive and reconcile.
        }
      }
      return true;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await applySubscription(
        event.data.object as unknown as Stripe.Subscription,
        { deleted: false },
      );
      return true;
    }

    case "customer.subscription.deleted": {
      await applySubscription(
        event.data.object as unknown as Stripe.Subscription,
        { deleted: true },
      );
      return true;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Stripe.Invoice;
      const customerId = idOf(invoice.customer);
      if (!customerId) return true;
      const user = await store.getUserByStripeCustomerId(customerId);
      if (!user) return true;
      await store.updateUser(user.id, { subscriptionStatus: "past_due" });
      return true;
    }

    default:
      return false;
  }
}

/** POST handler. See the file header for the contract. */
export async function POST(request: NextRequest): Promise<Response> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return Response.json(
      {
        ok: false,
        error:
          "Stripe webhooks are not configured on this deployment. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
      },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { ok: false, error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return Response.json(
      { ok: false, error: "Signature verification failed." },
      { status: 400 },
    );
  }

  try {
    if (await hasProcessed(event.id)) {
      return Response.json({ received: true, duplicate: true });
    }

    const handled = await handleEvent(event);
    await markProcessed(event);

    return Response.json({
      received: true,
      handled,
      ignored: !handled,
      known: HANDLED_EVENTS.has(event.type),
    });
  } catch {
    // A transient failure: 500 asks Stripe to retry the same event id, and the
    // ledger is only written after a successful handler run.
    return Response.json(
      { ok: false, error: "The event could not be processed." },
      { status: 500 },
    );
  }
}
