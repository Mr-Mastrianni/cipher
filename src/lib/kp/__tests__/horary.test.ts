/** KP horary: chart construction for the number and time methods, and judgement. */

import test from "node:test";
import assert from "node:assert/strict";
import { kpCusps } from "../positions";
import { kpSubTable } from "../lords";
import { ascendant } from "../../astronomy/houses";
import { trueObliquity } from "../ayanamsa";
import type { Graha } from "../constants";
import {
  HORARY_CATEGORIES,
  horaryChart,
  judgeHorary,
  negatingHouses,
  ramcForAscendant,
  type HoraryChart,
} from "../horary";

const AT = new Date("2026-10-06T06:30:00Z");
const DELHI = { latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" };

test("ramcForAscendant inverts the Ascendant to 1e-8°", () => {
  const eps = trueObliquity(AT);
  for (const target of [0.5, 89.9, 181, 271.3, 359.7]) {
    for (const lat of [-45, 0, 28.6, 55]) {
      const ramc = ramcForAscendant(target, eps, lat);
      const back = ascendant(ramc, eps, lat);
      assert.ok(Math.abs(((back - target + 540) % 360) - 180) < 1e-8, `${target} @ ${lat}`);
    }
  }
});

test("number method: the Lagna sits at the commencement of the chosen sub", () => {
  const table = kpSubTable();
  for (const n of [1, 2, 100, 249]) {
    const chart = horaryChart({ number: n, at: AT, ...DELHI });
    assert.equal(chart.method, "number");
    assert.ok(Math.abs(chart.cusps[0].longitude - table[n - 1].start) < 1e-9, `number ${n}`);
    assert.equal(chart.cusps[0].subLord, table[n - 1].subLord, `number ${n} sub lord`);
    // Cusps run in zodiacal order and tile the circle.
    let total = 0;
    for (let i = 0; i < 12; i += 1) {
      const gap = (((chart.cusps[(i + 1) % 12].longitude - chart.cusps[i].longitude) % 360) + 360) % 360;
      assert.ok(gap > 0);
      total += gap;
    }
    assert.ok(Math.abs(total - 360) < 1e-6);
  }
  assert.equal(horaryChart({ number: 1, at: AT, ...DELHI }).cusps[0].rasi.sanskrit, "Mesha");
  assert.throws(() => horaryChart({ number: 250, at: AT, ...DELHI }), /1 to 249/);
});

test("time method: the Lagna is the real Lagna of the moment", () => {
  const chart = horaryChart({ number: null, at: AT, ...DELHI });
  const real = kpCusps(AT, DELHI.latitude, DELHI.longitude).cusps;
  chart.cusps.forEach((c, i) => assert.ok(Math.abs(c.longitude - real[i]) < 1e-9));
});

test("negating houses are the 12th from each favourable house", () => {
  assert.deepEqual(negatingHouses([2, 7, 11]), [1, 6, 10]);
  assert.deepEqual(negatingHouses([1, 5, 11]), [4, 10, 12]);
  assert.deepEqual(negatingHouses([4, 11, 12]), [3, 10]); // 11 is the 12th from 12 but favourable
});

/** A hand-built chart: only the fields judgement reads. */
function syntheticChart(subLordOf7: "venus" | "saturn", venusHouse: number, mercuryHouse: number): HoraryChart {
  const real = horaryChart({ number: 50, at: AT, ...DELHI });
  const cusps = real.cusps.map((c) => ({ ...c, signLord: "sun" as Graha }));
  cusps[6] = { ...cusps[6], subLord: subLordOf7 };
  cusps[10] = { ...cusps[10], signLord: "mercury" }; // Mercury owns the 11th
  const planets = real.planets.map((p) =>
    p.graha === "venus"
      ? { ...p, starLord: "mercury" as const, house: venusHouse }
      : p.graha === "saturn"
        ? { ...p, starLord: "saturn" as const, house: 6 }
        : p.graha === "mercury"
          ? { ...p, house: mercuryHouse }
          : { ...p, house: 3 },
  );
  return { ...real, cusps, planets };
}

test("judgement: promised, mixed and denied follow the star lord's houses", () => {
  // Venus subs the 7th; its star lord Mercury sits in the 2nd and owns the 11th → promised.
  const promised = judgeHorary(syntheticChart("venus", 9, 2), "marriage");
  assert.equal(promised.verdict, "promised");
  assert.deepEqual(promised.viaStarLord, [2, 11]);
  // Mercury in the 6th (negating) while owning the 11th → mixed.
  assert.equal(judgeHorary(syntheticChart("venus", 9, 6), "marriage").verdict, "mixed");
  // Saturn subs the 7th, star of itself, in the 6th and owning nothing favourable → denied.
  assert.equal(judgeHorary(syntheticChart("saturn", 9, 2), "marriage").verdict, "denied");
});

test("judgement on a real chart is self-consistent for every category", () => {
  const chart = horaryChart({ number: 137, at: AT, ...DELHI });
  for (const category of HORARY_CATEGORIES) {
    const j = judgeHorary(chart, category.id);
    assert.equal(j.cusp.subLord, chart.cusps[category.decidingCusp - 1].subLord);
    assert.ok(j.favourableHits.every((h) => category.favourable.includes(h)));
    assert.ok(j.fruitful.every((g) => chart.rulingPlanets.set.includes(g)));
    for (const w of j.windows) assert.ok(Date.parse(w.end) > Date.parse(chart.at));
    if (j.verdict === "denied") assert.equal(j.windows.length, 0);
    assert.ok(j.explanation.length > 80);
  }
});

test("judgement: a node sub lord carries its sign lord's houses as agent", () => {
  const real = horaryChart({ number: 50, at: AT, ...DELHI });
  const cusps = real.cusps.map((c) => ({ ...c, signLord: "sun" as Graha }));
  cusps[6] = { ...cusps[6], subLord: "rahu" };
  cusps[10] = { ...cusps[10], signLord: "venus" }; // Venus owns the 11th
  const planets = real.planets.map((p) =>
    p.graha === "rahu"
      ? { ...p, starLord: "rahu" as Graha, signLord: "venus" as Graha, house: 3 }
      : p.graha === "venus"
        ? { ...p, house: 2 }
        : { ...p, house: 9 },
  );
  const judgement = judgeHorary({ ...real, cusps, planets }, "marriage");
  // Rahu in the 3rd, agent of Venus (in the 2nd, owning the 11th).
  assert.deepEqual(judgement.viaStarLord, [2, 3, 11]);
  assert.equal(judgement.verdict, "promised");
});
