import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { RsvpStatus } from "@/lib/db/schema";

/**
 * `/api/calls/[id]/rsvp`
 *
 * Toggle (or explicitly set) the calling member's RSVP to a live call.
 *
 * Only approved members reach this route at all — `requireMember` rejects
 * applicants — which is what keeps the attendance list members-only. The
 * payload accepts an explicit `status`; with no body it flips between `going`
 * and `declined`, which is what the single toggle button on the card does.
 */

const rsvpSchema = z.object({
  status: z.enum(["going", "maybe", "declined"]).optional(),
});

/**
 * Set or toggle an RSVP.
 *
 * @param request - Optional JSON body `{ status?: "going" | "maybe" | "declined" }`.
 * @param context - Route context carrying the call `id`.
 * @returns The resulting RSVP status and the call's `going` count.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/calls/[id]/rsvp">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    const call = await store.getCallById(id);
    if (!call) {
      return Response.json({ ok: false, error: "Call not found." }, { status: 404 });
    }

    let requested: RsvpStatus | undefined;
    // A toggle button sends no body; an explicit picker sends one. Both are
    // valid, so an empty body is not a 400.
    const raw = await request.text();
    if (raw.trim().length > 0) {
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
      }
      const parsed = rsvpSchema.safeParse(payload);
      if (!parsed.success) {
        return Response.json(
          { ok: false, error: "Status must be going, maybe or declined." },
          { status: 400 },
        );
      }
      requested = parsed.data.status;
    }

    let next: RsvpStatus = requested ?? "going";
    if (!requested) {
      const existing = await store.listRsvps(id);
      const mine = existing.find((rsvp) => rsvp.userId === user.id);
      next = mine && mine.status === "going" ? "declined" : "going";
    }

    const saved = await store.rsvpCall(id, user.id, next);
    const rsvps = await store.listRsvps(id);

    await store.recordAuditLog({
      actorUserId: user.id,
      action: "call.rsvp",
      targetType: "live_call",
      targetId: id,
      after: { status: saved.status },
    });

    return Response.json({
      ok: true,
      status: saved.status,
      goingCount: rsvps.filter((rsvp) => rsvp.status === "going").length,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not update your RSVP." }, { status: 500 })
    );
  }
}
