/**
 * KP engine tests.
 *
 * `swiss-ephemeris-fixtures.json` was generated with Swiss Ephemeris 2.10
 * (`swetest -sid5 -p0123456mt -house<lon>,<lat>,P`, full SE ephemeris files):
 * sidereal KP positions of the seven grahas, mean and true node, and the twelve
 * KP Placidus cusps for 16 charts from 1900 to 2049. The Swiss Ephemeris is
 * used only to produce these numbers; it is not a dependency of the app.
 */

import test from "node:test";
import assert from "node:assert/strict";

import fixtures from "./swiss-ephemeris-fixtures.json" with { type: "json" };
import { kpAyanamsaMean } from "../ayanamsa";
import { kpLords, kpSubTable } from "../lords";
import { KpHouseError, kpCusps, siderealLongitude } from "../positions";
import { runningPeriods, vimshottari } from "../dasha";
import { computeSignificators } from "../significators";
import { vedicDayLord } from "../ruling-planets";
import { AmbiguousBirthTimeError, computeKpChart } from "../chart";
import { DASHA_YEARS, type Graha } from "../constants";

const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

test("ayanamsa: mean KP ayanamsa matches the Swiss Ephemeris to 0.05″", () => {
  // UT instants whose TT is J1950.0 / J2000.0 / J2050.0 (ΔT applied by the engine).
  const cases: [string, number][] = [
    ["2000-01-01T11:58:56.170Z", 23 + 45 / 60 + 36.864 / 3600],
    ["2049-12-31T23:58:47.000Z", 24 + 27 / 60 + 31.539 / 3600],
  ];
  for (const [iso, expected] of cases) {
    assert.ok(arcsec(kpAyanamsaMean(new Date(iso)), expected) < 0.05, iso);
  }
});

test("positions: grahas, nodes and cusps match the Swiss Ephemeris", () => {
  for (const chart of fixtures) {
    const date = new Date(chart.utc);
    const future = date.getUTCFullYear() > 2026; // ΔT is a forecast beyond the IERS series
    for (const graha of ["sun", "mercury", "venus", "mars", "jupiter", "saturn"] as const) {
      const error = arcsec(siderealLongitude(graha, date, "mean"), chart.planets[graha]);
      assert.ok(error < 1.0, `${chart.name} ${graha}: ${error.toFixed(2)}″`);
    }
    const moonError = arcsec(siderealLongitude("moon", date, "mean"), chart.planets.moon);
    assert.ok(moonError < (future ? 5 : 1.0), `${chart.name} moon: ${moonError.toFixed(2)}″`);
    assert.ok(arcsec(siderealLongitude("rahu", date, "mean"), chart.planets.meanNode) < 0.5, `${chart.name} mean node`);
    assert.ok(arcsec(siderealLongitude("rahu", date, "true"), chart.planets.trueNode) < 0.5, `${chart.name} true node`);
    const cusps = kpCusps(date, chart.latitude, chart.longitude).cusps;
    chart.cusps.forEach((expected, i) => {
      assert.ok(arcsec(cusps[i], expected) < 0.1, `${chart.name} cusp ${i + 1}`);
    });
  }
});

test("lords: the generated KP sub table has the canonical 249 rows", () => {
  const table = kpSubTable();
  assert.equal(table.length, 249);
  const dms = (d: number) => Math.round(d * 3600);
  // Row 1: Aries 0°00′00″–0°46′40″, Mars / Ketu / Ketu.
  assert.deepEqual([dms(table[0].start), dms(table[0].end), table[0].signLord, table[0].starLord, table[0].subLord], [0, 2800, "mars", "ketu", "ketu"]);
  // Row 249: Pisces 27°53′20″–30°00′00″, Jupiter / Mercury / Saturn.
  const last = table[248];
  assert.deepEqual([dms(last.start), dms(last.end), last.signLord, last.starLord, last.subLord], [dms(357 + 53 / 60 + 20 / 3600), 360 * 3600, "jupiter", "mercury", "saturn"]);
  // Every row is non-empty and the rows tile the zodiac.
  for (let i = 0; i < table.length; i += 1) {
    assert.ok(table[i].end > table[i].start);
    if (i > 0) assert.equal(dms(table[i].start), dms(table[i - 1].end));
  }
});

test("lords: sign, star, sub and sub-sub lords at known longitudes", () => {
  // 0° Aries: Ketu's nakshatra (Ashwini), Ketu sub, Ketu sub-sub.
  assert.deepEqual(
    (({ signLord, starLord, subLord, subSubLord }) => ({ signLord, starLord, subLord, subSubLord }))(kpLords(0)),
    { signLord: "mars", starLord: "ketu", subLord: "ketu", subSubLord: "ketu" },
  );
  // 13°20′ starts Bharani (Venus) with a Venus sub.
  const bharani = kpLords(13 + 20 / 60);
  assert.equal(bharani.nakshatra.name, "Bharani");
  assert.equal(bharani.subLord, "venus");
  // Exactly on a boundary belongs to the later division: 0°46′40″ is the Venus sub.
  assert.equal(kpLords(46 / 60 + 40 / 3600).subLord, "venus");
  // A sub straddling a sign boundary: 29°59′ Aries and 0°01′ Taurus share star and sub lords.
  const end = kpLords(29 + 59 / 60);
  const start = kpLords(30 + 1 / 60);
  assert.equal(end.signLord, "mars");
  assert.equal(start.signLord, "venus");
  assert.equal(end.starLord, start.starLord);
  assert.equal(end.subLord, start.subLord);
});

test("dasha: balance, sequence and nesting follow Vimshottari", () => {
  const birth = new Date("2000-01-01T00:00:00Z");
  // Moon at 0°: the whole Ketu mahadasha is still to run.
  const start = vimshottari(0, birth, 2);
  assert.equal(start.birthLord, "ketu");
  assert.ok(Math.abs(start.balanceYears - 7) < 1e-9);
  // Moon halfway through Bharani (20°): half of Venus' 20 years remain.
  const mid = vimshottari(20, birth, 2);
  assert.equal(mid.birthLord, "venus");
  assert.ok(Math.abs(mid.balanceYears - 10) < 1e-9);
  // Nine mahadashas spanning exactly 120 years, each opening with its own bhukti.
  const span = mid.mahadashas.at(-1)!.end.getTime() - mid.mahadashas[0].start.getTime();
  assert.ok(Math.abs(span / (365.25 * 86_400_000) - 120) < 1e-9);
  for (const maha of mid.mahadashas) assert.equal(maha.children?.[0].lord, maha.lord);
  // Ketu–Ketu bhukti is 7 × 7 / 120 years.
  const kk = start.mahadashas[0].children![0];
  assert.ok(Math.abs((kk.end.getTime() - kk.start.getTime()) / (365.25 * 86_400_000) - (7 * 7) / 120) < 1e-9);
  // The running chain at birth starts with the birth lord.
  assert.equal(runningPeriods(vimshottari(20, birth, 3), birth)[0].lord, "venus");
  assert.equal(Object.values(DASHA_YEARS).reduce((a, b) => a + b, 0), 120);
});

test("significators: four levels and node agency", () => {
  const grahas: Graha[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
  const houseOf = Object.fromEntries(grahas.map((g) => [g, 12])) as Record<Graha, number>;
  houseOf.sun = 1;
  const starLordOf = Object.fromEntries(grahas.map((g) => [g, "saturn"])) as Record<Graha, Graha>;
  starLordOf.moon = "sun"; // Moon is in the Sun's star
  starLordOf.mars = "jupiter"; // Mars is in the star of house 1's lord
  const signLordOf = Object.fromEntries(grahas.map((g) => [g, "venus"])) as Record<Graha, Graha>;
  signLordOf.rahu = "sun"; // Rahu acts for the Sun
  const cuspSignLords = Array.from({ length: 12 }, () => "venus") as Graha[];
  cuspSignLords[0] = "jupiter";
  const { houses } = computeSignificators({ houseOf, starLordOf, signLordOf, cuspSignLords });
  const first = houses[0];
  assert.deepEqual(first.levels.A, ["moon"]); // in the star of the occupant (the Sun)
  assert.ok(first.levels.B.includes("sun"));
  assert.ok(first.levels.B.includes("rahu"), "Rahu signifies what its sign lord (the Sun) occupies");
  assert.deepEqual(first.levels.C, ["mars"]);
  assert.deepEqual(first.levels.D, ["jupiter"]);
});

test("chart: refuses missing seconds, unresolved folds, gaps, and polar latitudes", () => {
  const base = { year: 1990, month: 7, day: 15, hour: 14, minute: 30, second: 5, timeZone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 };
  assert.throws(() => computeKpChart({ ...base, second: Number.NaN }), /to the second/);
  const fold = { ...base, year: 2023, month: 11, day: 5, hour: 1, minute: 30, timeZone: "America/New_York", latitude: 40.71, longitude: -74.0 };
  assert.throws(() => computeKpChart(fold), AmbiguousBirthTimeError);
  assert.equal(computeKpChart({ ...fold, fold: "later" }).birth.utcOffset, "UTC−05:00");
  assert.throws(() => computeKpChart({ ...fold, month: 3, day: 12, hour: 2 }), /does not exist/);
  assert.throws(() => kpCusps(new Date("2000-06-21T12:00:00Z"), 70, 20), KpHouseError);
});

test("chart: a full chart is internally consistent", () => {
  const chart = computeKpChart(
    { year: 1984, month: 3, day: 1, hour: 5, minute: 29, second: 59, timeZone: "Asia/Kolkata", latitude: 22.5726, longitude: 88.3639 },
    {},
    new Date("2026-10-06T00:00:00Z"),
  );
  assert.equal(chart.system.zodiac, "Sidereal");
  assert.equal(chart.planets.length, 9);
  assert.equal(chart.cusps.length, 12);
  const rahu = chart.planets.find((p) => p.graha === "rahu")!;
  const ketu = chart.planets.find((p) => p.graha === "ketu")!;
  assert.ok(arcsec(rahu.longitude + 180, ketu.longitude) < 1e-6);
  // Matches the fixture (1984-02-29 23:59:59 UTC, Kolkata).
  const fixture = fixtures.find((f) => f.name === "Kolkata")!;
  assert.ok(arcsec(chart.cusps[0].longitude, fixture.cusps[0]) < 0.1);
  assert.ok(chart.currentPeriods.length === 3);
});

test("ruling planets: the Vedic day starts at sunrise", () => {
  // 2024-04-08 is a Monday. 04:00 IST is before sunrise in Delhi → still Sunday.
  const beforeSunrise = vedicDayLord(new Date("2024-04-07T22:30:00Z"), 28.6139, 77.209, "Asia/Kolkata");
  assert.equal(beforeSunrise.lord, "sun");
  const afterSunrise = vedicDayLord(new Date("2024-04-08T03:30:00Z"), 28.6139, 77.209, "Asia/Kolkata");
  assert.equal(afterSunrise.lord, "moon");
});
