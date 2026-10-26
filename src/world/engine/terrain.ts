/**
 * The valley of the Cipher: one deterministic height function.
 *
 * The ground mesh, every landmark, the player, the build ghost and the
 * collision all ask the same `heightAt`. There is exactly one terrain in this
 * codebase, for the same reason the rest of the site has one KP engine: a second
 * implementation of a height is a bug waiting to be walked into.
 *
 * The shape is a broad basin inside a broken mountain rim, with a real lake in
 * the south-west and flat pads levelled under each built place. The palette is
 * deliberately not an English valley: the grass is a cold moss, the rock a dusty
 * violet, and the water nearly black. It should read as somewhere the Cipher
 * could plausibly be, not as a rendering of Earth.
 */

import { createNoise2D } from "simplex-noise";

export const WORLD = {
  radius: 690,
  groundSize: 1700,
  segments: 300,
  seed: 20261024,
  waterLevel: 8,
  /** The plaza the Axis is built on. */
  plazaY: 22,
  mountainStart: 420,
};

export const LAKE = { x: -252, z: 138, radius: 150, carveRadius: 190, depth: 34 };

export const HUB = { x: 0, z: 0, radius: 46, blend: 78, y: WORLD.plazaY };

/** Flat pads under the built places. Order matters: later pads win. */
const PADS: { x: number; z: number; radius: number; blend: number; y: number }[] = [
  { x: 0, z: 0, radius: 46, blend: 80, y: WORLD.plazaY },
  { x: 0, z: -150, radius: 26, blend: 46, y: 24.5 },
  { x: -148, z: 28, radius: 30, blend: 54, y: 23 },
  { x: 150, z: 36, radius: 34, blend: 58, y: 21 },
  { x: 122, z: -166, radius: 24, blend: 44, y: 25.5 },
  { x: -188, z: -36, radius: 42, blend: 64, y: 26 },
  { x: 0, z: 136, radius: 62, blend: 86, y: 20 },
  { x: 0, z: -268, radius: 16, blend: 36, y: 30 },
  { x: -228, z: 150, radius: 18, blend: 40, y: 10 },
];

function alea(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseA = createNoise2D(alea(WORLD.seed));
const noiseB = createNoise2D(alea(WORLD.seed + 101));
const noiseC = createNoise2D(alea(WORLD.seed + 202));

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function fbm(x: number, z: number, octaves = 4): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noiseA(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridge(x: number, z: number): number {
  return 1 - Math.abs(noiseB(x, z));
}

/** The ground before any built pad is levelled into it. */
export function baseHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);

  // Rolling basin floor. Two noise scales: a broad landform and a walkable
  // ripple, neither large enough to hide a landmark.
  let h =
    16 +
    fbm(x * 0.0032, z * 0.0032, 4) * 27 +
    noiseB(x * 0.013, z * 0.013) * 4.5 +
    noiseC(x * 0.06, z * 0.06) * 0.65;

  // The rim: ridged mountains that close the valley and give the sun something
  // to set behind.
  const mountain = smoothstep(WORLD.mountainStart, 760, r);
  if (mountain > 0) {
    const ridged = 0.45 + 0.55 * ridge(x * 0.0045 + 3.1, z * 0.0045 - 7.4);
    h += mountain * mountain * (145 + 215 * ridged);
  }

  // A broken shelf inside the rim, so the horizon is not one clean wall.
  const shelf =
    Math.exp(-Math.pow((r - 320) / 62, 2)) *
    (0.5 + 0.5 * noiseC(x * 0.005 + 9, z * 0.005 - 2));
  h += shelf * 30;

  // The lake: a real basin, not a blue disc laid on flat ground.
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  const basin = 1 - smoothstep(LAKE.radius * 0.45, LAKE.carveRadius, ld);
  h -= basin * LAKE.depth;

  return h;
}

/** The finished ground height, with the plaza and every pad levelled. */
export function heightAt(x: number, z: number): number {
  let h = baseHeight(x, z);
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    const t = 1 - smoothstep(p.radius, p.blend, d);
    if (t > 0) h = mix(h, p.y, t * t * (3 - 2 * t));
  }
  return h;
}

/** Surface normal, from central differences of the same height function. */
export function normalAt(x: number, z: number, eps = 1.2): [number, number, number] {
  const hL = heightAt(x - eps, z);
  const hR = heightAt(x + eps, z);
  const hD = heightAt(x, z - eps);
  const hU = heightAt(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

export function isWater(x: number, z: number): boolean {
  return heightAt(x, z) < WORLD.waterLevel - 0.05;
}

export function lakeDepth(x: number, z: number): number {
  return WORLD.waterLevel - heightAt(x, z);
}

/** Where the sun is, as a unit vector. Shared by light, water and rays. */
export const SUN_DIR = (() => {
  const v = [0.62, 0.22, 0.55];
  const l = Math.hypot(...v);
  return { x: v[0] / l, y: v[1] / l, z: v[2] / l };
})();

/** Where a body arrives: south of the Axis, facing the Meridian. */
export const SPAWN = { x: 0, z: 41.5, yaw: 0 };
