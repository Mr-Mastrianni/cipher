/**
 * The billing tiers and the database seed are deliberately duplicated, so this
 * test is what keeps them from drifting apart again.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TIER_SEED } from "../../db/schema";
import { TIERS } from "../stripe";

test("billing tiers match the database seed (names and prices)", () => {
  assert.equal(TIERS.length, TIER_SEED.length);
  for (const seed of TIER_SEED) {
    const billing = TIERS.find((tier) => tier.slug === seed.key);
    assert.ok(billing, `billing tier for ${seed.key}`);
    assert.equal(billing.name, seed.name, `${seed.key} name`);
    assert.equal(billing.priceCents, seed.monthlyPriceCents, `${seed.key} price`);
  }
});
