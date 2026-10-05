import type { CenterKey } from "./constants";

/**
 * Bodygraph geometry.
 *
 * Coordinates live on a 500 × 800 canvas with the origin at the top-left. The
 * nine centres are drawn as triangles, diamonds and rectangles exactly as they
 * appear on every printed bodygraph; the sixty-four gate numbers sit on the
 * edge of the centre they belong to; the thirty-six channels are drawn as
 * connectors between the two gates they join.
 *
 * This layout is the standard published arrangement of the Human Design
 * bodygraph — it is structural, not stylistic — so it is reproduced as data.
 */

export const BODYGRAPH_VIEWBOX = { width: 500, height: 800 } as const;

export type CenterShape =
  | { kind: "polygon"; points: readonly (readonly [number, number])[] }
  | { kind: "rect"; x: number; y: number; width: number; height: number };

export const CENTER_SHAPES: Readonly<Record<CenterKey, CenterShape>> = {
  head: {
    kind: "polygon",
    points: [
      [250, 40],
      [304, 118],
      [196, 118],
    ],
  },
  ajna: {
    kind: "polygon",
    points: [
      [198, 158],
      [302, 158],
      [250, 240],
    ],
  },
  throat: { kind: "rect", x: 201, y: 280, width: 98, height: 96 },
  g: {
    kind: "polygon",
    points: [
      [250, 400],
      [314, 464],
      [250, 528],
      [186, 464],
    ],
  },
  heart: {
    kind: "polygon",
    points: [
      [371, 482],
      [319, 529],
      [397, 547],
    ],
  },
  spleen: {
    kind: "polygon",
    points: [
      [30, 546],
      [30, 654],
      [126, 600],
    ],
  },
  solar: {
    kind: "polygon",
    points: [
      [470, 546],
      [470, 654],
      [374, 600],
    ],
  },
  sacral: { kind: "rect", x: 201, y: 574, width: 98, height: 96 },
  root: { kind: "rect", x: 201, y: 706, width: 98, height: 96 },
};

/** Where each gate number is drawn. */
export const GATE_POSITIONS: Readonly<Record<number, readonly [number, number]>> = {
  1: [250, 420],
  2: [250, 510],
  3: [250, 657],
  4: [272, 168],
  5: [228, 586],
  6: [401, 600],
  7: [228, 442],
  8: [250, 365],
  9: [276, 657],
  10: [206, 466],
  11: [272, 188],
  12: [290, 334],
  13: [272, 442],
  14: [250, 586],
  15: [228, 488],
  16: [210, 308],
  17: [228, 188],
  18: [42, 632],
  19: [286, 740],
  20: [210, 334],
  21: [366, 503],
  22: [441, 578],
  23: [250, 288],
  24: [250, 168],
  25: [294, 466],
  26: [338, 524],
  27: [214, 644],
  28: [59, 622],
  29: [272, 586],
  30: [458, 632],
  31: [228, 365],
  32: [77, 613],
  33: [272, 365],
  34: [214, 612],
  35: [290, 308],
  36: [458, 568],
  37: [423, 587],
  38: [214, 766],
  39: [286, 766],
  40: [379, 533],
  41: [286, 792],
  42: [224, 657],
  43: [250, 218],
  44: [77, 587],
  45: [288, 356],
  46: [272, 488],
  47: [228, 168],
  48: [42, 568],
  49: [423, 613],
  50: [99, 600],
  51: [355, 512],
  52: [276, 719],
  53: [224, 719],
  54: [214, 740],
  55: [441, 622],
  56: [272, 288],
  57: [59, 578],
  58: [214, 792],
  59: [286, 644],
  60: [250, 719],
  61: [250, 104],
  62: [228, 288],
  63: [272, 104],
  64: [228, 104],
};

/** A readable order for listing gates in text UIs. */
export const GATE_DISPLAY_ORDER: readonly number[] = Array.from(
  { length: 64 },
  (_, i) => i + 1,
);

/** Convert a shape to an SVG `points` string. */
export function polygonPoints(shape: CenterShape): string {
  if (shape.kind === "polygon") {
    return shape.points.map(([x, y]) => `${x},${y}`).join(" ");
  }
  const { x, y, width, height } = shape;
  return `${x},${y} ${x + width},${y} ${x + width},${y + height} ${x},${y + height}`;
}
