/**
 * `pnpm db:seed` — reference data a fresh database needs. Idempotent.
 *
 * - The four membership tiers (other tables reference `tiers.key`, so rooms,
 *   courses, decks and subscriptions cannot be created until these exist).
 *   Existing rows are updated to the current names, prices and features.
 * - The Starseed Collective's rooms.
 *
 * Reads DATABASE_URL from the environment or .env.local / .env.
 */

import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

const { db } = await import("../src/lib/db/client.ts");
const { tiers, TIER_SEED } = await import("../src/lib/db/schema.ts");
const { getStore } = await import("../src/lib/db/store.ts");
const { COLLECTIVE_ROOMS, ensureCollectiveRooms } = await import("../src/lib/community/rooms.ts");

if (!db) {
  console.error("The database client could not be created from DATABASE_URL.");
  process.exit(1);
}

for (const seed of TIER_SEED) {
  const values = {
    key: seed.key,
    name: seed.name,
    description: seed.description ?? null,
    monthlyPriceCents: seed.monthlyPriceCents ?? 0,
    annualPriceCents: seed.annualPriceCents ?? null,
    currency: seed.currency ?? "usd",
    features: seed.features ?? [],
    displayOrder: seed.displayOrder ?? 0,
  };
  await db
    .insert(tiers)
    .values(values)
    .onConflictDoUpdate({ target: tiers.key, set: { ...values, updatedAt: new Date() } });
}
console.log(`tiers: ${TIER_SEED.map((t) => `${t.key} ($${(t.monthlyPriceCents ?? 0) / 100})`).join(", ")}`);

const store = getStore();
await ensureCollectiveRooms(store);
const channels = await store.listChannels();
const missing = COLLECTIVE_ROOMS.filter((room) => !channels.some((c) => c.slug === room.slug));
console.log(`rooms: ${channels.map((c) => c.name).join(", ")}`);
if (missing.length) {
  console.error(`could not create: ${missing.map((r) => r.slug).join(", ")}`);
  process.exit(1);
}
