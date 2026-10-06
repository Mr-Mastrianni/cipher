/**
 * Regression tests for the angles and formatting helpers.
 *
 * The Vertex reference is computed independently, by scanning the ecliptic for
 * the point that lies on the prime vertical west of the meridian.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { vertex } from "../houses";
import { formatLongitude } from "../zodiac";

const OBLIQUITY = 23.44;
const RAD = Math.PI / 180;

/** Brute-force Vertex: the western ecliptic point on the prime vertical. */
function referenceVertex(ramc: number, latitude: number): number {
  let best = 0;
  let bestError = Number.POSITIVE_INFINITY;
  for (let lambda = 0; lambda < 360; lambda += 0.005) {
    const declination = Math.asin(Math.sin(OBLIQUITY * RAD) * Math.sin(lambda * RAD));
    const ra = Math.atan2(
      Math.sin(lambda * RAD) * Math.cos(OBLIQUITY * RAD),
      Math.cos(lambda * RAD),
    );
    const hourAngle = ramc * RAD - ra;
    if (Math.sin(hourAngle) <= 0) continue; // east of the meridian
    const north =
      Math.cos(latitude * RAD) * Math.sin(declination) -
      Math.sin(latitude * RAD) * Math.cos(declination) * Math.cos(hourAngle);
    if (Math.abs(north) < bestError) {
      bestError = Math.abs(north);
      best = lambda;
    }
  }
  return best;
}

function angularDistance(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

test("vertex: matches the prime-vertical definition in both hemispheres", () => {
  const cases: [number, number][] = [
    [100, 40],
    [250, 51.5],
    [14, -20],
    [200, -33.9],
    [300, -37.8],
    [60, 10],
    [330, -60],
  ];
  for (const [ramc, latitude] of cases) {
    const got = vertex(ramc, OBLIQUITY, latitude);
    const want = referenceVertex(ramc, latitude);
    assert.ok(
      angularDistance(got, want) < 0.02,
      `RAMC ${ramc}, latitude ${latitude}: got ${got.toFixed(3)}, want ${want.toFixed(3)}`,
    );
  }
});

test("formatLongitude: rounding carries instead of printing 60 seconds", () => {
  // 12°34'59.8" Aries rounds to 12°35'.
  assert.equal(formatLongitude(12 + 34 / 60 + 59.8 / 3600), "12°35' Aries");
  // 29°59'59.9" Aries carries into the next sign.
  assert.equal(formatLongitude(29 + 59 / 60 + 59.9 / 3600), "0°00' Taurus");
});
