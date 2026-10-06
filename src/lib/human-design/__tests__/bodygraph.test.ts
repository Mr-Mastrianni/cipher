/**
 * Human Design bodygraph — regression tests.
 *
 * Run with Node's built-in runner after a plain `tsc` emit (the repo has no test
 * framework and this file adds no dependency):
 *
 * ```
 * node --test <emitted-dir>/src/lib/human-design/__tests__/bodygraph.test.js
 * ```
 *
 * `tsc --noEmit` type-checks this file as part of `pnpm exec tsc --noEmit`.
 *
 * The test vectors are the ones published in `research/human-design-algorithm.md`
 * §13, which were themselves reproduced against `astronomy-engine` and compared
 * with published charts. Where a vector is known to be contested, the test says
 * so rather than asserting the contested value.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CHANNEL_BY_GATES,
  COLOR_ARC,
  DEFINITION_META,
  GATE_ARC,
  GATE_WHEEL,
  LINE_ARC,
  PROFILES,
  TONE_ARC,
  TYPE_META,
  WHEEL_START_DEGREES,
  crossAngleForProfile,
} from "../constants";
import {
  BOUNDARY_WARNING_DEGREES,
  boundaryDistance,
  degreesIntoGate,
  degreesIntoLine,
  gateLineFromLongitude,
} from "../activation";
import type { Activation, BodyKey } from "../activation";
import { designIntervalDays, solarArcAt, solveDesignTime } from "../design-time";
import {
  buildBodygraph,
  computeActivations,
} from "../bodygraph";
import { computeHumanDesign } from "../index";
import { normalize } from "../../astronomy/angles";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Oprah Winfrey: 1954-01-29 04:30 CST (UTC−6), Kosciusko, Mississippi. */
const OPRAH = new Date("1954-01-29T10:30:00.000Z");

/** Donald Trump: 1946-06-14 10:54 EDT (UTC−4), Queens, New York. */
const TRUMP = new Date("1946-06-14T14:54:00.000Z");

/** An arbitrary modern instant, used for the generic coherence checks. */
const SAMPLE = new Date("1988-09-12T07:45:00.000Z");

/** Degrees of arc expected between the Design Sun and the natal Sun. */
const DESIGN_ARC = 88;

const SITE_KEYS = [
  "head",
  "ajna",
  "throat",
  "g",
  "heart",
  "spleen",
  "solar",
  "sacral",
  "root",
] as const;

// ── (a) Longitude → gate / line ─────────────────────────────────────────────

test("gateLineFromLongitude: wheel anchors and line offsets", () => {
  const start = gateLineFromLongitude(WHEEL_START_DEGREES);
  assert.equal(start.gate, 41, "302.0° must be Gate 41");
  assert.equal(start.line, 1, "the wheel start is Line 1");
  assert.equal(start.color, 1);
  assert.equal(start.tone, 1);
  assert.equal(start.base, 1);
  assert.equal(start.gateProgress, 0);

  const nextGate = gateLineFromLongitude(WHEEL_START_DEGREES + GATE_ARC);
  assert.equal(nextGate.gate, 19, "the second gate in the wheel is 19");
  assert.equal(nextGate.line, 1);

  const secondLine = gateLineFromLongitude(WHEEL_START_DEGREES + LINE_ARC);
  assert.equal(secondLine.gate, 41, "one line in is still Gate 41");
  assert.equal(secondLine.line, 2, "302° + 0.9375° is Line 2");
});

test("gateLineFromLongitude: the four fixed-cross anchors", () => {
  // research/human-design-algorithm.md §3.3 — gates 1, 2, 7 and 13 all begin at
  // 13°15' of a fixed sign, and gates 25/10/46/15 at 28°15' of a mutable sign.
  const fixedCrossAnchors: ReadonlyArray<readonly [number, number]> = [
    [223.25, 1], // 13°15' Scorpio
    [43.25, 2], // 13°15' Taurus
    [133.25, 7], // 13°15' Leo
    [313.25, 13], // 13°15' Aquarius
  ];
  for (const [longitude, gate] of fixedCrossAnchors) {
    const position = gateLineFromLongitude(longitude);
    assert.equal(position.gate, gate, `${longitude}° must be Gate ${gate}`);
    assert.equal(position.line, 1, `${longitude}° must be Line 1`);
  }

  const mutableCrossAnchors: ReadonlyArray<readonly [number, number]> = [
    [358.25, 25], // 28°15' Pisces
    [268.25, 10], // 28°15' Sagittarius
    [178.25, 46], // 28°15' Virgo
    [88.25, 15], // 28°15' Gemini
  ];
  for (const [longitude, gate] of mutableCrossAnchors) {
    assert.equal(gateLineFromLongitude(longitude).gate, gate, `${longitude}° must be Gate ${gate}`);
  }
});

test("gateLineFromLongitude: wraps and stays in range for the whole circle", () => {
  // Exactly one full turn is the same longitude.
  assert.deepEqual(
    gateLineFromLongitude(WHEEL_START_DEGREES + 360),
    gateLineFromLongitude(WHEEL_START_DEGREES),
  );

  // Sweep the circle in one-arcsecond steps: indices must never leave range.
  for (let lon = 0; lon < 360; lon += 1 / 3600) {
    const position = gateLineFromLongitude(lon);
    assert.ok(position.gate >= 1 && position.gate <= 64, `gate ${position.gate} at ${lon}°`);
    assert.ok(position.line >= 1 && position.line <= 6, `line at ${lon}°`);
    assert.ok(position.color >= 1 && position.color <= 6, `colour at ${lon}°`);
    assert.ok(position.tone >= 1 && position.tone <= 6, `tone at ${lon}°`);
    assert.ok(position.base >= 1 && position.base <= 5, `base at ${lon}°`);
  }
});

test("gateLineFromLongitude: base is a 5-fold division and clamps at both ends", () => {
  // The last base slice of the last tone of the first gate.
  const lastBase = WHEEL_START_DEGREES + GATE_ARC - 1e-9;
  assert.equal(gateLineFromLongitude(lastBase).base, 5);
  // A longitude a hair past the gate edge belongs to the next gate, line 1.
  const justPast = gateLineFromLongitude(WHEEL_START_DEGREES + GATE_ARC + 1e-9);
  assert.equal(justPast.gate, 19);
  assert.equal(justPast.line, 1);
});

test("gateLineFromLongitude: an exact boundary belongs to the higher slice", () => {
  const boundary = gateLineFromLongitude(WHEEL_START_DEGREES + 3 * LINE_ARC);
  assert.equal(boundary.gate, 41);
  assert.equal(boundary.line, 4, "half-open intervals: floor + 1, never round");
});

test("degreesIntoGate / degreesIntoLine agree with the slice maths", () => {
  const lon = WHEEL_START_DEGREES + 2.5;
  assert.ok(Math.abs(degreesIntoGate(lon) - 2.5) < 1e-12);
  assert.ok(Math.abs(degreesIntoLine(lon) - (2.5 % LINE_ARC)) < 1e-12);
  // 2.5° into the gate is the third line (2.5 / 0.9375 = 2.67).
  assert.equal(gateLineFromLongitude(lon).line, 3);
});

test("boundaryDistance reports proximity to line and gate edges", () => {
  const onEdge = boundaryDistance(WHEEL_START_DEGREES);
  assert.equal(onEdge.toLineBoundary, 0);
  assert.equal(onEdge.toGateBoundary, 0);

  const midLine = boundaryDistance(WHEEL_START_DEGREES + LINE_ARC / 2);
  assert.ok(Math.abs(midLine.toLineBoundary - LINE_ARC / 2) < 1e-12);
  assert.ok(midLine.toGateBoundary <= GATE_ARC / 2);

  const midGate = boundaryDistance(WHEEL_START_DEGREES + GATE_ARC / 2);
  assert.ok(Math.abs(midGate.toGateBoundary - GATE_ARC / 2) < 1e-12);

  // A body 0.001° past a line edge is inside the warning window.
  const sensitive = boundaryDistance(WHEEL_START_DEGREES + LINE_ARC + 0.001);
  assert.ok(sensitive.toLineBoundary < BOUNDARY_WARNING_DEGREES);
  assert.ok(sensitive.toLineBoundary > 0);
});

// ── (b) The 88° Design root-find ────────────────────────────────────────────

test("solveDesignTime: the arc difference is 88° to within 0.0001°", () => {
  for (const birth of [OPRAH, TRUMP, SAMPLE]) {
    const natalSun = computeHumanDesign(birth).activations[0].longitude;
    const design = solveDesignTime(birth);
    // `solarArcAt` is signed: the Sun has not yet reached the natal longitude,
    // so the Design instant sits at -88°.
    const arc = solarArcAt(design, natalSun);
    assert.ok(
      Math.abs(arc + DESIGN_ARC) <= 0.0001,
      `arc was ${arc}° for ${birth.toISOString()} (delta ${arc + DESIGN_ARC}°)`,
    );
    assert.ok(design.getTime() < birth.getTime(), "Design must precede birth");
  }
});

test("solveDesignTime: the interval is 86–92 days and is never exactly 88", () => {
  // Oprah 86.72 d, Trump 90.49 d per research/human-design-algorithm.md §13.
  const oprahDays = designIntervalDays(OPRAH);
  const trumpDays = designIntervalDays(TRUMP);

  assert.ok(oprahDays > 86 && oprahDays < 87, `Oprah interval was ${oprahDays} d`);
  assert.ok(trumpDays > 90 && trumpDays < 91, `Trump interval was ${trumpDays} d`);
  for (const days of [oprahDays, trumpDays]) {
    assert.ok(days > 85 && days < 93, `interval ${days} d outside the physical range`);
    assert.ok(Math.abs(days - 88) > 0.5, "88 days is the classic wrong answer");
  }
});

test("solveDesignTime is deterministic and sub-second stable", () => {
  const a = solveDesignTime(TRUMP).getTime();
  const b = solveDesignTime(TRUMP).getTime();
  assert.equal(a, b);
  // Perturbing the birth instant by one millisecond must move the Design
  // instant by at most a few seconds, never by a different day.
  const perturbed = solveDesignTime(new Date(TRUMP.getTime() + 1)).getTime();
  assert.ok(Math.abs(perturbed - a) < 5000, `moved ${perturbed - a} ms`);
});

// ── (c) The 26 activations ──────────────────────────────────────────────────

test("computeActivations: 26 activations, 13 of each source", () => {
  const activations = computeActivations(SAMPLE);
  assert.equal(activations.length, 26);

  const personality = activations.filter((a) => a.source === "personality");
  const design = activations.filter((a) => a.source === "design");
  assert.equal(personality.length, 13);
  assert.equal(design.length, 13);

  // Canonical order: 13 Personality bodies first, then the same 13 Design bodies.
  const order = [
    "sun",
    "earth",
    "moon",
    "northNode",
    "southNode",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
  ];
  assert.deepEqual(personality.map((a) => a.body), order);
  assert.deepEqual(design.map((a) => a.body), order);
});

test("computeActivations: Earth opposes Sun and South Node opposes North Node", () => {
  for (const birth of [OPRAH, TRUMP, SAMPLE]) {
    const activations = computeActivations(birth);
    for (const source of ["personality", "design"] as const) {
      const of = (body: BodyKey) =>
        activations.find((a) => a.source === source && a.body === body);
      const sun = of("sun");
      const earth = of("earth");
      const north = of("northNode");
      const south = of("southNode");
      assert.ok(sun && earth && north && south, `${source} axis activations present`);

      assert.ok(
        Math.abs(normalize(earth.longitude - sun.longitude) - 180) < 1e-9,
        `${source} Earth must be exactly 180° from the Sun`,
      );
      assert.ok(
        Math.abs(normalize(south.longitude - north.longitude) - 180) < 1e-9,
        `${source} South Node must be exactly 180° from the North Node`,
      );
      // Earth and South Node are read through the same gate/line routine.
      assert.deepEqual(
        { gate: earth.gate, line: earth.line },
        (({ gate, line }) => ({ gate, line }))(gateLineFromLongitude(earth.longitude)),
      );
    }
  }
});

// ── Published vectors ───────────────────────────────────────────────────────

test("Oprah fixture: 26 activations match the published table", () => {
  const activations = computeActivations(OPRAH);
  const design = new Map<BodyKey, string>(
    activations
      .filter((a) => a.source === "design")
      .map((a) => [a.body, `${a.gate}.${a.line}`] as const),
  );
  const personality = new Map<BodyKey, string>(
    activations
      .filter((a) => a.source === "personality")
      .map((a) => [a.body, `${a.gate}.${a.line}`] as const),
  );

  // research/human-design-algorithm.md §13.1
  const expectedDesign: Readonly<Record<BodyKey, string>> = {
    sun: "44.4",
    earth: "24.4",
    moon: "18.4",
    northNode: "60.2",
    southNode: "56.2",
    mercury: "34.1",
    venus: "57.6",
    mars: "46.4",
    jupiter: "12.4",
    saturn: "50.6",
    uranus: "62.3",
    neptune: "32.4",
    pluto: "29.1",
  };
  const expectedPersonality: Readonly<Record<BodyKey, string>> = {
    sun: "19.2",
    earth: "33.2",
    moon: "34.5",
    northNode: "61.4",
    southNode: "62.4",
    mercury: "49.1",
    venus: "19.2",
    mars: "43.6",
    jupiter: "35.6",
    saturn: "44.2",
    uranus: "53.6",
    neptune: "32.6",
    pluto: "4.6",
  };

  for (const body of Object.keys(expectedDesign) as BodyKey[]) {
    assert.equal(design.get(body), expectedDesign[body], `Design ${body}`);
  }
  for (const body of Object.keys(expectedPersonality) as BodyKey[]) {
    assert.equal(personality.get(body), expectedPersonality[body], `Personality ${body}`);
  }

  const chart = computeHumanDesign(OPRAH);
  assert.equal(chart.type, "Generator");
  assert.equal(chart.profile, "2/4");
  assert.equal(chart.authority, "Emotional");
  assert.equal(chart.definition.label, "Triple Split");
  assert.deepEqual(
    chart.channels.map((c) => c.key).sort(),
    ["19-49", "24-61", "29-46", "34-57"],
  );
  assert.equal(chart.definedCenterCount, 7);
  assert.equal(chart.incarnationCross.quartet, "19.2/33.2 | 44.4/24.4");
  assert.equal(chart.incarnationCross.label, "Right Angle Cross of the Four Ways 4 (19.2/33.2 | 44.4/24.4)");
});

test("Trump fixture: 26 activations match the published table", () => {
  const activations = computeActivations(TRUMP);
  const design = new Map<BodyKey, string>(
    activations
      .filter((a) => a.source === "design")
      .map((a) => [a.body, `${a.gate}.${a.line}`] as const),
  );
  const personality = new Map<BodyKey, string>(
    activations
      .filter((a) => a.source === "personality")
      .map((a) => [a.body, `${a.gate}.${a.line}`] as const),
  );

  // research/human-design-algorithm.md §13.2
  const expectedDesign: Readonly<Record<BodyKey, string>> = {
    sun: "36.3",
    earth: "6.3",
    moon: "59.6",
    northNode: "12.4",
    southNode: "11.4",
    mercury: "21.1",
    venus: "17.2",
    mars: "53.2",
    jupiter: "32.6",
    saturn: "53.4",
    uranus: "35.3",
    neptune: "18.4",
    pluto: "33.3",
  };
  const expectedPersonality: Readonly<Record<BodyKey, string>> = {
    sun: "12.1",
    earth: "11.1",
    moon: "26.5",
    northNode: "45.5",
    southNode: "26.5",
    mercury: "52.6",
    venus: "62.6",
    mars: "29.3",
    jupiter: "57.3",
    saturn: "62.4",
    uranus: "45.1",
    neptune: "18.3",
    pluto: "33.3",
  };

  for (const body of Object.keys(expectedDesign) as BodyKey[]) {
    assert.equal(design.get(body), expectedDesign[body], `Design ${body}`);
  }
  for (const body of Object.keys(expectedPersonality) as BodyKey[]) {
    assert.equal(personality.get(body), expectedPersonality[body], `Personality ${body}`);
  }

  const chart = computeHumanDesign(TRUMP);
  assert.equal(chart.type, "Manifesting Generator");
  assert.equal(chart.profile, "1/3");
  assert.equal(chart.authority, "Emotional");
  assert.equal(chart.definition.label, "Single");
  assert.deepEqual(
    chart.channels.map((c) => c.key).sort(),
    ["17-62", "21-45", "35-36", "6-59"],
  );
  assert.equal(chart.incarnationCross.quartet, "12.1/11.1 | 36.3/6.3");
  assert.match(chart.incarnationCross.label, /^Right Angle Cross of Eden 2 /);
});

// ── (d) Whole-chart coherence ───────────────────────────────────────────────

test("computeHumanDesign: returns a coherent chart", () => {
  const chart = computeHumanDesign(SAMPLE);

  // Type.
  assert.ok(
    ["Generator", "Manifesting Generator", "Manifestor", "Projector", "Reflector"].includes(
      chart.type,
    ),
    `unexpected type ${chart.type}`,
  );
  assert.equal(chart.typeMeta.strategy, TYPE_META[chart.type].strategy);
  assert.equal(chart.typeMeta.signature, TYPE_META[chart.type].signature);
  assert.ok(chart.authorityMeta.how.length > 0);

  // Profile must exist in PROFILES and match the Sun lines.
  const personalitySun = chart.activations.find(
    (a) => a.source === "personality" && a.body === "sun",
  );
  const designSun = chart.activations.find(
    (a) => a.source === "design" && a.body === "sun",
  );
  assert.ok(personalitySun && designSun);
  assert.equal(chart.profile, `${personalitySun.line}/${designSun.line}`);
  assert.ok(
    PROFILES.some((p) => p.key === chart.profile),
    `profile ${chart.profile} must exist in PROFILES`,
  );
  assert.equal(chart.profileMeta?.key, chart.profile);

  // Definition label must be a real key of DEFINITION_META.
  assert.ok(
    Object.prototype.hasOwnProperty.call(DEFINITION_META, chart.definition.label),
    `definition ${chart.definition.label} must exist in DEFINITION_META`,
  );
  assert.equal(
    chart.definition.componentCount,
    chart.definition.regions.length,
  );

  // Nine centres, defined + undefined summing to 9.
  assert.equal(Object.keys(chart.centers).length, 9);
  const defined = SITE_KEYS.filter((key) => chart.centers[key].defined);
  const undefinedCentres = SITE_KEYS.filter((key) => !chart.centers[key].defined);
  assert.equal(defined.length + undefinedCentres.length, 9);
  assert.equal(defined.length, chart.definedCenterCount);

  // Every defined centre sits on at least one complete channel, and every
  // channel's two endpoints are defined.
  for (const centre of defined) {
    assert.ok(
      chart.centers[centre].gates.length > 0,
      `defined centre ${centre} must carry a complete-channel gate`,
    );
  }
  for (const channel of chart.channels) {
    assert.ok(chart.centers[channel.from].defined, `${channel.key} from-centre defined`);
    assert.ok(chart.centers[channel.to].defined, `${channel.key} to-centre defined`);
  }

  // Hanging gates and complete channels partition the activated gates.
  const onCompleteChannel = new Set(chart.channels.flatMap((c) => [...c.gates]));
  for (const hanging of chart.hangingGates) {
    assert.ok(!onCompleteChannel.has(hanging.gate), `hanging gate ${hanging.gate} not on a channel`);
    assert.ok(hanging.waitingOn.length > 0, `hanging gate ${hanging.gate} waits on a partner`);
  }
  assert.ok(chart.activations.length === 26);
  assert.ok(chart.gates.length > 0 && chart.gates.length <= 26);

  // Variables come from the four documented activations.
  assert.equal(
    chart.variables.determination.color,
    designSun.color,
    "determination reads the Design Sun colour",
  );
  assert.equal(
    chart.variables.motivation.color,
    personalitySun.color,
    "motivation reads the Personality Sun colour",
  );
  assert.ok(chart.variables.environment.name.length > 0);
  assert.ok(chart.variables.perspective.name.length > 0);

  // The cross quartet's four gates are the two Sun/Earth oppositions.
  const cross = chart.incarnationCross;
  assert.equal(cross.personalitySun.gate, personalitySun.gate);
  assert.equal(cross.designSun.gate, designSun.gate);
  assert.match(cross.quartet, /^\d{1,2}\.\d\/\d{1,2}\.\d \| \d{1,2}\.\d\/\d{1,2}\.\d$/);
  assert.ok(cross.label.includes(cross.quartet));

  // The Design instant is earlier, and the interval is physical.
  assert.ok(chart.designInstant.getTime() < chart.birthInstant.getTime());
  assert.ok(chart.designIntervalDays > 85 && chart.designIntervalDays < 93);
});

test("computeHumanDesign: every activation is reported to the boundary checker", () => {
  const chart = computeHumanDesign(SAMPLE);
  for (const signal of chart.signals) {
    assert.ok(signal.distance >= 0);
    assert.ok(
      signal.distance < BOUNDARY_WARNING_DEGREES,
      `signal ${signal.label} at ${signal.distance}° is outside the warning window`,
    );
    assert.ok(signal.kind === "line" || signal.kind === "gate");
  }
  // Signals are sorted most-urgent first.
  for (let i = 1; i < chart.signals.length; i += 1) {
    assert.ok(chart.signals[i - 1].distance <= chart.signals[i].distance);
  }
});

// ── Graph logic that is easy to get wrong ───────────────────────────────────

test("buildBodygraph: Reflector when no centre is defined", () => {
  // Gates that share no canonical channel with one another, so no channel can
  // complete. The maximum channel-free set is small — every gate has at least
  // one partner — so this list is deliberately chosen: none of gates 20, 34 and
  // 57 (which each sit on three channels) is included.
  const isolatedGates = [61, 63, 64, 43, 17, 11, 12, 35, 16, 18, 28, 32, 8];
  const chart = buildSynthetic(undefined, isolatedGates);
  assert.equal(chart.activations.length, 26);
  assert.equal(chart.gates.length, 13);
  assert.equal(chart.channels.length, 0);
  assert.equal(chart.definedCenterCount, 0);
  assert.equal(chart.type, "Reflector");
  assert.equal(chart.authority, "Lunar");
  assert.equal(chart.definition.label, "None");
  assert.equal(chart.definition.componentCount, 0);
  assert.equal(chart.hangingGates.length, 13);
});

test("buildBodygraph: a Sacral→G→Throat path is a Manifesting Generator", () => {
  // 2-14 (G↔Sacral) plus 7-31 (G↔Throat): no direct Sacral–Throat channel.
  const chart = manifestingGeneratorFixture();
  assert.equal(chart.centers.sacral.defined, true);
  assert.equal(chart.centers.throat.defined, true);
  assert.equal(chart.centers.g.defined, true);
  assert.equal(chart.type, "Manifesting Generator");
  assert.equal(chart.authority, "Sacral");
  assert.equal(chart.definition.label, "Single");
});

test("buildBodygraph: a motor-to-Throat path with no Sacral is a Manifestor", () => {
  // 21-45 (Heart↔Throat) plus 25-51 (G↔Heart): Sacral undefined.
  const chart = manifestorFixture();
  assert.equal(chart.centers.sacral.defined, false);
  assert.equal(chart.centers.heart.defined, true);
  assert.equal(chart.centers.throat.defined, true);
  assert.equal(chart.type, "Manifestor");
  assert.equal(chart.authority, "Ego");
});

test("buildBodygraph: Sacral with no motor path to the Throat is a Generator", () => {
  // 3-60 (Sacral↔Root) only: the Throat is never reached.
  const chart = singleChannelFixture([3, 60]);
  assert.equal(chart.centers.sacral.defined, true);
  assert.equal(chart.centers.throat.defined, false);
  assert.equal(chart.type, "Generator");
  assert.equal(chart.authority, "Sacral");
});

test("buildBodygraph: definition components split correctly", () => {
  // 2-14 (G↔Sacral) and 17-62 (Ajna↔Throat) are disjoint → Split Definition.
  const chart = singleChannelFixture([2, 14], [17, 62]);
  assert.equal(chart.channels.length, 2);
  assert.equal(chart.definition.label, "Split");
  assert.equal(chart.definition.componentCount, 2);
  assert.deepEqual(
    chart.definition.regions.map((r) => [...r.centers].sort()).sort(),
    [
      ["g", "sacral"],
      ["ajna", "throat"],
    ].sort(),
  );
  assert.equal(chart.type, "Generator");
});

// ── Fixture builders ────────────────────────────────────────────────────────


// ── Regressions ─────────────────────────────────────────────────────────────

test("authority: a Projector defined only Head–Ajna is Mental, not Lunar", () => {
  // 47-64 defines Head and Ajna; the Throat stays open. Lunar is Reflector-only.
  const chart = buildSynthetic([[47, 64]]);
  assert.equal(chart.type, "Projector");
  assert.equal(chart.centers.throat.defined, false);
  assert.equal(chart.authority, "Mental");
});

test("cross angle: 4/6 is Right Angle and every profile agrees with PROFILES", () => {
  assert.equal(crossAngleForProfile(4, 6), "right");
  assert.equal(crossAngleForProfile(4, 1), "juxtaposition");
  assert.equal(crossAngleForProfile(5, 1), "left");
  for (const profile of PROFILES) {
    const [p, d] = profile.key.split("/").map(Number);
    assert.equal(crossAngleForProfile(p, d), profile.angle, profile.key);
  }
});

test("variables: direction follows tone and Determination names colour + sub-type", () => {
  const activations = syntheticActivations([[47, 64]]);
  // Colour 1, tone 5 inside Gate 41 → Appetite, Right (Alternating).
  const longitude = WHEEL_START_DEGREES + 4 * TONE_ARC + TONE_ARC / 2;
  const position = gateLineFromLongitude(longitude);
  assert.equal(position.color, 1);
  assert.equal(position.tone, 5);
  const index = activations.findIndex((a) => a.source === "design" && a.body === "sun");
  activations[index] = { ...activations[index], longitude, ...position, boundary: boundaryDistance(longitude) };
  const chart = buildBodygraph(activations, {
    birthInstant: new Date("2000-01-01T12:00:00Z"),
    designInstant: new Date("1999-10-01T12:00:00Z"),
  });
  assert.equal(chart.variables.determination.name, "Appetite (Alternating)");
  assert.equal(chart.variables.determination.direction, "Right");

  // Colour 4, tone 2 → Touch, Left (Calm).
  const left = WHEEL_START_DEGREES + 3 * COLOR_ARC + TONE_ARC + TONE_ARC / 2;
  const leftPosition = gateLineFromLongitude(left);
  activations[index] = { ...activations[index], longitude: left, ...leftPosition, boundary: boundaryDistance(left) };
  const leftChart = buildBodygraph(activations, {
    birthInstant: new Date("2000-01-01T12:00:00Z"),
    designInstant: new Date("1999-10-01T12:00:00Z"),
  });
  assert.equal(leftChart.variables.determination.name, "Touch (Calm)");
  assert.equal(leftChart.variables.determination.direction, "Left");
});

test("circuitry: Integration and Tribal Ego channels are labelled correctly", () => {
  assert.equal(CHANNEL_BY_GATES.get("20-57")?.subcircuit, "Integration");
  assert.equal(CHANNEL_BY_GATES.get("19-49")?.subcircuit, "Ego");
  assert.equal(CHANNEL_BY_GATES.get("32-54")?.subcircuit, "Ego");
  assert.equal(CHANNEL_BY_GATES.get("12-22")?.circuit, "individual");
});

/**
 * Build a synthetic 26-activation set in which exactly the gates needed to
 * complete the supplied channels are activated. When `explicitGates` is given
 * instead, those gates are activated and no channel is guaranteed complete.
 *
 * Each synthetic activation sits in the middle of its gate's first line so that
 * no boundary warning fires and the fixture is stable.
 */
function syntheticActivations(
  channelGates: readonly number[][] | undefined,
  explicitGates?: readonly number[],
): Activation[] {
  const gates = explicitGates
    ? [...explicitGates]
    : [...new Set((channelGates ?? []).flat())];
  assert.ok(gates.length > 0, "fixture needs at least one gate");

  const activations: Activation[] = [];
  for (const source of ["personality", "design"] as const) {
    for (let i = 0; i < 13; i += 1) {
      const gate = gates[i % gates.length];
      // The wheel is *not* numeric order, so find the gate's own arc index.
      const wheelIndex = GATE_WHEEL.indexOf(gate);
      assert.ok(wheelIndex >= 0, `gate ${gate} is on the wheel`);
      const longitude =
        WHEEL_START_DEGREES + wheelIndex * GATE_ARC + LINE_ARC / 2;
      const position = gateLineFromLongitude(longitude);
      assert.equal(position.gate, gate, `synthetic gate ${gate} round-trips`);
      activations.push({
        body: BODY_ORDER[i],
        source,
        longitude,
        gate: position.gate,
        line: position.line,
        color: position.color,
        tone: position.tone,
        base: position.base,
        boundary: boundaryDistance(longitude),
      });
    }
  }
  return activations;
}

/** The 13 bodies in canonical order, for synthetic fixtures. */
const BODY_ORDER = [
  "sun",
  "earth",
  "moon",
  "northNode",
  "southNode",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;

/** Build a bodygraph from a synthetic activation set. */
function buildSynthetic(
  channels?: readonly number[][],
  explicitGates?: readonly number[],
) {
  return buildBodygraph(syntheticActivations(channels, explicitGates), {
    birthInstant: new Date("2000-01-01T12:00:00Z"),
    designInstant: new Date("1999-10-01T12:00:00Z"),
  });
}

function manifestingGeneratorFixture() {
  // 2-14 (G↔Sacral) plus 7-31 (G↔Throat): no direct Sacral–Throat channel.
  return buildSynthetic([
    [2, 14],
    [7, 31],
  ]);
}

function manifestorFixture() {
  // 21-45 (Heart↔Throat) plus 25-51 (G↔Heart): the Sacral is never defined.
  return buildSynthetic([
    [21, 45],
    [25, 51],
  ]);
}

function singleChannelFixture(...channels: readonly number[][]) {
  return buildSynthetic(channels);
}
