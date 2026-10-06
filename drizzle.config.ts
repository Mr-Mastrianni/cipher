import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Load DATABASE_URL from .env.local / .env like Next.js does, so `pnpm db:push`
// works without exporting it in the shell. Real environment variables win.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add your Postgres connection string to .env.local " +
      "(DATABASE_URL=postgresql://...) or run: DATABASE_URL=postgresql://... pnpm db:push",
  );
}

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
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
