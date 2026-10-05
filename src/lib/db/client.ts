/**
 * Lazily-created Drizzle client for Neon Postgres.
 *
 * Why this is written defensively:
 *  - `next build` imports server modules with no secrets present. If this file
 *    threw on a missing `DATABASE_URL`, the whole build would fail. It never
 *    throws — it exports `db = null` instead.
 *  - Vercel functions and Next dev hot-reload both re-evaluate modules, so the
 *    client is cached on `globalThis` to avoid a new Neon client per reload.
 *
 * The HTTP driver (`neon-http`) turns each query into an HTTPS call, so there
 * is no connection pool to exhaust in a serverless environment. If you later
 * need interactive transactions, swap in `drizzle-orm/neon-serverless` with the
 * pooled connection string here and nothing else changes.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/** The fully-typed Drizzle database handle. */
export type Database = NeonHttpDatabase<typeof schema>;

/** Shape of the hot-reload-safe global cache slot. */
interface DbGlobal {
  __cipherDb?: Database | null;
}

const globalForDb = globalThis as unknown as DbGlobal;

/**
 * Build a Neon HTTP Drizzle client, or return `null` when `DATABASE_URL` is
 * absent. Exported for tests; application code should use `db` / `getDb()`.
 */
export function createDatabaseClient(): Database | null {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") return null;

  const sql = neon(url);
  return drizzle(sql, { schema });
}

/**
 * The shared Drizzle client, or `null` when no database is configured.
 *
 * Always truth-check this before use, or call `getDb()` which throws a clear
 * message. The repository layer resolves the fallback for you.
 */
export const db: Database | null =
  globalForDb.__cipherDb !== undefined
    ? globalForDb.__cipherDb
    : (globalForDb.__cipherDb = createDatabaseClient());

/**
 * Whether a `DATABASE_URL` was present when this module was first evaluated.
 *
 * Read at import time, once, to match the cached `db` value.
 */
export function isDatabaseConfigured(): boolean {
  return db !== null;
}

/**
 * Return the Drizzle client, throwing a descriptive error when the database is
 * not configured. Use this in code paths that genuinely require Postgres.
 */
export function getDb(): Database {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not set. Check isDatabaseConfigured() or use getStore() for the in-memory fallback.",
    );
  }
  return db;
}
