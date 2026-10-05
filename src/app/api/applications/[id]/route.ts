import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleAuthError, requireAdmin } from "@/lib/auth";
import type { TierKey } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";

/**
 * Decide one membership application.
 *
 * Approval is the moment a person becomes a member, so it does three things in
 * order: transition the application, mirror `membershipStatus: "approved"` and
 * the applied-for tier onto the user, then write an audit entry describing the
 * transition. The audit write is not optional — `before`/`after` is the only
 * record of who granted what, and when.
 */

const TIERS = ["free", "initiate", "adept", "oracle"] as const;

const decisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().max(2000).optional(),
});

function isTier(value: unknown): value is TierKey {
  return (
    typeof value === "string" && (TIERS as readonly string[]).includes(value)
  );
}

/** The tier an applicant asked for, falling back to the base paid tier. */
function appliedTier(answers: Record<string, unknown>): TierKey {
  return isTier(answers.tier) ? answers.tier : "initiate";
}

/** Approve or deny an application. Admin only. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/applications/[id]">,
): Promise<Response> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Expected { decision: \"approve\" | \"deny\", note?: string }.",
      },
      { status: 400 },
    );
  }

  const store = getStore();

  // Snapshot the prior state for the audit trail. The store has no by-id
  // getter, so the (small) list is scanned rather than adding one.
  const before =
    (await store.listApplications()).find((application) => application.id === id) ??
    null;
  if (!before) {
    return Response.json(
      { ok: false, error: "That application no longer exists." },
      { status: 404 },
    );
  }

  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;
  const application =
    parsed.data.decision === "approve"
      ? await store.approveApplication(id, admin.id, note)
      : await store.denyApplication(id, admin.id, note);

  if (!application) {
    return Response.json(
      { ok: false, error: "That application no longer exists." },
      { status: 404 },
    );
  }

  let grantedTier: TierKey | null = null;
  if (parsed.data.decision === "approve") {
    grantedTier = appliedTier(application.answers as Record<string, unknown>);
    await store.updateUser(application.userId, {
      membershipStatus: "approved",
      tier: grantedTier,
    });
  }

  await store.recordAuditLog({
    actorUserId: admin.id,
    action:
      parsed.data.decision === "approve"
        ? "membership.approve"
        : "membership.deny",
    targetType: "application",
    targetId: application.id,
    before: { status: before.status },
    after: {
      status: application.status,
      tier: grantedTier ?? undefined,
    },
    metadata: {
      applicantUserId: application.userId,
      note,
    },
  });

  return Response.json({ ok: true, application, tier: grantedTier });
}
