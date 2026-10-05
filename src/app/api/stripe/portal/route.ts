/**
 * `POST /api/stripe/portal` — open the Stripe Billing Portal.
 *
 * Returns `{ url }` for the signed-in user's own customer record. When Stripe
 * is unconfigured this is a 503 with an honest message; when the user has never
 * been through Checkout there is no customer to open, which is a 409.
 */

import type { NextRequest } from "next/server";

import { handleAuthError, requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/payments/stripe";

/** Stripe's SDK requires the Node.js runtime. */
export const runtime = "nodejs";
/** The portal session is per-user; never cache or prerender it. */
export const dynamic = "force-dynamic";

/** Build the absolute origin used for the portal return URL. */
function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && configured !== "") return configured.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/** POST handler. See the file header for the contract. */
export async function POST(_request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    const stripe = getStripe();
    if (!stripe) {
      return Response.json(
        {
          ok: false,
          error:
            "Billing is not configured on this deployment. Set STRIPE_SECRET_KEY to enable the billing portal.",
        },
        { status: 503 },
      );
    }

    if (!user.stripeCustomerId) {
      return Response.json(
        {
          ok: false,
          error:
            "You do not have a billing account yet. Choose a membership tier first.",
        },
        { status: 409 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appOrigin()}/membership`,
    });

    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      {
        ok: false,
        error: "The billing portal could not be opened. Please try again.",
      },
      { status: 500 },
    );
  }
}
