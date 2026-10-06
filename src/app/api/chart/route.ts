/**
 * `POST /api/chart` — compute a reading from a birth input.
 *
 * The heavy lifting lives in `@/lib/cipher/compute-reading`, which the
 * `/reading/[code]` server component calls as well: one pipeline, two entry
 * points. This route owns only the HTTP concerns — validation (birth time to
 * the second, required), rate limiting, and mapping refusals: an ambiguous
 * local time is a 409 asking the person to choose, bad input is a 400.
 *
 * It deliberately imports no database, no auth and no secrets, so a deployment
 * with nothing configured still computes and serves charts.
 */

import { computeReading, readingPayload } from "@/lib/cipher/compute-reading";
import { AmbiguousBirthTimeError } from "@/lib/kp/chart";
import { KpHouseError } from "@/lib/kp/positions";
import { describeIssue, kpBirthSchema } from "@/lib/kp/birth-schema";
import { clientIp } from "@/lib/http/client-ip";

const RATE_LIMIT_MS = 1000;
const MAX_RATE_ENTRIES = 5000;

const lastRequestAt = new Map<string, number>();

/** Birth inputs are only meaningful for real people; the code format floors at
 * 1900, so the schema refuses anything the share code cannot represent. */
/** Per-IP courtesy limit; see the geocode route for why it is in-memory only. */
function allowRequest(ip: string): boolean {
  const now = Date.now();
  if (lastRequestAt.size > MAX_RATE_ENTRIES) {
    for (const [key, at] of lastRequestAt) {
      if (now - at > RATE_LIMIT_MS * 60) lastRequestAt.delete(key);
    }
  }
  const previous = lastRequestAt.get(ip);
  if (previous !== undefined && now - previous < RATE_LIMIT_MS) return false;
  lastRequestAt.set(ip, now);
  return true;
}

/**
 * Compute a chart, bodygraph, avatar and placement.
 *
 * @param request - JSON body matching the `BirthInput` schema.
 * @returns `{ ok: true, code, chart, bodygraph, avatar, category, warnings }`
 *   on success; `{ ok: false, error }` with 400 for invalid data or 429 when
 *   rate limited. Dates inside the payload serialise to ISO-8601 strings.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request);
  if (!allowRequest(ip)) {
    return Response.json(
      { ok: false, error: "One chart per second, please. Try again in a moment." },
      { status: 429, headers: { "Retry-After": "1" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "The request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = kpBirthSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: describeIssue(parsed.error) }, { status: 400 });
  }

  try {
    return Response.json(readingPayload(computeReading(parsed.data)));
  } catch (error) {
    // An ambiguous local time must be resolved by the person, never guessed.
    if (error instanceof AmbiguousBirthTimeError) {
      return Response.json(
        { ok: false, needsFold: true, error: error.message },
        { status: 409 },
      );
    }
    // Invalid moments, DST gaps and polar latitudes are the caller's input.
    if (error instanceof RangeError || error instanceof KpHouseError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    return Response.json(
      { ok: false, error: "The chart could not be computed." },
      { status: 500 },
    );
  }
}
