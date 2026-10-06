/**
 * `/api/kp/horary` — KP horary (Prashna), an Adept feature.
 *
 * POST `{ number | null, category, question, latitude, longitude, timeZone,
 * nodeType? }` casts the horary chart for *now* at the given place, judges it
 * and records it. GET lists the caller's past questions.
 */

import { IANAZone } from "luxon";
import { z } from "zod";
import { AuthorizationError, handleAuthError, requireMember, requireTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { runningPeriods } from "@/lib/kp/dasha";
import { HORARY_CATEGORY_BY_ID, horaryChart, judgeHorary } from "@/lib/kp/horary";
import { KpHouseError } from "@/lib/kp/positions";
import { horaryToView, period } from "@/lib/kp/view";

const bodySchema = z.object({
  number: z.number().int().min(1).max(249).nullable(),
  category: z.string().refine((id) => HORARY_CATEGORY_BY_ID.has(id), "Unknown question type."),
  question: z.string().trim().min(3).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timeZone: z.string().refine((zone) => IANAZone.isValidZone(zone), "Unknown time zone."),
  nodeType: z.enum(["mean", "true"]).optional(),
});

const lastAskedAt = new Map<string, number>();
const MIN_INTERVAL_MS = 3000;

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember();
    requireTier(user, "adept", "KP horary");

    const now = Date.now();
    if (now - (lastAskedAt.get(user.id) ?? 0) < MIN_INTERVAL_MS) {
      return Response.json({ ok: false, error: "One question at a time — wait a moment." }, { status: 429 });
    }
    lastAskedAt.set(user.id, now);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the question details." }, { status: 400 });
    }
    const input = parsed.data;
    const at = new Date(now);
    const chart = horaryChart({ ...input, at });
    const judgement = judgeHorary(chart, input.category);
    const view = horaryToView(chart, runningPeriods(chart.dasha, at).map((p) => period(p, 1)));

    const record = await getStore().createHoraryQuestion({
      userId: user.id,
      number: input.number,
      category: input.category,
      question: input.question,
      askedAt: at,
      latitude: input.latitude,
      longitude: input.longitude,
      timeZone: input.timeZone,
      nodeType: chart.nodeType,
      verdict: judgement.verdict,
      snapshot: JSON.parse(JSON.stringify({ judgement, view })) as Record<string, unknown>,
    });

    return Response.json({ ok: true, id: record.id, judgement, view });
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error) as Response;
    if (error instanceof KpHouseError || error instanceof RangeError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    return Response.json({ ok: false, error: "The horary chart could not be cast." }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  try {
    const user = await requireMember();
    const rows = await getStore().listHoraryQuestions(user.id, 50);
    return Response.json({
      ok: true,
      questions: rows.map((row) => ({
        id: row.id,
        number: row.number,
        category: row.category,
        question: row.question,
        askedAt: row.askedAt.toISOString(),
        verdict: row.verdict,
        snapshot: row.snapshot,
      })),
    });
  } catch (error) {
    return handleAuthError(error) ?? Response.json({ ok: false, error: "Could not load your questions." }, { status: 500 });
  }
}
