/** Persist the world avatar to the member's profile. */

import type { MemberAvatar } from "@/lib/world/avatar-shared";

export async function persistAvatar(avatar: MemberAvatar): Promise<boolean> {
  try {
    const response = await fetch("/api/world/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(avatar),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
