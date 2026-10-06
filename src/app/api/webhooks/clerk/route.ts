import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import { isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { webhookEvents } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";

/**
 * The subset of Clerk's `UserJSON` this projection actually reads.
 *
 * Declared structurally rather than imported so the handler is not coupled to
 * Clerk's internal resource type names, and so the field list is auditable.
 */
interface ClerkUserPayload {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  primary_email_address_id: string | null;
  email_addresses: Array<{
    id: string;
    email_address: string;
    verification?: { status?: string | null } | null;
  }>;
  updated_at: number;
}

/**
 * Clerk user webhooks.
 *
 * Clerk (via Svix/Standard Webhooks) delivers **at least once** and in **no
 * guaranteed order**, so this handler is written for both properties:
 *
 *  - Every delivery is checked against the `webhook_events` ledger by its
 *    webhook id before any write, which makes redelivery a no-op.
 *  - Both `user.created` and `user.updated` go through `upsertUser`, and the
 *    store itself refuses a payload whose `clerkUpdatedAt` is older than the
 *    row it already holds.
 *  - `user.deleted` is a soft delete, so a late create/update cannot resurrect
 *    a deleted account.
 *
 * The route must stay public, which is why `src/proxy.ts` excludes
 * `/api/webhooks` from its matcher.
 */

/** Clerk's user id lives on the `svix-id`/`webhook-id` headers. */
function webhookId(request: NextRequest): string | null {
  return (
    request.headers.get("svix-id") ??
    request.headers.get("webhook-id") ??
    null
  );
}

/**
 * Process-local fallback ledger used when no database is configured, so local
 * development still dedupes within a single server instance.
 */
const memoryLedger = new Set<string>();

/** Has this delivery already been handled? */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  if (memoryLedger.has(eventId)) return true;
  if (!db) return false;
  try {
    const rows = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, eventId))
      .limit(1);
    return rows.length > 0;
  } catch {
    // A ledger read failure must not drop the event; the upsert is idempotent.
    return false;
  }
}

/** Record a handled delivery, tolerating a concurrent duplicate insert. */
async function markProcessed(
  eventId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  memoryLedger.add(eventId);
  if (!db) return;
  try {
    await db
      .insert(webhookEvents)
      .values({ id: eventId, provider: "clerk", type, payload })
      .onConflictDoNothing();
  } catch {
    // Best-effort: dedupe is an optimisation, not a correctness requirement.
  }
}

/** The user's primary email, falling back to the first address on the account. */
function primaryEmail(data: ClerkUserPayload): string {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find(
    (address) => address.id === data.primary_email_address_id,
  );
  return (
    primary?.email_address ?? addresses[0]?.email_address ?? ""
  ).toLowerCase();
}

/**
 * The primary email only when Clerk has verified it. Admin bootstrap keys off
 * this, so an unverified address can never claim an `ADMIN_EMAILS` entry.
 */
function verifiedPrimaryEmail(data: ClerkUserPayload): string | null {
  const primary = (data.email_addresses ?? []).find(
    (address) => address.id === data.primary_email_address_id,
  );
  return primary?.verification?.status === "verified"
    ? primary.email_address.toLowerCase()
    : null;
}

/** Project one Clerk user payload onto the local `users` row. */
async function syncUser(
  data: ClerkUserPayload,
  isCreate: boolean,
): Promise<void> {
  const store = getStore();
  const email = primaryEmail(data);
  await store.upsertUser({
    clerkUserId: data.id,
    email,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url || null,
    // Bootstrap admins from the allowlist on first sight only. After that the
    // role is managed in the admin console and a webhook must not reset it.
    ...(isCreate
      ? {
          role: isAdminEmail(verifiedPrimaryEmail(data))
            ? ("admin" as const)
            : ("member" as const),
        }
      : {}),
    clerkUpdatedAt: new Date(data.updated_at),
  });
}

export const runtime = "nodejs";

/**
 * Receive a Clerk webhook. Always answers with a small, generic body so no
 * internal detail is reflected to the caller.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    // Without a signing secret we cannot verify anything, so we refuse rather
    // than trusting an unsigned body.
    return Response.json({ ok: false }, { status: 503 });
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const deliveryId =
    webhookId(request) ?? `${event.type}:${event.timestamp}:${event.instance_id}`;

  if (await alreadyProcessed(deliveryId)) {
    return Response.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await syncUser(event.data, event.type === "user.created");
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (!clerkUserId) break;
        const store = getStore();
        const existing = await store.getUserByClerkId(clerkUserId);
        if (existing) {
          await store.updateUser(existing.id, { deletedAt: new Date() });
        }
        break;
      }

      default:
        // Other event families are acknowledged and ignored: an unhandled type
        // must not cause an infinite retry loop.
        break;
    }
  } catch (error) {
    // Log only the shape of the failure, never the payload.
    console.error(
      `[clerk-webhook] failed to process ${event.type}:`,
      error instanceof Error ? error.message : "unknown error",
    );
    // Not marked processed, so Svix's retry can succeed later.
    return Response.json({ ok: false }, { status: 500 });
  }

  await markProcessed(
    deliveryId,
    event.type,
    event as unknown as Record<string, unknown>,
  );

  return Response.json({ ok: true });
}
