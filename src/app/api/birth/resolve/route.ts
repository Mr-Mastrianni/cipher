/**
 * `POST /api/birth/resolve` — the birth-time verification step.
 *
 * Resolves a wall-clock birth moment to the exact UTC instant and reports what
 * the person must confirm before a KP chart is cast: the zone, its UTC offset
 * and abbreviation, whether daylight saving was in force, and — when the local
 * time occurred twice — both candidate instants to choose between. Nothing is
 * charted here.
 */

import { DateTime } from "luxon";
import { resolveBirthInstantDetailed } from "@/lib/astronomy/time";
import { describeIssue, kpBirthSchema } from "@/lib/kp/birth-schema";
import { resolveKpBirth } from "@/lib/kp/chart";

function describe(utcMillis: number, zone: string) {
  const local = DateTime.fromMillis(utcMillis, { zone });
  const minutes = local.offset;
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  return {
    utc: new Date(utcMillis).toISOString(),
    local: local.toISO({ suppressMilliseconds: true, includeOffset: false }),
    utcOffset: `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`,
    abbreviation: local.offsetNameShort ?? "",
    isDst: local.isInDST,
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "The request body must be JSON." }, { status: 400 });
  }
  const parsed = kpBirthSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: describeIssue(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  try {
    // Probe both resolutions: if they differ, the local time is ambiguous.
    const earlier = resolveBirthInstantDetailed(input, { fold: "earlier" });
    const later = resolveBirthInstantDetailed(input, { fold: "later" });
    const ambiguous = earlier.date.getTime() !== later.date.getTime();
    if (ambiguous && !input.fold) {
      return Response.json({
        ok: true,
        ambiguous: true,
        timeZone: input.timeZone,
        candidates: {
          earlier: describe(earlier.date.getTime(), input.timeZone),
          later: describe(later.date.getTime(), input.timeZone),
        },
      });
    }
    const resolved = resolveKpBirth(input);
    return Response.json({
      ok: true,
      ambiguous: false,
      timeZone: input.timeZone,
      fold: input.fold ?? null,
      resolved: describe(resolved.date.getTime(), input.timeZone),
      warnings: resolved.warnings,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "That birth moment could not be resolved." },
      { status: 400 },
    );
  }
}
