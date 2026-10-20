/**
 * Bodygraph marker collapse.
 *
 * The bug this pins down: rendering the raw activation list produced duplicate
 * React keys (`60-personality`) whenever two planets shared a gate on one side,
 * which is the normal case rather than an edge case.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { activationMarkers, type Activation } from "../activation-markers";

/** Build an activation quickly. */
const act = (
  gate: number,
  source: Activation["source"],
  line = 1,
): Activation => ({ gate, line, source });

test("an empty chart draws nothing", () => {
  assert.deepEqual(activationMarkers([]), []);
});

test("two planets in the same gate on the same side collapse to one marker", () => {
  // Sun and Mercury together in gate 60 is an ordinary chart, not a corner case.
  const markers = activationMarkers([act(60, "personality"), act(60, "personality")]);

  assert.equal(markers.length, 1);
  assert.equal(markers[0].gate, 60);
  assert.equal(markers[0].source, "personality");
});

test("a gate activated on both sides becomes a single 'both' marker", () => {
  const markers = activationMarkers([
    act(60, "personality"),
    act(60, "design"),
  ]);

  assert.deepEqual(markers, [{ gate: 60, line: 1, source: "both" }]);
});

test("the order the sides arrive in does not matter", () => {
  const forwards = activationMarkers([act(41, "personality"), act(41, "design")]);
  const backwards = activationMarkers([act(41, "design"), act(41, "personality")]);

  assert.deepEqual(forwards, backwards);
  assert.equal(forwards[0].source, "both");
});

test("a third activation cannot widen a marker back to one side", () => {
  const markers = activationMarkers([
    act(60, "personality"),
    act(60, "design"),
    act(60, "personality"),
  ]);

  assert.equal(markers.length, 1);
  assert.equal(markers[0].source, "both");
});

test("distinct gates are all kept, in input order", () => {
  const markers = activationMarkers([
    act(1, "personality", 3),
    act(2, "design", 4),
    act(3, "personality", 5),
  ]);

  assert.deepEqual(
    markers.map((marker) => marker.gate),
    [1, 2, 3],
  );
  assert.deepEqual(
    markers.map((marker) => marker.source),
    ["personality", "design", "personality"],
  );
  // `line` rides along with the first activation of the gate.
  assert.equal(markers[0].line, 3);
});

test("every gate is unique, which is what makes the React key safe", () => {
  // 13 personality + 13 design activations, deliberately overlapping in gates the
  // way a real design does.
  const activations = [
    ...Array.from({ length: 13 }, (_, i) => act(1 + i, "personality")),
    ...Array.from({ length: 13 }, (_, i) => act(1 + i, i % 2 === 0 ? "personality" : "design")),
  ];

  const markers = activationMarkers(activations);
  const gates = markers.map((marker) => marker.gate);

  assert.equal(new Set(gates).size, gates.length, "gates must be unique");
  assert.equal(markers.length, 13);
  // Odd gates were personality only; even gates also got a design activation.
  assert.equal(markers.find((marker) => marker.gate === 1)?.source, "personality");
  assert.equal(markers.find((marker) => marker.gate === 2)?.source, "both");
  assert.equal(markers.filter((marker) => marker.source === "both").length, 6);
  assert.equal(
    markers.filter((marker) => marker.source === "personality").length,
    7,
  );
});

test("the input is not mutated", () => {
  const activations = [act(60, "personality"), act(60, "design")];
  const copy = activations.map((entry) => ({ ...entry }));

  activationMarkers(activations);

  assert.deepEqual(activations, copy);
});
