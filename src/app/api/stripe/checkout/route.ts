/**
 * `POST /api/stripe/checkout` — start a subscription Checkout Session.
 *
 * Body: `{ tier: "initiate" | "adept" | "oracle" }`.
 *
 * Guarantees:
 *  - `requireUser()` first; the customer id is attached to that user only.
 *  - A missing Stripe key is a 503 with an explanatory message, never a crash.
 *  - The Stripe customer is created once and persisted on the user row.
 *  - `client_reference_id` and `metadata.userId` carry the local user id so the
 *    webhook can reconcile without guessing from an email address.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleAuthError, requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getStripe, getTier } from "@/lib/payments/stripe";

/** Stripe's SDK requires the Node.js runtime. */
export const runtime = "nodejs";
/** Checkout depends on the caller's session; never cache or prerender it. */
export const dynamic = "force-dynamic";

/** Shape of the checkout request body. */
const CheckoutRequestSchema = z.object({
  tier: z.enum(["initiate", "adept", "oracle"]),
});

/** Build the absolute origin used for Checkout redirect URLs. */
function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && configured !== "") return configured.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/** POST handler. See the file header for the contract. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    // Admins are treated as approved members throughout the app (see
    // `requireMember`), so a founder can still buy a plan.
    if (user.role !== "admin" && user.membershipStatus !== "approved") {
      return Response.json(
        {
          ok: false,
          error:
            "Your membership has not been approved yet, so billing is not open to you.",
        },
        { status: 403 },
      );
    }

    const parsed = CheckoutRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "Choose one of the paid tiers to continue." },
        { status: 400 },
      );
    }

    // A second Checkout session would start a second, concurrent subscription
    // and bill the member twice. Plan changes go through the Customer Portal.
    if (
      user.stripeSubscriptionId &&
      (user.subscriptionStatus === "active" ||
        user.subscriptionStatus === "trialing" ||
        user.subscriptionStatus === "past_due")
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "You already have an active subscription. Change or cancel your plan from Manage billing.",
        },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return Response.json(
        {
          ok: false,
          error:
            "Billing is not configured on this deployment. Set STRIPE_SECRET_KEY (and the STRIPE_PRICE_* ids) to enable checkout.",
        },
        { status: 503 },
      );
    }

    const tier = getTier(parsed.data.tier);
    if (!tier || !tier.stripePriceId) {
      return Response.json(
        {
          ok: false,
          error: `The ${parsed.data.tier} price is not configured. Set STRIPE_PRICE_${parsed.data.tier.toUpperCase()} to the Stripe Price id.`,
        },
        { status: 503 },
      );
    }

    const store = getStore();

    // Reuse the stored customer when it still exists; otherwise mint one.
    let customerId = user.stripeCustomerId;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ("deleted" in existing && existing.deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.displayName ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await store.updateUser(user.id, { stripeCustomerId: customerId });
    }

    const origin = appOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: tier.stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/membership?checkout=success`,
      cancel_url: `${origin}/membership?checkout=cancelled`,
      metadata: { userId: user.id, tier: tier.slug },
      subscription_data: { metadata: { userId: user.id, tier: tier.slug } },
    });

    if (!session.url) {
      return Response.json(
        {
          ok: false,
          error:
            "Stripe created the session but returned no redirect URL. Check the Stripe dashboard configuration.",
        },
        { status: 502 },
      );
    }

    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      {
        ok: false,
        error: "Checkout could not be started. Please try again.",
      },
      { status: 500 },
    );
  }
}
