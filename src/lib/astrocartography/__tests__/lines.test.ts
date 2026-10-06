/**
 * Astrocartography lines, checked against an independent horizon computation
 * from astronomy-engine (`Equator` + `Horizon` for an observer on the line).
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as Astronomy from "astronomy-engine";
import { astrocartography, distanceToLineKm, linesFor } from "../lines";

const BIRTH = new Date("1990-07-15T09:00:09Z");

function altitudeAzimuth(body: Astronomy.Body, date: Date, lat: number, lon: number) {
  // Geocentric (elevation 0, parallax ignored by using the geocentric RA/Dec),
  // matching the astrocartography convention.
  const observer = new Astronomy.Observer(lat, lon, 0);
  const eq = Astronomy.Equator(body, date, new Astronomy.Observer(0, 0, -6_378_137), true, true);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec);
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

test("lagna and 7th lines put the graha on the horizon, rising and setting", () => {
  for (const [graha, body] of [["sun", Astronomy.Body.Sun], ["saturn", Astronomy.Body.Saturn], ["venus", Astronomy.Body.Venus]] as const) {
    const [, , lagna, seventh] = linesFor(graha, BIRTH);
    for (const [line, east] of [[lagna, true], [seventh, false]] as const) {
      for (const segment of line.segments) {
        for (const [lon, lat] of segment.filter((_, i) => i % 15 === 0)) {
          const { altitude, azimuth } = altitudeAzimuth(body, BIRTH, lat, lon);
          assert.ok(Math.abs(altitude) < 0.05, `${graha} ${line.angle} at ${lat},${lon}: altitude ${altitude}`);
          assert.equal(azimuth < 180, east, `${graha} ${line.angle} azimuth ${azimuth}`);
        }
      }
    }
  }
});

test("10th line is the meridian where the graha culminates", () => {
  const [tenth, fourth] = linesFor("jupiter", BIRTH);
  const lon = tenth.segments[0][0][0];
  const { azimuth } = altitudeAzimuth(Astronomy.Body.Jupiter, BIRTH, 0, lon);
  // On the equator a culminating body is due north or south.
  assert.ok(Math.min(Math.abs(azimuth - 180), Math.abs(azimuth), Math.abs(azimuth - 360)) < 0.05);
  assert.ok(Math.abs(((fourth.segments[0][0][0] - lon + 540) % 360) - 180) > 179.99);
});

test("all nine grahas yield four lines; distance lookup finds a point on a line", () => {
  const lines = astrocartography(BIRTH);
  assert.equal(lines.length, 36);
  const lagna = lines.find((l) => l.graha === "moon" && l.angle === "lagna")!;
  const [lon, lat] = lagna.segments[0][Math.floor(lagna.segments[0].length / 2)];
  assert.ok(distanceToLineKm(lagna, lat, lon) < 1);
});
