/**
 * Generate the land dots the entry globe draws.
 *
 * The globe needs a few thousand points that sit on land, at a resolution fine
 * enough to read as continents and coarse enough to stay a dot matrix. Doing
 * the point-in-polygon work in the browser would mean shipping the 110m
 * topology (~100KB) and running tens of thousands of containment tests on the
 * main thread, so it is done once here and committed as a packed string:
 * two uint16 per point (tenths of a degree), base64.
 *
 * Regenerate with `pnpm geo:dots` after changing N or the source topology.
 */

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geoContains } from "d3-geo";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/lib/geo/land-dots.ts");

/** Points sampled on the sphere before the land test. ~6k survive. */
const N = 21_000;

/** Tenths of a degree. 0.1° is finer than a pixel at any size we draw. */
const SCALE = 10;

type Topology = {
  arcs: number[][][];
  transform: { scale: [number, number]; translate: [number, number] };
  objects: {
    land: { geometries: { type: string; arcs: number[] | number[][] | number[][][] }[] };
  };
};

const require = createRequire(import.meta.url);
const topo = JSON.parse(
  await readFile(require.resolve("world-atlas/land-110m.json"), "utf8"),
) as Topology;

const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;

/** TopoJSON delta-decodes each arc relative to the previous point. */
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty] as [number, number];
  });
});

function ring(indices: number[]): [number, number][] {
  const points: [number, number][] = [];
  for (const index of indices) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
    points.push(...(arc as [number, number][]));
  }
  return points;
}

const land = {
  type: "MultiPolygon" as const,
  coordinates: topo.objects.land.geometries.flatMap((geometry) => {
    if (geometry.type === "Polygon") return [(geometry.arcs as number[][]).map(ring)];
    return (geometry.arcs as number[][][]).map((polygon) => polygon.map(ring));
  }),
} as unknown as GeoJSON.MultiPolygon;

const points: number[] = [];
const golden = Math.PI * (3 - Math.sqrt(5));

for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const theta = golden * i;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lon = ((((theta * 180) / Math.PI) % 360) + 540) % 360 - 180;
  if (geoContains(land, [lon, lat])) points.push(lon, lat);
}

const packed = new Uint16Array(points.length);
for (let i = 0; i < points.length; i++) {
  const offset = i % 2 === 0 ? 180 : 90;
  packed[i] = Math.round((points[i] + offset) * SCALE);
}

const base64 = Buffer.from(packed.buffer).toString("base64");
const count = packed.length / 2;

const file = `/**
 * Land dots for the entry globe.
 *
 * GENERATED — do not edit by hand. Run \`pnpm geo:dots\` to rebuild from
 * \`world-atlas/land-110m.json\` (Natural Earth, public domain).
 *
 * ${count} points, packed as two uint16 per point: \`(lon + 180) * 10\` then
 * \`(lat + 90) * 10\`. Base64 keeps the payload ~${Math.round(base64.length / 1024)}KB
 * instead of ~${Math.round(count * 14 / 1024)}KB of JSON literals.
 */

const PACKED =
  "${base64}";

/** How many dots the packed payload holds. */
export const LAND_DOT_COUNT = ${count};

let decoded: Float32Array | null = null;

/**
 * Decode the packed dots once per process.
 *
 * Returns a flat \`[lon, lat, lon, lat, …]\` buffer in degrees. The buffer is
 * shared and must not be mutated.
 */
export function landDots(): Float32Array {
  if (decoded) return decoded;

  const binary = atob(PACKED);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pairs = new Uint16Array(bytes.buffer, 0, bytes.length / 2);
  const out = new Float32Array(pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    out[i] = pairs[i] / ${SCALE} - (i % 2 === 0 ? 180 : 90);
  }

  decoded = out;
  return out;
}
`;

await writeFile(out, file, "utf8");
console.log(`land dots: ${count} → ${out} (${Math.round(base64.length / 1024)}KB)`);
