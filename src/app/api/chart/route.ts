/**
 * `POST /api/chart` — compute a reading from a birth input.
 *
 * The heavy lifting lives in `@/lib/cipher/compute-reading`, which the
 * `/reading/[code]` server component calls as well: one pipeline, two entry
 * points. This route owns only the HTTP concerns — validation, rate limiting,
 * and turning a thrown `RangeError` into a 400 rather than a 500.
 *
 * It deliberately imports no database, no auth and no secrets, so a deployment
 * with nothing configured still computes and serves charts.
 */

import { z } from "zod";
import { computeReading, readingPayload } from "@/lib/cipher/compute-reading";

const RATE_LIMIT_MS = 1000;
const MAX_RATE_ENTRIES = 5000;

const lastRequestAt = new Map<string, number>();

/** Birth inputs are only meaningful for real people; the code format floors at
 * 1900, so the schema refuses anything the share code cannot represent. */
const MIN_YEAR = 1900;
const MAX_YEAR = 9999;

function isRealCalendarDate(value: {
  year: number;
  month: number;
  day: number;
}): boolean {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  return (
    date.getUTCFullYear() === value.year &&
    date.getUTCMonth() === value.month - 1 &&
    date.getUTCDate() === value.day
  );
}

/** The wire schema for a `BirthInput`. Not exported: Next validates the exports
 * of a route file, and only HTTP method handlers (plus segment config) belong
 * on it. */
const birthInputSchema = z
  .object({
    year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    second: z.number().int().min(0).max(59).optional(),
    timeZone: z.string().min(1).max(64),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    placeName: z.string().max(160).optional(),
  })
  .refine(isRealCalendarDate, {
    message: "That calendar date does not exist.",
    path: ["day"],
  });

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

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

  const parsed = birthInputSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "";
    const detail = issue?.message ?? "Invalid birth data.";
    return Response.json(
      { ok: false, error: path ? `${path}: ${detail}` : detail },
      { status: 400 },
    );
  }

  try {
    return Response.json(readingPayload(computeReading(parsed.data)));
  } catch (error) {
    // A RangeError here means an unknown IANA zone or an out-of-range field, so
    // it is the caller's input that is wrong — a 400, not a 500.
    const message =
      error instanceof Error
        ? error.message
        : "The chart could not be computed from that birth data.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
