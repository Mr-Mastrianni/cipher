import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * Commands:
 *   pnpm exec drizzle-kit generate   # write SQL migrations from the schema
 *   pnpm exec drizzle-kit migrate    # apply migrations to DATABASE_URL
 *   pnpm exec drizzle-kit push       # push schema directly (dev only)
 *   pnpm exec drizzle-kit studio     # inspect the database
 *
 * `DATABASE_URL` is read from the environment at CLI runtime. Migrations are
 * generated into ./drizzle and should be applied in CI or a one-off script —
 * never from a serverless function.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
