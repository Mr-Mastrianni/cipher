/**
 * Notification fan-out.
 *
 * The bell, the `notifications` table, `GET/PATCH /api/notifications` and
 * `store.createNotification` all already existed; nothing outside the demo seed
 * ever wrote a row, so a real deployment's bell could never fill. This module is
 * the missing writer.
 *
 * Design rules, in the order they matter:
 *
 *  1. **A notification never fails its cause.** Sending a message, approving an
 *     application or RSVPing to a call must succeed even if the notification
 *     cannot be written. Every exported function here catches and logs instead
 *     of throwing, so a caller can `await` it without a try/catch.
 *  2. **Nobody is notified about their own action.** An admin who applies, a
 *     member who RSVPs to their own call, and a self-authored message all
 *     produce nothing.
 *  3. **Only meaningful transitions notify.** An RSVP notifies on the change to
 *     `going`, not on every toggle, so a member tapping twice does not spam the
 *     host.
 *  4. **Never leak a reviewer's private note.** `decisionNote` is an internal
 *     record; the applicant learns the decision, not the deliberation.
 *
 * The payload keeps a `metadata` object with the ids behind the notification so
 * a future email or realtime sender can fan out from the same rows without a
 * schema change.
 */

import type { CreateNotificationInput, Store } from "@/lib/db/store";
import type {
  DirectThread,
  LiveCall,
  RsvpStatus,
  TierKey,
  User,
} from "@/lib/db/schema";
import { TIERS } from "@/lib/payments/stripe";

/** How much of a message body is shown in the notification preview. */
const PREVIEW_CHARS = 120;

/** The name to show for a member, never empty and never a raw uuid. */
export function memberName(
  user: Pick<User, "displayName" | "firstName" | "lastName"> | null | undefined,
): string {
  if (!user) return "A member";
  const full = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return user.displayName?.trim() || full || "A member";
}

/** A single-line preview of a message body, ellipsised to a fixed width. */
export function preview(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= PREVIEW_CHARS) return flat;
  return `${flat.slice(0, PREVIEW_CHARS - 1).trimEnd()}…`;
}

/** The display name of a tier, falling back to its key. */
function tierName(key: TierKey | null | undefined): string {
  if (!key) return "member";
  return TIERS.find((tier) => tier.slug === key)?.name ?? key;
}

/**
 * Write one notification, swallowing a store failure.
 *
 * @returns `true` when the row was written.
 */
async function deliver(
  store: Store,
  input: CreateNotificationInput,
): Promise<boolean> {
  try {
    await store.createNotification(input);
    return true;
  } catch (error) {
    console.error("[notifications] could not record a notification", error);
    return false;
  }
}

/**
 * Tell the admins that someone applied.
 *
 * @returns How many admins were notified.
 */
export async function notifyAdminsOfApplication(
  store: Store,
  input: { applicant: User; applicationId: string },
): Promise<number> {
  try {
    // The admin roster is small; one page is plenty and avoids a second round
    // trip for a total this function does not use.
    const { items: admins } = await store.listUsers({
      role: "admin",
      pageSize: 100,
    });

    const name = memberName(input.applicant);
    let delivered = 0;
    for (const admin of admins) {
      if (admin.id === input.applicant.id) continue;
      const ok = await deliver(store, {
        userId: admin.id,
        type: "application",
        title: "New membership application",
        body: `${name} applied to join.`,
        url: "/admin/applications",
        metadata: {
          applicationId: input.applicationId,
          applicantUserId: input.applicant.id,
        },
      });
      if (ok) delivered += 1;
    }
    return delivered;
  } catch (error) {
    console.error("[notifications] could not notify admins", error);
    return 0;
  }
}

/**
 * Tell an applicant the outcome of their application.
 *
 * Approval points at `/dashboard`, which itself redirects a member who has not
 * finished onboarding to `/onboarding` — so one URL is correct for a returning
 * member and a brand-new one alike.
 *
 * @returns `true` when the row was written.
 */
export async function notifyApplicantOfDecision(
  store: Store,
  input: {
    userId: string;
    applicationId: string;
    decision: "approved" | "denied";
    /** The tier granted on approval; ignored for a denial. */
    tier?: TierKey | null;
  },
): Promise<boolean> {
  try {
    const approved = input.decision === "approved";
    return await deliver(store, {
      userId: input.userId,
      type: "application",
      title: approved
        ? "Your application was approved"
        : "Your application was not approved",
      body: approved
        ? `Welcome to The Cipher. Your ${tierName(input.tier)} membership is open — enter your dashboard to begin.`
        : "We could not offer you a place this time. You are welcome to apply again.",
      url: approved ? "/dashboard" : "/membership",
      metadata: {
        applicationId: input.applicationId,
        decision: input.decision,
        // The reviewer's note is deliberately not copied here: it is an
        // internal record, not a message to the applicant.
        tier: approved ? (input.tier ?? null) : null,
      },
    });
  } catch (error) {
    console.error("[notifications] could not notify the applicant", error);
    return false;
  }
}

/**
 * Tell the other participant in a direct thread that a message arrived.
 *
 * @returns `true` when the row was written.
 */
export async function notifyDirectMessage(
  store: Store,
  input: {
    thread: DirectThread;
    author: User;
    body: string;
    messageId: string;
  },
): Promise<boolean> {
  try {
    const recipientId =
      input.thread.userAId === input.author.id
        ? input.thread.userBId
        : input.thread.userAId;
    if (!recipientId || recipientId === input.author.id) return false;

    return await deliver(store, {
      userId: recipientId,
      type: "message",
      title: `${memberName(input.author)} sent you a message`,
      body: preview(input.body),
      url: "/dashboard/messages",
      metadata: {
        threadId: input.thread.id,
        messageId: input.messageId,
        authorId: input.author.id,
      },
    });
  } catch (error) {
    console.error("[notifications] could not notify the message recipient", error);
    return false;
  }
}

/**
 * Tell a call's host that a member is coming.
 *
 * Only the transition *into* `going` notifies: an explicit "maybe" or
 * "declined", and a member who taps the toggle off, are both silent.
 *
 * @returns `true` when the row was written.
 */
export async function notifyCallRsvp(
  store: Store,
  input: {
    call: LiveCall;
    member: User;
    status: RsvpStatus;
    /** The member's RSVP before this change, or null when they had none. */
    previousStatus: RsvpStatus | null;
  },
): Promise<boolean> {
  try {
    if (input.status !== "going") return false;
    if (input.previousStatus === "going") return false;

    const hostId = input.call.hostId;
    if (!hostId || hostId === input.member.id) return false;

    return await deliver(store, {
      userId: hostId,
      type: "call",
      title: `${memberName(input.member)} is coming to ${input.call.title}`,
      body: `They have RSVP'd for ${input.call.title}.`,
      url: "/dashboard/calls",
      metadata: {
        callId: input.call.id,
        memberId: input.member.id,
      },
    });
  } catch (error) {
    console.error("[notifications] could not notify the call host", error);
    return false;
  }
}
