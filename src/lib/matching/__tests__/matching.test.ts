/** Cosmic matching: scoring rules and the seeded demo pool end to end. */

import test from "node:test";
import assert from "node:assert/strict";
import { scoreMatch, type MatchFeatures } from "../score";

const base = (over: Partial<MatchFeatures>): MatchFeatures => ({ userId: "x", interests: [], hd: null, kp: null, ...over });

test("score: interests, electromagnetic, companionship and KP resonance each add a reason", () => {
  const a = base({
    userId: "a",
    interests: ["kp-timing", "starseed", "creative"],
    hd: { type: "Generator", profile: "2/4", gates: [34, 20, 59, 1], channels: ["20-34"] },
    kp: { moonNakshatra: "Rohini", moonStarLord: "moon", lagnaRasi: "Tula", mahadasha: "jupiter" },
  });
  const b = base({
    userId: "b",
    interests: ["kp-timing", "starseed"],
    hd: { type: "Projector", profile: "5/1", gates: [34, 20, 6, 8], channels: ["20-34"] },
    kp: { moonNakshatra: "Rohini", moonStarLord: "moon", lagnaRasi: "Mesha", mahadasha: "jupiter" },
  });
  const result = scoreMatch(a, b);
  const strands = result.reasons.map((r) => r.strand);
  assert.ok(strands.includes("interests"));
  assert.ok(result.reasons.some((r) => r.text.startsWith("Electromagnetic") && r.text.includes("1-8")));
  assert.ok(result.reasons.some((r) => r.text.startsWith("Electromagnetic") && r.text.includes("6-59")));
  assert.ok(result.reasons.some((r) => r.text.startsWith("Companionship") && r.text.includes("20-34")));
  assert.ok(result.reasons.some((r) => r.strand === "kp" && r.text.includes("Rohini") && r.text.includes("Jupiter")));
  assert.ok(result.score > 0 && result.score <= 100);
  // Symmetric.
  assert.equal(scoreMatch(b, a).score, result.score);
});

test("score: nothing in common scores zero with no reasons", () => {
  const result = scoreMatch(base({ interests: ["research"] }), base({ interests: ["healing"] }));
  assert.equal(result.score, 0);
  assert.equal(result.reasons.length, 0);
});

test("pool: the seeded opted-in members are matchable from their birth data", async () => {
  delete process.env.DATABASE_URL;
  const { getStore } = await import("../../db/store");
  const { featuresFor } = await import("../features");
  const store = getStore();
  const pool = await store.listMatchingProfiles();
  assert.ok(pool.length >= 4, `pool has ${pool.length}`);
  const mira = await store.getUserByClerkId("user_demo_member");
  assert.ok(mira && !mira.matchingOptIn, "the demo member starts opted out");
  assert.ok(!pool.some((entry) => entry.user.id === mira!.id), "opted-out members are never in the pool");
  for (const entry of pool) {
    const features = featuresFor(entry.user, entry.profile, new Date("2026-10-06T00:00:00Z"));
    assert.ok(features.kp?.moonNakshatra, `${entry.user.displayName} has KP features`);
    assert.ok(features.hd?.gates.length, `${entry.user.displayName} has HD features`);
    assert.ok(features.kp?.mahadasha, `${entry.user.displayName} has a running mahadasha`);
  }
});
