/**
 * `POST /api/kp/relocate` — the KP chart of a shared birth moment, relocated.
 *
 * Body: `{ code, latitude, longitude }`. The share code carries the verified
 * birth moment (including any DST choice and the node type), so this needs no
 * account. Placidus-undefined latitudes are refused like any KP chart.
 */

import { z } from "zod";
import { relocate } from "@/lib/astrocartography/relocate";
import { decodeBirthInput } from "@/lib/cipher/share-code";
import { clientIp } from "@/lib/http/client-ip";
import { resolveKpBirth } from "@/lib/kp/chart";
import { KpHouseError } from "@/lib/kp/positions";

const bodySchema = z.object({
  code: z.string().min(8).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const RATE_LIMIT_MS = 250;
const lastRequestAt = new Map<string, number>();

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request);
  const now = Date.now();
  if (now - (lastRequestAt.get(ip) ?? 0) < RATE_LIMIT_MS) {
    return Response.json({ ok: false, error: "Too many requests; slow down a little." }, { status: 429 });
  }
  if (lastRequestAt.size > 5000) lastRequestAt.clear();
  lastRequestAt.set(ip, now);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Send a share code, latitude and longitude." }, { status: 400 });
  }
  const decoded = decodeBirthInput(parsed.data.code);
  if (!decoded) {
    return Response.json({ ok: false, error: "That chart code does not decode." }, { status: 400 });
  }
  try {
    const birth = resolveKpBirth(decoded.input);
    return Response.json({
      ok: true,
      relocated: relocate(birth.date, parsed.data.latitude, parsed.data.longitude, decoded.input.nodeType),
    });
  } catch (error) {
    if (error instanceof KpHouseError || error instanceof RangeError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    return Response.json({ ok: false, error: "The chart could not be relocated." }, { status: 500 });
  }
}
