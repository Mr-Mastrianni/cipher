/**
 * Collapsing raw activations into the markers a bodygraph actually draws.
 *
 * A bodygraph is not one dot per activation. Two different planets routinely
 * land in the same gate on the same side — Sun and Mercury in gate 60 of the
 * personality is an everyday example — and the drawing still shows one dot
 * there. A gate activated on both sides shows both.
 *
 * Rendering the raw activation list draws those dots on top of each other, and
 * gives React two children with the same key (`60-personality`), which it warns
 * about and reserves the right to render unpredictably. So the raw list is
 * collapsed by gate first, once, and everything drawn afterwards is uniquely
 * identified by its gate.
 *
 * This lives here, not in the renderer, because it is a fact about the chart
 * rather than about SVG.
 */

/** Which side of the bodygraph an activation belongs to. */
export type ActivationSide = "personality" | "design" | "both";

/** One planet's activation of a gate. */
export interface Activation {
  gate: number;
  line: number;
  source: ActivationSide;
}

/** One drawn gate marker: a gate plus the side or sides that activate it. */
export type ActivationMarker = Activation;

/**
 * Collapse activations into one marker per gate.
 *
 * A gate seen on one side keeps that side; seen on both sides it becomes
 * `"both"`. `line` is carried from the first activation of the gate — the
 * renderer draws a dot, not a line number — and the input order of gates is
 * preserved so the output is stable across renders.
 *
 * @param activations - The raw activations, in any order.
 * @returns One marker per distinct gate.
 */
export function activationMarkers(
  activations: readonly Activation[],
): ActivationMarker[] {
  const byGate = new Map<number, ActivationMarker>();

  for (const activation of activations) {
    const existing = byGate.get(activation.gate);
    if (!existing) {
      byGate.set(activation.gate, {
        gate: activation.gate,
        line: activation.line,
        source: activation.source,
      });
      continue;
    }
    // Already known on this side (a second planet in the same gate), or already
    // widened to both sides: nothing further to record.
    if (existing.source === "both" || existing.source === activation.source) {
      continue;
    }
    byGate.set(activation.gate, { ...existing, source: "both" });
  }

  return [...byGate.values()];
}
