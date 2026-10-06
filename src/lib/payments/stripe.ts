/**
 * Stripe client + the canonical tier catalogue.
 *
 * Two rules shape this module:
 *
 *  1. **Nothing throws at import time.** `next build` evaluates server modules
 *     with no secrets present, so the client is constructed lazily and
 *     `getStripe()` simply returns `null` when `STRIPE_SECRET_KEY` is unset.
 *     Callers branch on `null`/`isStripeConfigured()` and render an honest
 *     "billing is not configured on this deployment" state.
 *  2. **Prices live in one place.** `TIERS` mirrors `TIER_SEED` in the schema
 *     (same slugs, names, prices, and features) and adds the Stripe Price id
 *     that is read from the environment. The database is never the source of a
 *     Price id — a dashboard/env value is.
 */

import Stripe from "stripe";

import type { TierKey } from "@/lib/db/schema";

/**
 * A purchasable tier as the application understands it.
 *
 * `interval` is `null` for the free tier (nothing is billed) and `"month"` for
 * every paid tier. `stripePriceId` is `null` when the matching environment
 * variable is unset, which is what makes a deploy without secrets still boot.
 */
export interface TierDefinition {
  /** Canonical tier key; matches the `tier` enum in the database. */
  slug: TierKey;
  /** Human name shown on pricing and billing surfaces. */
  name: string;
  /** One-line description of who the tier is for. */
  description: string;
  /** Price in the smallest currency unit (cents for USD). `0` for free. */
  priceCents: number;
  /** Billing cadence, or `null` when the tier is never billed. */
  interval: "month" | null;
  /** Capability strings, kept in sync with `TIER_SEED`. */
  features: string[];
  /** Sort position; lower comes first. */
  displayOrder: number;
  /** Stripe Price id from the environment, or `null` when unconfigured. */
  stripePriceId: string | null;
}

/** Read a trimmed, non-empty environment variable or return `null`. */
function envValue(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The four Cipher tiers, in display order.
 *
 * Prices and features are intentionally duplicated from `TIER_SEED` rather than
 * derived from it: the seed is the database projection, this is the billing
 * projection, and a compile-time literal here cannot be reshaped by a runtime
 * import order surprise.
 */
export const TIERS: readonly TierDefinition[] = [
  {
    slug: "free",
    name: "Threshold",
    description: "Public essays and the community front door.",
    priceCents: 0,
    interval: null,
    features: ["community.read", "flashcards.limit", "courses.free"],
    displayOrder: 0,
    stripePriceId: null,
  },
  {
    slug: "initiate",
    name: "Initiate",
    description:
      "The base membership: full community, weekly calls, courses.",
    priceCents: 1500,
    interval: "month",
    features: [
      "community.post",
      "dm.access",
      "livecalls.access",
      "courses.all",
      "flashcards.unlimited",
    ],
    displayOrder: 1,
    stripePriceId: envValue("STRIPE_PRICE_INITIATE"),
  },
  {
    slug: "adept",
    name: "Adept",
    description: "Everything in Initiate plus deeper practitioner material.",
    priceCents: 2900,
    interval: "month",
    features: [
      "community.post",
      "dm.access",
      "livecalls.access",
      "livecalls.recordings",
      "courses.all",
      "flashcards.unlimited",
      "readings.extended",
    ],
    displayOrder: 2,
    stripePriceId: envValue("STRIPE_PRICE_ADEPT"),
  },
  {
    slug: "oracle",
    name: "Oracle",
    description: "The top tier: coaching, early access, and member readings.",
    priceCents: 5900,
    interval: "month",
    features: [
      "community.post",
      "dm.access",
      "livecalls.access",
      "livecalls.recordings",
      "courses.all",
      "flashcards.unlimited",
      "readings.extended",
      "coaching.1on1",
      "earlyaccess.all",
    ],
    displayOrder: 3,
    stripePriceId: envValue("STRIPE_PRICE_ORACLE"),
  },
];

/** Every tier that can actually be checked out (excludes the free tier). */
export const PAID_TIERS: readonly TierDefinition[] = TIERS.filter(
  (tier) => tier.priceCents > 0,
);

/** The lazy Stripe singleton. `undefined` means "not attempted yet". */
let cachedClient: Stripe | null | undefined;

/**
 * The shared Stripe client, or `null` when `STRIPE_SECRET_KEY` is unset.
 *
 * Constructed once per process on first use. Never throws: an unset key, a
 * blank key, or a constructor failure all resolve to `null` so the app builds
 * and renders without secrets.
 */
export function getStripe(): Stripe | null {
  if (cachedClient !== undefined) return cachedClient;

  const key = envValue("STRIPE_SECRET_KEY");
  if (!key) {
    cachedClient = null;
    return cachedClient;
  }

  try {
    cachedClient = new Stripe(key, {
      typescript: true,
      maxNetworkRetries: 2,
    });
  } catch {
    cachedClient = null;
  }
  return cachedClient;
}

/** Whether a usable Stripe client exists on this deployment. */
export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

/** Look up a tier definition by its slug. */
export function getTier(slug: TierKey): TierDefinition | null {
  return TIERS.find((tier) => tier.slug === slug) ?? null;
}

/**
 * Map a Stripe Price id back to a Cipher tier.
 *
 * Returns `null` for an unknown or missing price so a caller can decide to keep
 * the member's current tier rather than silently downgrading them.
 */
export function tierFromPriceId(
  priceId: string | null | undefined,
): TierKey | null {
  if (!priceId) return null;
  const match = TIERS.find((tier) => tier.stripePriceId === priceId);
  return match ? match.slug : null;
}

/**
 * The ordinal rank of a tier, used for "at least this tier" capability checks.
 *
 * Unknown or missing tiers rank `-1`, i.e. below `free` (rank `0`), so an
 * unrecognised value can never accidentally grant access.
 */
export function tierRank(tier: TierKey | null | undefined): number {
  if (!tier) return -1;
  const match = TIERS.find((candidate) => candidate.slug === tier);
  return match ? match.displayOrder : -1;
}

/**
 * Whether `memberTier` includes everything `requiredTier` includes.
 *
 * A `null`/`undefined` requirement means "any approved member", which is how
 * `tiers_required` is modelled as nullable in the database.
 */
export function hasTierAccess(
  memberTier: TierKey | null | undefined,
  requiredTier: TierKey | null | undefined,
): boolean {
  if (!requiredTier) return true;
  return tierRank(memberTier) >= tierRank(requiredTier);
}
