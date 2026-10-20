"use client";

import { useState } from "react";
import { AlertTriangle, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface CancelMembershipProps {
  /** Whether `STRIPE_SECRET_KEY` is configured on this deployment. */
  billingConfigured: boolean;
  /** Whether the member has a Stripe customer to open a portal for. */
  hasBillingAccount: boolean;
  /** The mirrored Stripe subscription status, or `null` when there is none. */
  subscriptionStatus: string | null;
  /** The end of the paid period, already formatted, or `null`. */
  periodEndLabel: string | null;
}

type Phase = "idle" | "confirming" | "opening" | "error";

/**
 * Cancel-membership control for the settings danger zone.
 *
 * Cancellation is never performed by this application: Stripe Billing owns the
 * subscription, and this app only mirrors what its webhooks report. So the
 * control opens the Stripe Billing Portal — where the member confirms, sees the
 * exact end date, and can be offered a pause or a downgrade — rather than
 * pretending we can cancel a subscription we do not own.
 *
 * It replaced a link to `/membership/cancel`, a page that never existed, so the
 * button used to 404. It also refuses to offer cancellation when there is
 * nothing to cancel, instead of opening a portal that would confuse.
 *
 * The two-step confirmation exists because opening a billing portal from a
 * button captioned "Cancel membership" should not happen on a single stray
 * click.
 */
export function CancelMembership({
  billingConfigured,
  hasBillingAccount,
  subscriptionStatus,
  periodEndLabel,
}: CancelMembershipProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const subscribed =
    Boolean(subscriptionStatus) &&
    subscriptionStatus !== "canceled" &&
    subscriptionStatus !== "incomplete_expired";

  const canCancel = billingConfigured && hasBillingAccount && subscribed;

  /** Why cancellation is unavailable, or `null` when it is. */
  const blocked = !billingConfigured
    ? "Billing is not configured on this deployment, so there is nothing to cancel here."
    : !hasBillingAccount
      ? "You do not have a billing account yet, so nothing is being charged."
      : !subscribed
        ? "No subscription is attached to your account."
        : null;

  async function openPortal() {
    setPhase("opening");
    setMessage(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.url) {
        // The route explains itself honestly (503 when billing is unconfigured,
        // 409 when there is no customer), so show its words rather than a
        // generic "could not reach" that hides a configuration problem.
        setPhase("error");
        setMessage(data?.error ?? "The billing portal could not be opened.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setPhase("error");
      setMessage("We could not reach billing. Check your connection and try again.");
    }
  }

  return (
    <div className="surface flex flex-wrap items-start justify-between gap-4 rounded-lg border-danger/30 p-5">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg text-bone">Cancel membership</p>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted text-pretty">
          {blocked ??
            "You keep access until the current period ends. No further charges are made."}
        </p>
        {subscribed && periodEndLabel ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            Paid until {periodEndLabel}
          </p>
        ) : null}

        {phase === "confirming" || phase === "opening" ? (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/5 p-4">
            <p className="text-sm leading-relaxed text-bone text-pretty">
              This opens the billing portal, where you confirm the cancellation
              and see the exact end date. Your reading stays available either
              way.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={phase === "opening"}
                onClick={() => void openPortal()}
              >
                Continue to billing
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={phase === "opening"}
                onClick={() => setPhase("idle")}
              >
                Keep my membership
              </Button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 text-sm text-danger"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </p>
        ) : null}
      </div>

      {phase === "idle" || phase === "error" ? (
        <Button
          variant="danger"
          size="sm"
          disabled={!canCancel}
          onClick={() => {
            setMessage(null);
            setPhase("confirming");
          }}
        >
          <ShieldOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          Cancel membership
        </Button>
      ) : null}
    </div>
  );
}
