/**
 * The member's saved world avatar.
 *
 * It lives in its own additive table so the world can follow a member across
 * devices without touching the Clerk projection or the existing users table.
 * The table is created idempotently on first use. In a no-database demo the
 * record is kept in this process, which is enough for the seeded demo member.
 */

import { neon } from "@neondatabase/serverless";

import {
  DEFAULT_AVATAR,
  sanitizeAvatar,
  type MemberAvatar,
} from "./avatar-shared";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const db = sql as unknown as
  | ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<Record<string, unknown>>>)
  | null;

const globalForAvatar = globalThis as unknown as {
  __cipherAvatarTable?: Promise<void>;
  __cipherAvatars?: Map<string, MemberAvatar>;
};

const memory = (globalForAvatar.__cipherAvatars ??= new Map<string, MemberAvatar>());

async function ensureTable(): Promise<void> {
  if (!db) return;
  if (!globalForAvatar.__cipherAvatarTable) {
    globalForAvatar.__cipherAvatarTable = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS cipher_member_avatars (
          user_id text PRIMARY KEY,
          name text NOT NULL,
          color text NOT NULL,
          form text NOT NULL,
          crest text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((error) => {
      globalForAvatar.__cipherAvatarTable = undefined;
      throw error;
    });
  }
  await globalForAvatar.__cipherAvatarTable;
}

export async function getMemberAvatar(userId: string): Promise<MemberAvatar | null> {
  if (!userId) return null;
  if (!db) return memory.get(userId) ?? null;
  await ensureTable();
  const rows = await db`
    SELECT name, color, form, crest
    FROM cipher_member_avatars
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return sanitizeAvatar(rows[0], DEFAULT_AVATAR);
}

export async function saveMemberAvatar(
  userId: string,
  value: unknown,
): Promise<MemberAvatar> {
  if (!userId) return sanitizeAvatar(value, DEFAULT_AVATAR);
  const current = (await getMemberAvatar(userId)) ?? DEFAULT_AVATAR;
  const avatar = sanitizeAvatar(value, current);
  if (!db) {
    memory.set(userId, avatar);
    return avatar;
  }
  await ensureTable();
  await db`
    INSERT INTO cipher_member_avatars (user_id, name, color, form, crest, updated_at)
    VALUES (${userId}, ${avatar.name}, ${avatar.color}, ${avatar.form}, ${avatar.crest}, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      color = EXCLUDED.color,
      form = EXCLUDED.form,
      crest = EXCLUDED.crest,
      updated_at = now()
  `;
  return avatar;
}
