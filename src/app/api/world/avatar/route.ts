/**
 * `/api/world/avatar`
 *
 * The member's saved appearance for the world: a name, silhouette, colour and
 * crest. No image is uploaded. The 2D profile reads the same row through the
 * server page, so the avatar follows the member across devices.
 */

import { handleAuthError, requireMember } from "@/lib/auth";
import { getMemberAvatar, saveMemberAvatar } from "@/lib/world/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const user = await requireMember();
    const avatar = await getMemberAvatar(user.id);
    return Response.json({ ok: true, avatar }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load the avatar." }, { status: 500 })
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await requireMember();
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return Response.json({ ok: false, error: "An avatar is required." }, { status: 400 });
    }
    const avatar = await saveMemberAvatar(user.id, payload);
    return Response.json(
      { ok: true, avatar },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not save the avatar." }, { status: 500 })
    );
  }
}
