/**
 * `/api/matching` — cosmic matching.
 *
 * GET: the caller's opt-in state and interests and, when opted in, their
 * strongest matches with the reasons behind each score. Only members who have
 * opted in are ever returned, and only derived signatures are exposed (Human
 * Design type and profile, KP Moon nakshatra and Lagna rasi) — never birth
 * dates, times or places.
 *
 * PATCH `{ optIn?, interests? }`: change the caller's own settings.
 */

import { z } from "zod";
import { handleAuthError, requireMember, userHasTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { findMatches } from "@/lib/matching/find";
import { MATCH_INTEREST_IDS } from "@/lib/matching/interests";

const MAX_RESULTS = 20;

const patchSchema = z.object({
  optIn: z.boolean().optional(),
  interests: z.array(z.string()).max(8).optional(),
});

export async function GET(): Promise<Response> {
  try {
    const user = await requireMember();
    const store = getStore();
    const base = { ok: true, optedIn: user.matchingOptIn, interests: user.interests ?? [] };
    if (!user.matchingOptIn) return Response.json({ ...base, matches: [] });

    const profile = await store.getBirthProfileByUser(user.id);
    if (!profile) {
      return Response.json({ ...base, matches: [], needsBirthProfile: true });
    }
    const matches = await findMatches(store, user, profile, MAX_RESULTS);

    return Response.json({ ...base, canMessage: userHasTier(user, "initiate"), matches });
  } catch (error) {
    return handleAuthError(error) ?? Response.json({ ok: false, error: "Matching is unavailable right now." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const user = await requireMember();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "Invalid settings." }, { status: 400 });
    const interests = parsed.data.interests?.filter((id) => MATCH_INTEREST_IDS.has(id));
    const updated = await getStore().updateUser(user.id, {
      ...(parsed.data.optIn !== undefined ? { matchingOptIn: parsed.data.optIn } : {}),
      ...(interests ? { interests: [...new Set(interests)] } : {}),
    });
    return Response.json({ ok: true, optedIn: updated?.matchingOptIn ?? false, interests: updated?.interests ?? [] });
  } catch (error) {
    return handleAuthError(error) ?? Response.json({ ok: false, error: "Could not save your matching settings." }, { status: 500 });
  }
}
