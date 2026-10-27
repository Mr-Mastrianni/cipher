/** Shared avatar contract for the world and the 2D profile. */

import type { AvatarForm } from "@/world/state";

export interface MemberAvatar {
  name: string;
  color: string;
  form: AvatarForm;
  crest: string;
}

export const AVATAR_FORM_IDS: readonly AvatarForm[] = ["cloak", "orb", "wanderer"];

export const DEFAULT_AVATAR: MemberAvatar = {
  name: "A traveller",
  color: "#d4ff3f",
  form: "cloak",
  crest: "\u2726",
};

export function isAvatarForm(value: unknown): value is AvatarForm {
  return value === "cloak" || value === "orb" || value === "wanderer";
}

/** Sanitise a partial avatar over a fallback. */
export function sanitizeAvatar(value: unknown, fallback: MemberAvatar = DEFAULT_AVATAR): MemberAvatar {
  const source = (value ?? {}) as Record<string, unknown>;
  const color = String(source.color ?? "");
  const name = String(source.name ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 32);
  const crest = String(source.crest ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 4);
  return {
    name: name || fallback.name,
    color: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback.color,
    form: isAvatarForm(source.form) ? source.form : fallback.form,
    crest: crest || fallback.crest,
  };
}
