/**
 * `/api/locations` — a member's saved places from the astrocartography map.
 *
 * GET lists them; POST saves one (with an optional note and the relocated KP
 * snapshot computed here from the share code, never trusted from the client);
 * DELETE `?id=` removes one of the caller's own.
 */

import { z } from "zod";
import { handleAuthError, requireUser } from "@/lib/auth";
import { relocate } from "@/lib/astrocartography/relocate";
import { decodeBirthInput } from "@/lib/cipher/share-code";
import { getStore } from "@/lib/db/store";
import { resolveKpBirth } from "@/lib/kp/chart";

const MAX_LOCATIONS = 100;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  note: z.string().trim().max(2000).optional(),
  /** The chart the place was explored for; used to compute the snapshot. */
  code: z.string().min(8).max(200).optional(),
});

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json({ ok: true, locations: await getStore().listSavedLocations(user.id) });
  } catch (error) {
    return handleAuthError(error) ?? Response.json({ ok: false, error: "Could not load your places." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ ok: false, error: "A place needs a name and valid coordinates." }, { status: 400 });
    }
    const store = getStore();
    if ((await store.listSavedLocations(user.id)).length >= MAX_LOCATIONS) {
      return Response.json({ ok: false, error: `You can keep up to ${MAX_LOCATIONS} places.` }, { status: 409 });
    }

    let snapshot: Record<string, unknown> | null = null;
    const decoded = parsed.data.code ? decodeBirthInput(parsed.data.code) : null;
    if (decoded) {
      try {
        const birth = resolveKpBirth(decoded.input);
        snapshot = {
          code: parsed.data.code,
          ...relocate(birth.date, parsed.data.latitude, parsed.data.longitude, decoded.input.nodeType),
        };
      } catch {
        // A place can still be saved where Placidus is undefined; it just has no KP snapshot.
      }
    }

    const location = await store.createSavedLocation({
      userId: user.id,
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      note: parsed.data.note || null,
      snapshot,
    });
    return Response.json({ ok: true, location }, { status: 201 });
  } catch (error) {
    return handleAuthError(error) ?? Response.json({ ok: false, error: "Could not save that place." }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ ok: false, error: "Which place?" }, { status: 400 });
    const deleted = await getStore().deleteSavedLocation(id, user.id);
    return deleted
      ? Response.json({ ok: true })
      : Response.json({ ok: false, error: "Place not found." }, { status: 404 });
  } catch (error) {
    return handleAuthError(error) ?? Response.json({ ok: false, error: "Could not delete that place." }, { status: 500 });
  }
}
