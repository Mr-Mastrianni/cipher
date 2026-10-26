/**
 * The Cipher, built once.
 *
 * A valley at dusk with one centre and eight ways out of it. Everything is
 * procedural except the CC0 PBR surfaces: the terrain is a
 * single displaced plane, the lake is a basin in the same height function, and
 * the architecture is assembled from primitives whose proportions are in metres.
 *
 * The places are the site's own concerns made walkable:
 *
 *   the Axis          the 27 mansions, the 9 grahas, the 9 centres, the Meridian
 *   the Observatory   the member's KP chart as an astrolabe, and the bodygraph
 *   the Amphitheatre  the speaking floor, where a member teaches the room
 *   the Studio        the shared build grid
 *   the Sanctuary     the nine graha stones that sound
 *   the Terraces      twelve plots a member can claim and build inside
 *   the Commons       eight pavilions, one per Collective room
 *   the Lake          still water, and one stone on the far shore
 *   the Sky Gate      a ring on the north rise, and 1,800 m above it
 *   the Sky Wheel     the grahas where they actually are, with no floor
 *
 * The astronomy is passed in; the world never invents a longitude. The chart
 * notes are tradition and are labelled as such in the interface.
 */

import * as THREE from "three";
import {
  ATTUNEMENTS,
  BUILD_MATERIALS,
  BUILD_PIECES,
  CENTRES,
  GRAHAS,
  NAKSHATRAS,
  PAVILIONS,
  PLACES,
  PLOTS,
  RASIS_META,
} from "../content/world";
import type { BuildMaterial } from "../content/world";
import type { MemberChart, PlotState, SessionState } from "../state";
import { LAKE, SUN_DIR, WORLD, heightAt, normalAt, smoothstep } from "./terrain";
import type { Assets } from "./textures";
import {
  boulderMaterial,
  emissiveMaterial,
  goldMaterial,
  installAssets,
  makeTerrainMaterial,
  metalMaterial,
  rockMaterial,
  sandMaterial,
  waterMaterial,
} from "./textures";
import {
  fireTexture,
  glowSprite,
  glyphSprite,
  starTexture,
  textSprite,
} from "./sprites";
import { createSpace, type SkyPosition, type SpaceWorld } from "./space";

type Quality = "high" | "balanced" | "low";
type TimeOfDay = "dusk" | "void" | "golden";

export type InteractKind =
  | "axis"
  | "observatory"
  | "amphitheatre"
  | "studio"
  | "sanctuary"
  | "terraces"
  | "commons"
  | "lake"
  | "skygate"
  | "graha"
  | "nakshatra"
  | "centre"
  | "plot";

export interface Interactable {
  kind: InteractKind;
  id: string;
  title: string;
  hint: string;
  action?: string;
  position: THREE.Vector3;
  radius: number;
  color?: string;
}

export interface Fire {
  sprites: THREE.Sprite[];
  base: THREE.Vector3;
  phase: number;
}

export interface PlotVisual {
  index: number;
  group: THREE.Group;
  banner: THREE.Mesh;
  text: THREE.Sprite;
  beacon: THREE.Mesh;
  light: THREE.PointLight;
}

export interface World {
  root: THREE.Group;
  terrain: THREE.Mesh;
  water: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fill: THREE.DirectionalLight;
  stars: THREE.Points;
  motes: THREE.Points;
  fires: Fire[];
  space: SpaceWorld;
  plots: PlotVisual[];
  interactables: Interactable[];
  timeOfDay: TimeOfDay;
  spaceBlend: number;
  exposure: number;
  setTimeOfDay(t: TimeOfDay): void;
  setPlots(plots: PlotState[]): void;
  setSession(session: SessionState | null): void;
  update(time: number, dt: number, player: THREE.Vector3): void;
  surfaceAt(x: number, z: number, y: number): number;
  dispose(): void;
}

const PRESETS: Record<
  TimeOfDay,
  {
    sun: number;
    sunI: number;
    hemiSky: number;
    hemiGround: number;
    hemiI: number;
    fog: number;
    fogDensity: number;
    exposure: number;
    envI: number;
    bgI: number;
    star: number;
    glow: number;
  }
> = {
  dusk: {
    sun: 0xc6a6ff,
    sunI: 2.6,
    hemiSky: 0x8a75c8,
    hemiGround: 0x2e2444,
    hemiI: 1.0,
    fog: 0x3b3258,
    fogDensity: 0.0016,
    exposure: 1.44,
    envI: 0.55,
    bgI: 0.62,
    star: 0.5,
    glow: 0.34,
  },
  void: {
    sun: 0x9fb6ff,
    sunI: 0.7,
    hemiSky: 0x253454,
    hemiGround: 0x12101c,
    hemiI: 0.34,
    fog: 0x0b0a18,
    fogDensity: 0.0017,
    exposure: 1.5,
    envI: 0.34,
    bgI: 0.48,
    star: 0.78,
    glow: 0.2,
  },
  golden: {
    sun: 0xffcf9a,
    sunI: 2.15,
    hemiSky: 0x93a9d8,
    hemiGround: 0x33281e,
    hemiI: 0.22,
    fog: 0x6b5a49,
    fogDensity: 0.0017,
    exposure: 0.92,
    envI: 0.44,
    bgI: 0.6,
    star: 0,
    glow: 0.32,
  },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TMP = new THREE.Object3D();

/** Places that must stay clear of grass, trees, shrubs and boulders. */
const CLEAR_ZONES: readonly { x: number; z: number; r: number }[] = [
  { x: 0, z: 0, r: 58 },
  { x: 0, z: -150, r: 38 },
  { x: -148, z: 28, r: 44 },
  { x: 150, z: 36, r: 44 },
  { x: 122, z: -166, r: 38 },
  { x: -188, z: -36, r: 50 },
  { x: 0, z: 136, r: 82 },
  { x: 0, z: -268, r: 28 },
  { x: -252, z: 138, r: LAKE.radius * 0.92 },
];

function isClear(x: number, z: number) {
  for (const zone of CLEAR_ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) < zone.r) return false;
  }
  return true;
}

function bladeGeometry(): THREE.BufferGeometry {
  const levels = 5;
  const width = [0.055, 0.045, 0.033, 0.02, 0.006];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < levels; i++) {
    const t = i / (levels - 1);
    const y = t;
    const w = width[i];
    const bend = Math.sin(t * Math.PI * 0.5) * 0.12;
    positions.push(-w, y, bend, w, y, bend);
    uvs.push(0, t, 1, t);
    if (i < levels - 1) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function fireGroup(
  scene: THREE.Object3D,
  at: THREE.Vector3,
  scale: number,
  fires: Fire[],
  withLight = true,
): THREE.PointLight | null {
  const tex = fireTexture();
  const sprites: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(at);
    s.position.y += i * 0.4 * scale;
    s.scale.setScalar((2.1 + Math.random() * 1.5) * scale);
    s.userData.phase = Math.random() * 10;
    s.userData.base = s.scale.x;
    scene.add(s);
    sprites.push(s);
  }
  fires.push({ sprites, phase: Math.random() * 10, base: at.clone() });
  if (!withLight) return null;
  const light = new THREE.PointLight(0xd4ff3f, 16 * scale, 26 * scale, 2);
  light.position.copy(at).add(new THREE.Vector3(0, 1.2 * scale, 0));
  scene.add(light);
  return light;
}

/** A stone path that follows the terrain in short segments. */
function pathOnGround(
  root: THREE.Object3D,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  width: number,
  mat: THREE.Material,
) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const segments = Math.max(2, Math.round(length / 10));
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const mx = x1 + dx * ((t0 + t1) / 2);
    const mz = z1 + dz * ((t0 + t1) / 2);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, length / segments + 0.4), mat);
    seg.position.set(mx, heightAt(mx, mz) + 0.02, mz);
    seg.rotation.y = yaw;
    seg.receiveShadow = true;
    root.add(seg);
  }
}

/** A canvas texture we can redraw in place when shared state changes. */
function drawBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: {
    kicker: string;
    title: string;
    sub: string;
    color: string;
    glyph?: string;
    dim?: boolean;
  },
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = opts.dim ? "rgba(10,8,20,0.72)" : "rgba(10,8,20,0.9)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = opts.color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.globalAlpha = 1;
  if (opts.glyph) {
    ctx.font = "400 96px ui-serif, Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = opts.color;
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = 18;
    ctx.fillText(opts.glyph, 34, h * 0.5);
    ctx.shadowBlur = 0;
  }
  const left = opts.glyph ? 150 : 34;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillStyle = opts.color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(opts.kicker.toUpperCase(), left, 54);
  ctx.globalAlpha = 1;
  ctx.font = "700 54px Syne, ui-sans-serif, sans-serif";
  ctx.fillStyle = "#f4f1ff";
  ctx.fillText(opts.title, left, 118);
  ctx.font = "400 26px ui-sans-serif, sans-serif";
  ctx.fillStyle = "rgba(244,241,255,0.66)";
  ctx.fillText(opts.sub, left, 160);
}

export function createWorld(
  scene: THREE.Scene,
  assets: Assets,
  quality: Quality,
  sky: SkyPosition[],
  chart: MemberChart | null,
): World {
  installAssets(assets);
  const root = new THREE.Group();
  scene.add(root);
  const q = quality;
  const rand = rng(WORLD.seed);

  /* ── terrain ───────────────────────────────────────────────────────────── */

  const segments = q === "high" ? WORLD.segments : q === "balanced" ? 200 : 120;
  const geo = new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const terrainMat = makeTerrainMaterial(assets.grass, assets.rock, assets.sand, {
    grass: [0.72, 1.02, 0.84],
    rock: [0.92, 0.84, 1.02],
    sand: [0.74, 0.68, 0.86],
  });
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  root.add(terrain);

  // A dark outer skirt: from high up, the edge of the made world should read as
  // a sea of shadow rather than the end of a plane.
  const skirt = new THREE.Mesh(
    new THREE.CircleGeometry(9000, 64),
    new THREE.MeshStandardMaterial({ color: 0x07060e, roughness: 1, metalness: 0 }),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -14;
  root.add(skirt);

  /* ── water ─────────────────────────────────────────────────────────────── */

  const waterGeo = new THREE.PlaneGeometry(LAKE.carveRadius * 2.35, LAKE.carveRadius * 2.05, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = waterMaterial(assets.waterNormal);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(LAKE.x, WORLD.waterLevel, LAKE.z);
  water.receiveShadow = true;
  root.add(water);

  /* ── grass ─────────────────────────────────────────────────────────────── */

  const grassGeo = bladeGeometry();
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.5,
  });
  const grassUniform = { value: 0 };
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float wposX = instanceMatrix[3][0];
        float wposZ = instanceMatrix[3][2];
        float sway = sin(uTime * 1.3 + wposX * 0.09 + wposZ * 0.07) * 0.16
                   + sin(uTime * 2.9 + wposX * 0.4) * 0.05;
        transformed.x += sway * max(0.0, position.y);
        transformed.z += sway * 0.45 * max(0.0, position.y);`,
      );
  };
  grassMat.customProgramCacheKey = () => "cipher-grass-v1";
  const grassCount = q === "high" ? 12000 : q === "balanced" ? 6000 : 1600;
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grass.frustumCulled = false;
  grass.receiveShadow = true;
  let gi = 0;
  const color = new THREE.Color();
  for (let attempt = 0; attempt < grassCount * 4 && gi < grassCount; attempt++) {
    const x = (rand() * 2 - 1) * 340;
    const z = (rand() * 2 - 1) * 340;
    const r = Math.hypot(x, z);
    if (r < 52 || r > 350) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 0.86) continue;
    if (!isClear(x, z)) continue;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel + 1.2) continue;
    const n = normalAt(x, z);
    if (n[1] < 0.7) continue;
    const s = 0.42 + rand() * 0.55;
    TMP.position.set(x, h - 0.03, z);
    TMP.rotation.set(0, rand() * Math.PI * 2, 0);
    TMP.scale.set(0.7 + rand() * 0.7, s, 0.7 + rand() * 0.7);
    TMP.updateMatrix();
    grass.setMatrixAt(gi, TMP.matrix);
    color.setHSL(0.34 + rand() * 0.07, 0.3 + rand() * 0.14, 0.16 + rand() * 0.1);
    grass.setColorAt(gi, color);
    gi++;
  }
  grass.count = gi;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  root.add(grass);

  /* ── trees, shrubs and boulders ───────────────────────────────────────── */

  const treeCount = q === "high" ? 64 : q === "balanced" ? 36 : 16;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.42, 1, 7).translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x30263a, roughness: 0.95, metalness: 0 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyGeo = new THREE.SphereGeometry(1, 9, 6);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount * 3);
  trunks.castShadow = canopies.castShadow = true;
  trunks.receiveShadow = canopies.receiveShadow = true;
  let ti = 0;
  let ci = 0;
  for (let attempt = 0; attempt < 900 && ti < treeCount; attempt++) {
    const x = (rand() * 2 - 1) * 420;
    const z = (rand() * 2 - 1) * 420;
    const r = Math.hypot(x, z);
    if (r < 78) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 0.92) continue;
    if (!isClear(x, z)) continue;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel + 1.8) continue;
    const n = normalAt(x, z);
    if (n[1] < 0.72) continue;
    const height = 4.5 + rand() * 4.5;
    const spread = 2.4 + rand() * 2.2;
    TMP.position.set(x, h, z);
    TMP.rotation.set(0, rand() * Math.PI * 2, 0);
    TMP.scale.set(1, height, 1);
    TMP.updateMatrix();
    trunks.setMatrixAt(ti, TMP.matrix);
    const tones = [0x1f3a38, 0x27463f, 0x2f4b3a, 0x233b40];
    for (let c = 0; c < 3; c++) {
      TMP.position.set(
        x + (rand() - 0.5) * spread * 1.1,
        h + height * (0.82 + c * 0.08),
        z + (rand() - 0.5) * spread * 1.1,
      );
      TMP.rotation.set(0, rand() * Math.PI, 0);
      TMP.scale.set(
        spread * (0.55 + rand() * 0.5),
        spread * (0.16 + rand() * 0.1),
        spread * (0.55 + rand() * 0.5),
      );
      TMP.updateMatrix();
      canopies.setMatrixAt(ci, TMP.matrix);
      canopies.setColorAt(ci, new THREE.Color(tones[Math.floor(rand() * tones.length)]));
      ci++;
    }
    ti++;
  }
  trunks.count = ti;
  canopies.count = ci;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  root.add(trunks, canopies);

  const shrubCount = q === "high" ? 200 : q === "balanced" ? 100 : 36;
  const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x273d38, roughness: 1, flatShading: true });
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount);
  shrubs.castShadow = true;
  let si = 0;
  for (let attempt = 0; attempt < shrubCount * 6 && si < shrubCount; attempt++) {
    const x = (rand() * 2 - 1) * 380;
    const z = (rand() * 2 - 1) * 380;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel + 1.5) continue;
    if (normalAt(x, z)[1] < 0.72) continue;
    if (!isClear(x, z)) continue;
    TMP.position.set(x, h + 0.2, z);
    TMP.rotation.set(rand(), rand() * Math.PI, rand());
    const s = 0.5 + rand() * 1.1;
    TMP.scale.set(s * 1.4, s * 0.7, s * 1.4);
    TMP.updateMatrix();
    shrubs.setMatrixAt(si++, TMP.matrix);
  }
  shrubs.count = si;
  shrubs.instanceMatrix.needsUpdate = true;
  root.add(shrubs);

  const boulderCount = q === "high" ? 150 : q === "balanced" ? 80 : 34;
  const boulderGeo = new THREE.IcosahedronGeometry(1, 2);
  const boulderMat = boulderMaterial(1.2);
  boulderMat.flatShading = true;
  boulderMat.needsUpdate = true;
  const boulders = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
  boulders.castShadow = true;
  boulders.receiveShadow = true;
  let bi = 0;
  for (let attempt = 0; attempt < boulderCount * 8 && bi < boulderCount; attempt++) {
    const x = (rand() * 2 - 1) * 650;
    const z = (rand() * 2 - 1) * 650;
    const r = Math.hypot(x, z);
    if (r < 84) continue;
    if (!isClear(x, z)) continue;
    const h = heightAt(x, z);
    const n = normalAt(x, z);
    if (n[1] < 0.58) continue;
    const big = r > 360;
    const s = (big ? 5 : 1.1) + rand() * (big ? 11 : 4.2);
    TMP.position.set(x, h - s * 0.45, z);
    TMP.rotation.set(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5);
    TMP.scale.set(s * (0.8 + rand() * 0.7), s * (0.6 + rand() * 0.6), s * (0.8 + rand() * 0.7));
    TMP.updateMatrix();
    boulders.setMatrixAt(bi++, TMP.matrix);
  }
  boulders.count = bi;
  boulders.instanceMatrix.needsUpdate = true;
  root.add(boulders);

  /* ── shared materials ─────────────────────────────────────────────────── */

  const stone = sandMaterial(6);
  const darkStone = rockMaterial(3);
  const gold = goldMaterial();
  const blackStone = metalMaterial(3, 0x1a1826);
  const lime = emissiveMaterial(0xd4ff3f, 1.25);
  const cyan = emissiveMaterial(0x5ce1e6, 1.1);
  const violet = emissiveMaterial(0xb45cff, 1.0);
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x6b6680,
    roughness: 0.95,
    metalness: 0.04,
  });

  /* ── paths out of the Axis ─────────────────────────────────────────────── */

  pathOnGround(root, 0, 44, 0, -132, 2.4, pathMat);
  pathOnGround(root, -36, 12, -126, 26, 2.1, pathMat);
  pathOnGround(root, 36, 12, 128, 34, 2.1, pathMat);
  pathOnGround(root, -32, 18, -160, -30, 1.9, pathMat);
  pathOnGround(root, 24, 26, 108, -148, 1.9, pathMat);
  pathOnGround(root, 0, 44, 0, 90, 2.4, pathMat);
  pathOnGround(root, 0, -170, 0, -252, 1.8, pathMat);
  pathOnGround(root, -44, 30, -210, 96, 1.6, pathMat);

  /* ── the Axis ──────────────────────────────────────────────────────────── */

  const axis = new THREE.Group();
  axis.position.set(0, 22.12, 0);
  const plazaMat = rockMaterial(30).clone();
  plazaMat.color.set(0x6d6688);
  plazaMat.roughness = 0.88;
  plazaMat.metalness = 0.06;
  plazaMat.needsUpdate = true;
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(45, 48, 3.2, 96), plazaMat);
  plaza.position.y = -1.6;
  plaza.receiveShadow = true;
  plaza.castShadow = true;
  axis.add(plaza);

  for (const r of [9, 27, 43]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 4, 160), lime);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    axis.add(ring);
  }

  // The 27 mansions: a small engraved stone per division.
  NAKSHATRAS.forEach((n, i) => {
    const a = ((i / 27) * Math.PI * 2) - Math.PI / 2;
    const x = Math.cos(a) * 39.5;
    const z = Math.sin(a) * 39.5;
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.15, 0.3), darkStone);
    marker.position.set(x, 0.57, z);
    marker.rotation.y = -a + Math.PI / 2;
    marker.castShadow = true;
    axis.add(marker);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(n.css), toneMapped: false }));
    cap.position.set(x, 1.19, z);
    cap.rotation.y = -a + Math.PI / 2;
    axis.add(cap);
    const num = textSprite(String(i + 1).padStart(2, "0"), {
      color: n.css,
      size: 32,
      scale: 0.26,
    });
    num.position.set(x * 0.92, 1.6, z * 0.92);
    axis.add(num);
  });

  // The nine grahas: a stone per graha on the inner ring.
  GRAHAS.forEach((graha, i) => {
    const a = ((i / 9) * Math.PI * 2) - Math.PI / 2;
    const x = Math.cos(a) * 27;
    const z = Math.sin(a) * 27;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = -a;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.5, 8), darkStone);
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const obelisk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 1.2), stone);
    obelisk.position.y = 2.2;
    obelisk.castShadow = true;
    group.add(obelisk);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), new THREE.MeshBasicMaterial({ color: graha.color, toneMapped: false }));
    tip.position.y = 4.2;
    group.add(tip);
    const halo = glowSprite(graha.css, 4.2, 0.35);
    halo.position.y = 4.2;
    group.add(halo);
    const glyph = glyphSprite(graha.glyph, graha.css, 0.42);
    glyph.position.set(0, 3.0, 0.66);
    group.add(glyph);
    axis.add(group);
  });

  // The Meridian.
  {
    const meridian = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 30, 2.2), stone);
    shaft.position.y = 15;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    meridian.add(shaft);
    const taper = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.2, 5, 4), gold);
    taper.position.y = 32.4;
    taper.rotation.y = Math.PI / 4;
    meridian.add(taper);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 18), lime);
    orb.position.y = 35.4;
    meridian.add(orb);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 900, 5, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xd4ff3f,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    beam.position.y = 450;
    meridian.add(beam);
    for (let i = 0; i < 6; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.12, 2.45), i % 2 === 0 ? lime : gold);
      band.position.y = 3 + i * 4.4;
      meridian.add(band);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.4, 1.2, 8), darkStone);
    base.position.y = 0.6;
    base.castShadow = true;
    meridian.add(base);
    const glow = glowSprite("rgba(212,255,63,1)", 8, 0.35);
    glow.position.y = 1.4;
    meridian.add(glow);
    axis.add(meridian);
  }

  // Three shallow steps from the processional way onto the plaza.
  for (let step = 0; step < 4; step++) {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(13 - step * 1.4, 0.24, 1.5), stone);
    stair.position.set(0, 0.1 - step * 0.02, 50 - step * 1.4);
    stair.receiveShadow = true;
    axis.add(stair);
  }

  // The south gate and four braziers.
  {
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 9, 1.7), stone);
      pillar.position.set(side * 8, 4.5, 44);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      axis.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), gold);
      cap.position.set(side * 8, 9.15, 44);
      axis.add(cap);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 2.8), darkStone);
      base.position.set(side * 8, 0.45, 44);
      axis.add(base);
      const glyph = glyphSprite(side < 0 ? "\u2726" : "\u25c7", "#d4ff3f", 0.35);
      glyph.position.set(side * 8, 6.4, 44.9);
      axis.add(glyph);
    }
  }

  const fires: Fire[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 15;
    const z = Math.sin(a) * 15;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.55, 0.8, 12), blackStone);
    bowl.position.set(x, 0.4, z);
    axis.add(bowl);
    const flame = new THREE.Vector3(x, 22.12 + 1.1, z);
    fireGroup(root, flame, 0.9, fires, i < 2);
  }

  const paths = ["axis", "observatory", "amphitheatre", "studio", "sanctuary", "terraces", "commons", "lake", "skygate"];
  void paths;

  // The nine HD centres, outside the plaza, lit by the member's definition.
  const centreStones: { key: string; tip: THREE.Mesh; halo: THREE.Sprite }[] = [];
  CENTRES.forEach((centre, i) => {
    const a = ((i / 9) * Math.PI * 2) - Math.PI / 2 + Math.PI / 9;
    const x = Math.cos(a) * 56;
    const z = Math.sin(a) * 56;
    const group = new THREE.Group();
    group.position.set(x, heightAt(x, z), z);
    group.rotation.y = -a;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.7, 6), darkStone);
    plinth.position.y = 0.35;
    plinth.castShadow = true;
    group.add(plinth);
    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.2, 0.8), stone);
    stele.position.y = 2.7;
    stele.castShadow = true;
    stele.receiveShadow = true;
    group.add(stele);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0x3b2f63, toneMapped: false }));
    tip.position.y = 5.2;
    group.add(tip);
    const halo = glowSprite(centre.css, 3.4, 0.06);
    halo.position.y = 5.2;
    group.add(halo);
    const label = textSprite(centre.short, { color: centre.css, size: 44, scale: 0.42 });
    label.position.set(0, 6.2, 0);
    group.add(label);
    root.add(group);
    centreStones.push({ key: centre.key, tip, halo });
  });

  root.add(axis);

  /* ── the Observatory ───────────────────────────────────────────────────── */

  const observatory = new THREE.Group();
  const obsY = heightAt(0, -150);
  observatory.position.set(0, obsY, -150);

  const obsBase = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 2.2, 64), stone);
  obsBase.position.y = 1.1;
  obsBase.receiveShadow = true;
  obsBase.castShadow = true;
  observatory.add(obsBase);
  const obsFloor = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.4, 64), darkStone);
  obsFloor.position.y = 2.2;
  obsFloor.receiveShadow = true;
  observatory.add(obsFloor);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 20;
    const z = Math.sin(a) * 20;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 10, 10), stone);
    col.position.set(x, 7.3, z);
    col.castShadow = true;
    observatory.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.5), gold);
    cap.position.set(x, 12.4, z);
    observatory.add(cap);
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(21, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x171034,
      roughness: 0.3,
      metalness: 0.6,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  dome.position.y = 12.4;
  observatory.add(dome);
  // The basin.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 48), blackStone);
  basin.position.y = 2.5;
  observatory.add(basin);
  const basinWater = new THREE.Mesh(
    new THREE.CircleGeometry(5.6, 48),
    new THREE.MeshBasicMaterial({
      color: 0x0b2a3d,
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    }),
  );
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.y = 2.78;
  observatory.add(basinWater);
  const basinRing = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.06, 4, 72), cyan);
  basinRing.rotation.x = Math.PI / 2;
  basinRing.position.y = 2.82;
  observatory.add(basinRing);
  const basinGlow = glowSprite("rgba(92,225,230,1)", 14, 0.24);
  basinGlow.position.y = 3.4;
  observatory.add(basinGlow);

  const basinRipples = [0, 1].map((index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.025, 4, 72),
      new THREE.MeshBasicMaterial({
        color: 0x5ce1e6,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2.85;
    ring.userData.phase = index * 0.5;
    observatory.add(ring);
    return ring;
  });

  const projectionBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.5, 6.1, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x5ce1e6,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  projectionBeam.position.y = 5.95;
  observatory.add(projectionBeam);

  // The astrolabe: the member's chart, above the basin.
  const astro = new THREE.Group();
  astro.position.y = 9.0;
  astro.rotation.x = 0.3;
  const astroRing = new THREE.Mesh(new THREE.TorusGeometry(9, 0.06, 4, 160), lime);
  astroRing.rotation.x = Math.PI / 2;
  astro.add(astroRing);
  const astroRing2 = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.03, 4, 160), cyan);
  astroRing2.rotation.x = Math.PI / 2;
  astro.add(astroRing2);
  RASIS_META.forEach((rasi, i) => {
    const a = ((i * 30 + 15) * Math.PI) / 180;
    const x = Math.cos(a) * 9;
    const z = Math.sin(a) * 9;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1.1), lime);
    mark.position.set(x, 0.01, z);
    mark.rotation.y = -a + Math.PI / 2;
    astro.add(mark);
    const glyph = glyphSprite(rasi.glyph, "#a9e6c8", 0.28);
    glyph.position.set(x * 1.16, 0.2, z * 1.16);
    astro.add(glyph);
  });
  if (chart) {
    chart.grahas.forEach((g) => {
      const a = (g.lon * Math.PI) / 180;
      const x = Math.cos(a) * 8.4;
      const z = Math.sin(a) * 8.4;
      const glyph = glyphSprite(g.glyph, g.css, 0.42);
      glyph.position.set(x, 0.35, z);
      astro.add(glyph);
      const thread = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(x, 0.2, z)]),
        new THREE.LineBasicMaterial({
          color: new THREE.Color(g.color),
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      astro.add(thread);
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(g.color), toneMapped: false }));
      pip.position.set(x, 0.2, z);
      astro.add(pip);
    });
    // A faint polygon through the grahas, in longitude order. It reads as a
    // constellation drawn by the chart rather than a decoration.
    const ordered = [...chart.grahas].sort((a, b) => a.lon - b.lon);
    if (ordered.length > 1) {
    const chord = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        ...ordered.map((g) => {
          const a = (g.lon * Math.PI) / 180;
          return new THREE.Vector3(Math.cos(a) * 8.4, 0.22, Math.sin(a) * 8.4);
        }),
        (() => {
          const a = (ordered[0].lon * Math.PI) / 180;
          return new THREE.Vector3(Math.cos(a) * 8.4, 0.22, Math.sin(a) * 8.4);
        })(),
      ]),
      new THREE.LineBasicMaterial({
        color: 0x5ce1e6,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    astro.add(chord);
    }
    if (chart.lagna !== null) {
      const a = (chart.lagna * Math.PI) / 180;
      const x = Math.cos(a) * 9.6;
      const z = Math.sin(a) * 9.6;
      const lagna = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 4), gold);
      lagna.position.set(x, 0.5, z);
      lagna.rotation.z = Math.PI;
      astro.add(lagna);
      const label = textSprite("LAGNA", { color: "#d4b25e", size: 30, scale: 0.3 });
      label.position.set(x * 1.08, 1.1, z * 1.08);
      astro.add(label);
    }
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), lime);
  core.position.y = 0.1;
  astro.add(core);
  const coreGlow = glowSprite("rgba(212,255,63,1)", 6, 0.4);
  astro.add(coreGlow);
  const astroLight = new THREE.PointLight(0x5ce1e6, 30, 34, 1.8);
  astroLight.position.y = 0.2;
  astro.add(astroLight);
  observatory.add(astro);

  // Two bodygraph slabs.
  const bodygraphCanvas = document.createElement("canvas");
  bodygraphCanvas.width = 768;
  bodygraphCanvas.height = 512;
  const bodygraphCtx = bodygraphCanvas.getContext("2d")!;
  drawBodygraphScreen(bodygraphCtx, chart);
  const bodygraphTexture = new THREE.CanvasTexture(bodygraphCanvas);
  bodygraphTexture.colorSpace = THREE.SRGBColorSpace;
  bodygraphTexture.needsUpdate = true;

  const chartCanvas = document.createElement("canvas");
  chartCanvas.width = 768;
  chartCanvas.height = 512;
  const chartTableCtx = chartCanvas.getContext("2d")!;
  drawChartScreen(chartTableCtx, chart);
  const chartTableTexture = new THREE.CanvasTexture(chartCanvas);
  chartTableTexture.colorSpace = THREE.SRGBColorSpace;
  chartTableTexture.needsUpdate = true;

  const screens = [
    { side: -1, texture: chartTableTexture },
    { side: 1, texture: bodygraphTexture },
  ];
  for (const screenDef of screens) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 6.4, 0.4), blackStone);
    frame.position.set(screenDef.side * 13, 5.6, -4);
    frame.rotation.y = screenDef.side * 0.35;
    observatory.add(frame);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 5.8),
      new THREE.MeshBasicMaterial({ map: screenDef.texture, toneMapped: false }),
    );
    screen.position.set(screenDef.side * 13, 5.6, -3.77);
    screen.rotation.y = screenDef.side * 0.35;
    observatory.add(screen);
  }
  root.add(observatory);

  /* ── the Amphitheatre ──────────────────────────────────────────────────── */

  const ampY = heightAt(-148, 28);
  const amp = new THREE.Group();
  amp.position.set(-148, ampY, 28);
  const theatreFloor = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 0.6, 48), darkStone);
  theatreFloor.position.y = 0.3;
  theatreFloor.receiveShadow = true;
  amp.add(theatreFloor);
  const floorGlow = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.8, 64), lime);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.62;
  amp.add(floorGlow);
  for (let tier = 0; tier < 7; tier++) {
    const inner = 10 + tier * 2.6;
    const outer = inner + 2.6;
    const y = 0.7 + tier * 0.85;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 64, 1, Math.PI * 0.18, Math.PI * 1.64),
      stone,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    ring.receiveShadow = true;
    amp.add(ring);
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(outer, outer, 0.85, 64, 1, true, Math.PI * 0.18, Math.PI * 1.64),
      darkStone,
    );
    riser.position.y = y - 0.43;
    amp.add(riser);
  }
  const lectern = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.8), stone);
  lectern.position.set(0, 1.1, 2.6);
  lectern.castShadow = true;
  amp.add(lectern);
  const lecternTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1), gold);
  lecternTop.position.set(0, 1.7, 2.6);
  lecternTop.rotation.x = -0.3;
  amp.add(lecternTop);

  const sessionCanvas = document.createElement("canvas");
  sessionCanvas.width = 1024;
  sessionCanvas.height = 420;
  const sessionCtx = sessionCanvas.getContext("2d")!;
  const sessionTexture = new THREE.CanvasTexture(sessionCanvas);
  sessionTexture.colorSpace = THREE.SRGBColorSpace;
  const sessionMat = new THREE.MeshBasicMaterial({ map: sessionTexture, toneMapped: false });
  const sessionSign = new THREE.Mesh(new THREE.PlaneGeometry(18, 7.4), sessionMat);
  sessionSign.position.set(-2, 6.6, -8.2);
  sessionSign.rotation.y = 0.18;
  amp.add(sessionSign);
  const signFrame = new THREE.Mesh(new THREE.BoxGeometry(19, 8.4, 0.4), blackStone);
  signFrame.position.set(-2, 6.6, -8.45);
  signFrame.rotation.y = 0.18;
  amp.add(signFrame);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.4, 0.4), gold);
    post.position.set(side * 7 + -2, 3.7, -8.4);
    amp.add(post);
  }
  drawSessionScreen(sessionCtx, null);
  sessionTexture.needsUpdate = true;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI * 0.55 + i * 0.2;
    const x = Math.cos(a) * 27;
    const z = Math.sin(a) * 27;
    fireGroup(root, new THREE.Vector3(-148 + x, ampY + 3, 28 + z), 0.7, fires, false);
  }
  root.add(amp);

  /* ── the Studio ────────────────────────────────────────────────────────── */

  const studioY = heightAt(150, 36);
  const studio = new THREE.Group();
  studio.position.set(150, studioY, 36);
  const studioFloor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 28), darkStone);
  studioFloor.position.y = 0.2;
  studioFloor.receiveShadow = true;
  studio.add(studioFloor);
  const grid = new THREE.GridHelper(32, 32, 0xd4ff3f, 0x3b2f63);
  grid.position.y = 0.46;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  (grid.material as THREE.Material).depthWrite = false;
  studio.add(grid);
  const studioLight = new THREE.PointLight(0xb45cff, 34, 38, 1.8);
  studioLight.position.set(0, 5.2, 0);
  studio.add(studioLight);
  const benchLight = new THREE.PointLight(0xd4ff3f, 12, 14, 2);
  benchLight.position.set(0, 2.4, -8);
  studio.add(benchLight);
  const studioRing = new THREE.Mesh(new THREE.TorusGeometry(15, 0.08, 4, 96), violet);
  studioRing.rotation.x = Math.PI / 2;
  studioRing.position.y = 0.48;
  studio.add(studioRing);

  // Material racks: a frame with a cube of each material.
  BUILD_MATERIALS.forEach((m, i) => {
    const x = -13 + (i % 4) * 2.4;
    const z = -11 + Math.floor(i / 4) * 2.2;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({
      color: m.color,
      roughness: m.roughness,
      metalness: m.metalness,
      emissive: m.emissive,
      emissiveIntensity: m.emissiveIntensity,
    }));
    cube.position.set(x, 1.9 + Math.floor(i / 4) * 1.6, z);
    cube.castShadow = true;
    studio.add(cube);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.7), gold);
    stand.position.set(x, 1.12 + Math.floor(i / 4) * 1.6, z);
    studio.add(stand);
  });

  // Three sample plinths, so the grid is legible from the path.
  BUILD_PIECES.slice(0, 3).forEach((piece, i) => {
    const a = (i / 3) * Math.PI * 2;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 2.4), stone);
    plinth.position.set(Math.cos(a) * 9, 0.75, Math.sin(a) * 9);
    studio.add(plinth);
    const sample = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshStandardMaterial({ color: BUILD_MATERIALS[i].color, emissive: BUILD_MATERIALS[i].emissive, emissiveIntensity: BUILD_MATERIALS[i].emissiveIntensity }),
    );
    sample.position.set(Math.cos(a) * 9, 1.7, Math.sin(a) * 9);
    studio.add(sample);
  });
  const workBench = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 2.2), blackStone);
  workBench.position.set(0, 0.85, -8);
  studio.add(workBench);
  const benchGlow = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.05, 2), violet);
  benchGlow.position.set(0, 1.32, -8);
  studio.add(benchGlow);
  root.add(studio);

  /* ── the Sanctuary ─────────────────────────────────────────────────────── */

  const sancY = heightAt(122, -166);
  const sanctuary = new THREE.Group();
  sanctuary.position.set(122, sancY, -166);
  const sancFloor = new THREE.Mesh(new THREE.CylinderGeometry(24, 26, 0.8, 64), stone);
  sancFloor.position.y = 0.4;
  sancFloor.receiveShadow = true;
  sanctuary.add(sancFloor);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.2, 1.1, 32), blackStone);
  bowl.position.y = 1.0;
  sanctuary.add(bowl);
  const bowlGlow = new THREE.Mesh(new THREE.CircleGeometry(3.9, 48), violet);
  bowlGlow.rotation.x = -Math.PI / 2;
  bowlGlow.position.y = 1.58;
  sanctuary.add(bowlGlow);
  const bowlLight = new THREE.PointLight(0xb45cff, 24, 30, 1.8);
  bowlLight.position.y = 2.6;
  sanctuary.add(bowlLight);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7 + i * 6, 0.05, 4, 96), i % 2 === 0 ? cyan : lime);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.85;
    sanctuary.add(ring);
  }

  // The nine graha stones, at the positions the audio uses.
  ATTUNEMENTS.filter((a) => a.id.startsWith("graha-")).forEach((attunement) => {
    const x = attunement.x - 122;
    const z = attunement.z + 166;
    const group = new THREE.Group();
    group.position.set(x, 0.8, z);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 3.4, 6), darkStone);
    stone.position.y = 1.7;
    stone.castShadow = true;
    group.add(stone);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: attunement.color, toneMapped: false }));
    cap.position.y = 3.6;
    group.add(cap);
    const halo = glowSprite(attunement.css, 3, 0.28);
    halo.position.y = 3.6;
    group.add(halo);
    const glyph = glyphSprite(attunement.transliteration.slice(0, 2), attunement.css, 0.3);
    glyph.position.set(0, 2.4, 0.9);
    group.add(glyph);
    group.userData.attunement = attunement.id;
    sanctuary.add(group);
  });
  root.add(sanctuary);

  /* ── the Terraces ──────────────────────────────────────────────────────── */

  const terrY = heightAt(-188, -36);
  const terraces = new THREE.Group();
  terraces.position.set(-188, terrY, -36);
  const terraceMat = rockMaterial(18).clone();
  terraceMat.color.set(0x77708f);
  terraceMat.roughness = 0.9;
  terraceMat.needsUpdate = true;
  const terraceBase = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 1.4, 64), terraceMat);
  terraceBase.position.y = 0.7;
  terraceBase.receiveShadow = true;
  terraces.add(terraceBase);
  const terraceRing = new THREE.Mesh(new THREE.TorusGeometry(32, 0.1, 4, 128), violet);
  terraceRing.rotation.x = Math.PI / 2;
  terraceRing.position.y = 1.45;
  terraces.add(terraceRing);
  const terraceLight = new THREE.PointLight(0xff8fd1, 18, 46, 1.9);
  terraceLight.position.y = 4;
  terraces.add(terraceLight);

  const plots: PlotVisual[] = [];
  PLOTS.forEach((plot) => {
    const g = new THREE.Group();
    g.position.set(plot.x - -188, 1.4, plot.z - -36);
    g.rotation.y = plot.ry;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.4, 6), darkStone);
    base.position.y = 0.2;
    base.receiveShadow = true;
    g.add(base);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), stone);
    pedestal.position.y = 1.0;
    pedestal.castShadow = true;
    g.add(pedestal);

    const bannerCanvas = document.createElement("canvas");
    bannerCanvas.width = 512;
    bannerCanvas.height = 256;
    const bannerCtx = bannerCanvas.getContext("2d")!;
    drawBanner(bannerCtx, 512, 256, {
      kicker: `Terrace ${plot.index + 1}`,
      title: "Unclaimed",
      sub: "press E to claim",
      color: "#776a9e",
      glyph: "\u25c7",
      dim: true,
    });
    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 2.8),
      new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
    );
    banner.position.set(0, 3.4, 0);
    g.add(banner);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 6), gold);
    pole.position.set(0, 2.2, 0);
    g.add(pole);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), emissiveMaterial(0x776a9e, 0.8));
    beacon.position.y = 5.8;
    g.add(beacon);
    // A dozen real point lights would cost every material a dozen uniforms for
    // almost no visible gain. The beacon itself is emissive; the light is kept
    // in the graph only for the setPlots contract, and stays invisible.
    const light = new THREE.PointLight(0x776a9e, 0, 10, 2);
    light.position.y = 5.6;
    light.visible = false;
    g.add(light);

    const text = textSprite("Unclaimed", {
      color: "#a99bd0",
      sub: "Terrace " + (plot.index + 1),
      size: 32,
      scale: 0.72,
    });
    text.position.set(0, 6.6, 0);
    text.visible = false;
    g.add(text);

    terraces.add(g);
    plots.push({ index: plot.index, group: g, banner, text, beacon, light });
  });
  root.add(terraces);

  /* ── the Commons ───────────────────────────────────────────────────────── */

  const commonsY = heightAt(0, 136);
  const commons = new THREE.Group();
  commons.position.set(0, commonsY, 136);
  PAVILIONS.forEach((pavilion, i) => {
    const g = new THREE.Group();
    g.position.set(pavilion.x, 0, pavilion.z - 136);
    g.rotation.y = Math.atan2(-pavilion.x, -(pavilion.z - 136));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7, 0.5, 8), stone);
    base.position.y = 0.25;
    base.receiveShadow = true;
    g.add(base);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 5, 8), stone);
        col.position.set(sx * 3.4, 2.9, sz * 3.4);
        col.castShadow = true;
        g.add(col);
      }
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.2, 4), new THREE.MeshStandardMaterial({
      color: 0x171034,
      roughness: 0.6,
      metalness: 0.4,
      emissive: new THREE.Color(pavilion.css),
      emissiveIntensity: 0.16,
    }));
    roof.position.y = 6.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.06, 4, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(pavilion.css), toneMapped: false }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 5.1;
    g.add(trim);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), new THREE.MeshBasicMaterial({
      color: new THREE.Color(pavilion.css),
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    banner.position.set(0, 4.4, 4.0);
    g.add(banner);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.35, 1.5), stone);
    bench.position.set(0, 1.05, 0.4);
    bench.castShadow = true;
    bench.receiveShadow = true;
    g.add(bench);
    const label = textSprite(pavilion.name, {
      color: pavilion.css,
      sub: pavilion.tierRequired ? `${pavilion.tierRequired} tier` : "all members",
      size: 38,
      scale: 0.86,
    });
    label.position.set(0, 5.9, 0);
    g.add(label);
    const glyph = glyphSprite(["\u2726", "\u25c8", "\u25c7", "\u2311", "\u25cf", "\u25b3", "\u29bf", "\u25a1"][i % 8], pavilion.css, 0.46);
    glyph.position.set(0, 2.4, 0);
    g.add(glyph);
    commons.add(g);
  });
  const commonsLight = new THREE.PointLight(0x5ce1a0, 40, 90, 1.7);
  commonsLight.position.set(0, 10, 0);
  commons.add(commonsLight);
  const commonsGlow = glowSprite("rgba(92,225,160,1)", 18, 0.18);
  commonsGlow.position.set(0, 1.6, 0);
  commons.add(commonsGlow);
  const commonsPlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 0.5, 8), darkStone);
  commonsPlinth.position.y = 0.25;
  commonsPlinth.receiveShadow = true;
  commons.add(commonsPlinth);
  const commonsLantern = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.8, 1),
    new THREE.MeshBasicMaterial({ color: 0x5ce1a0, toneMapped: false }),
  );
  commonsLantern.position.y = 4.2;
  commons.add(commonsLantern);
  const lanternGlow = glowSprite("rgba(92,225,160,1)", 6, 0.22);
  lanternGlow.position.y = 4.2;
  commons.add(lanternGlow);
  const commonsBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.4, 3.8, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x5ce1a0,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  commonsBeam.position.y = 2.3;
  commons.add(commonsBeam);
  const commonsLabel = textSprite("THE COMMONS", { color: "#5ce1a0", size: 44, scale: 1.4 });
  commonsLabel.position.y = 7.2;
  commons.add(commonsLabel);
  root.add(commons);

  /* ── the Lake stone ────────────────────────────────────────────────────── */

  {
    const x = -228;
    const z = 150;
    const y = heightAt(x, z);
    const shrine = new THREE.Group();
    shrine.position.set(x, y, z);
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.6, 2.2, 5), boulderMaterial(1));
    rock.position.y = 0.9;
    rock.castShadow = true;
    shrine.add(rock);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), cyan);
    cap.position.y = 2.5;
    shrine.add(cap);
    const halo = glowSprite("#8fe3ff", 5, 0.3);
    halo.position.y = 2.5;
    shrine.add(halo);
    const label = textSprite("So Ham", { color: "#8fe3ff", size: 34, scale: 0.7 });
    label.position.y = 3.7;
    shrine.add(label);
    root.add(shrine);
  }

  /* ── the Sky Gate ──────────────────────────────────────────────────────── */

  const gateY = heightAt(0, -268);
  const gate = new THREE.Group();
  gate.position.set(0, gateY, -268);
  const gateBase = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 1, 8), darkStone);
  gateBase.position.y = 0.5;
  gateBase.receiveShadow = true;
  gate.add(gateBase);
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.4, 12, 48), metalMaterial(2, 0x35505a));
  gateRing.position.y = 8;
  gateRing.castShadow = true;
  gate.add(gateRing);
  const gateInner = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.06, 6, 64), lime);
  gateInner.position.y = 8;
  gate.add(gateInner);
  const gateInner2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.03, 6, 64), cyan);
  gateInner2.position.y = 8;
  gate.add(gateInner2);
  const gateField = new THREE.Mesh(
    new THREE.CircleGeometry(6.4, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd4ff3f,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  gateField.position.y = 8;
  gate.add(gateField);
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 10, 1.1), stone);
    pylon.position.set(side * 5.2, 5, 0);
    pylon.castShadow = true;
    gate.add(pylon);
  }
  const gateLight = new THREE.PointLight(0xd4ff3f, 26, 44, 1.8);
  gateLight.position.y = 8;
  gate.add(gateLight);
  root.add(gate);

  /* ── sky ───────────────────────────────────────────────────────────────── */

  /**
   * A procedural gradient sky. The earlier build used HDR panoramas through
   * PMREM; that is beautiful but it costs several megabytes and a shader that
   * some software and mobile renderers refuse. The valley does not need a
   * photographed sky: it needs a horizon, a light direction and a darkness that
   * the stars can sit in.
   */
  const skyUniforms = {
    uTop: { value: new THREE.Color(0x120a2a) },
    uHorizon: { value: new THREE.Color(0x3a2a5a) },
    uBottom: { value: new THREE.Color(0x07040f) },
    uSun: { value: new THREE.Color(0xc6a6ff) },
    uTime: { value: 0 },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(11000, 40, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uBottom;
        uniform vec3 uSun;
        uniform float uTime;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
          col = mix(uBottom, col, smoothstep(-0.32, 0.03, h));
          // A faint band where the sun went down, opposite the zenith.
          float band = exp(-pow((h - 0.015) / 0.11, 2.0));
          float side = max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(0.62, 0.0, 0.55))));
          col += uSun * band * 0.22 * side;
          // Slow, very low-frequency breath so the sky is not a flat poster.
          float breath = 0.5 + 0.5 * sin(d.x * 3.0 + d.z * 2.0 + uTime * 0.015);
          col *= 0.94 + breath * 0.06;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -10;
  root.add(skyDome);

  const stars = makeStars(q === "low" ? 900 : 2200);
  const brightStars = makeBrightStars(q === "low" ? 70 : 180);
  const milkyWay = makeMilkyWay(q === "low" ? 1400 : 4400);
  const skyGroup = new THREE.Group();
  skyGroup.add(stars, brightStars, milkyWay);
  root.add(skyGroup);

  const motes = makeMotes(q === "low" ? 120 : 280);
  root.add(motes);

  // The moon is a real light source: a cool fill opposite the setting sun, a
  // textured disc and a soft halo. It gives the valley a second light to shape
  // silhouettes rather than a single backlight.
  const moonDirection = new THREE.Vector3(0.3, 0.5, -0.81).normalize();
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonTexture(),
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  moon.position.copy(moonDirection).multiplyScalar(2800);
  moon.scale.set(80, 80, 1);
  moon.renderOrder = -4;
  root.add(moon);
  const moonGlow = glowSprite("rgba(190,205,255,1)", 180, 0.06);
  moonGlow.position.copy(moon.position);
  moonGlow.renderOrder = -5;
  root.add(moonGlow);
  const moonLight = new THREE.DirectionalLight(0x9fb6ff, 0.45);
  moonLight.position.copy(moonDirection).multiplyScalar(700);
  root.add(moonLight);

  const sunLight = new THREE.DirectionalLight(0xffcf9a, 2);
  sunLight.castShadow = q !== "low";
  sunLight.shadow.mapSize.set(q === "high" ? 2048 : 1024, q === "high" ? 2048 : 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 900;
  sunLight.shadow.camera.left = -150;
  sunLight.shadow.camera.right = 150;
  sunLight.shadow.camera.top = 150;
  sunLight.shadow.camera.bottom = -150;
  sunLight.shadow.bias = -0.0004;
  root.add(sunLight, sunLight.target);

  const hemi = new THREE.HemisphereLight(0x6a5aa8, 0x1a1424, 0.5);
  root.add(hemi);
  const ambient = new THREE.AmbientLight(0x6a5a9a, 0.5);
  root.add(ambient);
  const fill = new THREE.DirectionalLight(0x8a7ac8, 0.5);
  fill.position.set(-0.62, 0.55, -0.55);
  root.add(fill);

  // The sun itself, as a soft body on the horizon.
  const sunGlow = glowSprite("rgba(255,214,150,1)", 220, 0.55);
  sunGlow.position.set(SUN_DIR.x * 900, SUN_DIR.y * 900, SUN_DIR.z * 900);
  root.add(sunGlow);
  const sunCore = glowSprite("rgba(255,246,220,1)", 70, 0.9);
  sunCore.position.copy(sunGlow.position);
  root.add(sunCore);

  const space = createSpace(q, sky);
  root.add(space.group);

  /* ── interactables ────────────────────────────────────────────────────── */

  const interactables: Interactable[] = [];
  const addInteract = (
    kind: InteractKind,
    id: string,
    title: string,
    hint: string,
    x: number,
    y: number,
    z: number,
    radius: number,
    color?: string,
    action?: string,
  ) => {
    interactables.push({
      kind,
      id,
      title,
      hint,
      action,
      position: new THREE.Vector3(x, y, z),
      radius,
      color,
    });
  };

  for (const place of PLACES) {
    if (place.id === "space") continue;
    addInteract(
      place.id as InteractKind,
      place.id,
      place.name,
      place.blurb,
      place.x,
      heightAt(place.x, place.z) + 1.6,
      place.z,
      place.radius,
      place.css,
      place.action,
    );
  }
  for (const g of space.grahas) {
    addInteract("graha", g.id, g.name, "A graha of the KP sky, at its sidereal longitude", g.position.x, g.position.y, g.position.z, 26, g.positionData.css, "Read the graha");
  }
  for (const n of space.nakshatras) {
    addInteract("nakshatra", String(n.index), n.name, "A lunar mansion, 13°20′ of the sidereal zodiac", n.position.x, n.position.y, n.position.z, 16);
  }
  CENTRES.forEach((centre, i) => {
    const a = ((i / 9) * Math.PI * 2) - Math.PI / 2 + Math.PI / 9;
    const x = Math.cos(a) * 56;
    const z = Math.sin(a) * 56;
    addInteract("centre", centre.key, centre.name, `${centre.kind} centre · ${centre.biology}`, x, heightAt(x, z) + 1.5, z, 9, centre.css, "Read the centre");
  });
  PAVILIONS.forEach((pavilion) => {
    addInteract(
      "commons",
      pavilion.slug,
      pavilion.name,
      pavilion.description,
      pavilion.x,
      commonsY + 1.6,
      pavilion.z,
      13,
      pavilion.css,
      "Open the room",
    );
  });
  PLOTS.forEach((plot) => {
    addInteract(
      "plot",
      String(plot.index),
      `Terrace ${plot.index + 1}`,
      "A place of your own: claim it, name it, build inside it.",
      plot.x,
      heightAt(plot.x, plot.z) + 1.6,
      plot.z,
      8,
      "#ff8fd1",
      "Claim or edit",
    );
  });

  /* ── plots and sessions from the room ─────────────────────────────────── */

  function setPlots(next: PlotState[]) {
    for (const visual of plots) {
      const plot = next.find((p) => p.index === visual.index);
      const ctxCanvas = (visual.banner.material as THREE.MeshBasicMaterial).map?.image as HTMLCanvasElement | undefined;
      const ctx = ctxCanvas?.getContext("2d");
      if (!ctx || !ctxCanvas) continue;
      if (plot) {
        drawBanner(ctx, 512, 256, {
          kicker: `Terrace ${visual.index + 1} · ${plot.ownerName}`,
          title: plot.title || plot.ownerName,
          sub: plot.motto || "a place of their own",
          color: plot.color || "#ff8fd1",
          glyph: plot.glyph || "\u2726",
        });
        (visual.banner.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
        (visual.beacon.material as THREE.MeshBasicMaterial).color.set(plot.color || "#ff8fd1");
        visual.light.color.set(plot.color || "#ff8fd1");
        visual.light.intensity = 0;
        visual.text.visible = false;
      } else {
        drawBanner(ctx, 512, 256, {
          kicker: `Terrace ${visual.index + 1}`,
          title: "Unclaimed",
          sub: "press E to claim",
          color: "#776a9e",
          glyph: "\u25c7",
          dim: true,
        });
        (visual.banner.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
        (visual.beacon.material as THREE.MeshBasicMaterial).color.set("#776a9e");
        visual.light.color.set("#776a9e");
        visual.light.intensity = 0;
        visual.text.visible = true;
      }
    }
  }

  function setSession(session: SessionState | null) {
    drawSessionScreen(sessionCtx, session);
    sessionTexture.needsUpdate = true;
    gateLight.intensity = session ? 34 : 26;
  }

  if (chart) {
    for (const stone of centreStones) {
      if (chart.definedCentres.includes(stone.key)) {
        (stone.tip.material as THREE.MeshBasicMaterial).color.set("#d4ff3f");
        stone.halo.material.opacity = 0.34;
        stone.halo.material.needsUpdate = true;
      }
    }
  }

  /* ── time of day ──────────────────────────────────────────────────────── */

  let timeOfDay: TimeOfDay = "dusk";
  let base = PRESETS.dusk;
  let starBase = base.star;
  let glowBase = base.glow;

  function applySky(t: TimeOfDay) {
    timeOfDay = t;
    base = PRESETS[t];
    scene.background = null;
    scene.environment = null;
    const skyColours =
      t === "golden"
        ? { top: 0x1b2440, horizon: 0xa3704a, bottom: 0x120a08, sun: 0xffd496 }
        : t === "void"
          ? { top: 0x04030c, horizon: 0x0d1630, bottom: 0x020106, sun: 0x9fb6ff }
          : { top: 0x1a1038, horizon: 0x4a3570, bottom: 0x080512, sun: 0xc6a6ff };
    skyUniforms.uTop.value.set(skyColours.top);
    skyUniforms.uHorizon.value.set(skyColours.horizon);
    skyUniforms.uBottom.value.set(skyColours.bottom);
    skyUniforms.uSun.value.set(skyColours.sun);
    sunLight.color.set(base.sun);
    sunLight.intensity = base.sunI;
    hemi.color.set(base.hemiSky);
    hemi.groundColor.set(base.hemiGround);
    hemi.intensity = base.hemiI;
    fill.color.set(t === "void" ? 0x5a74b8 : t === "dusk" ? 0x8a7ac8 : 0x8a9ad0);
    fill.intensity = t === "void" ? 0.4 : 0.55;
    const moonVisible = t !== "golden";
    moon.visible = moonVisible;
    moonGlow.visible = moonVisible;
    moonLight.intensity = t === "void" ? 0.55 : t === "dusk" ? 0.45 : 0.12;
    scene.fog = new THREE.FogExp2(base.fog, base.fogDensity);
    starBase = base.star;
    glowBase = base.glow;
    sunGlow.material.color.set(t === "void" ? 0x9fb6ff : t === "dusk" ? 0xffa070 : 0xffd496);
    sunCore.material.color.set(t === "void" ? 0xcfe0ff : 0xfff3d6);
    document.documentElement.style.setProperty("--world-fog", `#${new THREE.Color(base.fog).getHexString()}`);
  }

  /* ── the frame update ─────────────────────────────────────────────────── */

  let spaceBlend = 0;
  let exposure = PRESETS.dusk.exposure;

  function update(time: number, dt: number, player: THREE.Vector3) {
    const wm = waterMat.normalMap;
    if (wm) {
      wm.offset.x = (wm.offset.x + dt * 0.006) % 1;
      wm.offset.y = (wm.offset.y + dt * 0.0035) % 1;
    }
    grassUniform.value = time;

    for (const f of fires) {
      for (const s of f.sprites) {
        const ph = f.phase + (s.userData.phase as number);
        const flick = 0.72 + Math.sin(time * 9 + ph) * 0.14 + Math.sin(time * 23 + ph * 2) * 0.08;
        s.scale.setScalar((s.userData.base as number) * flick);
        s.material.opacity = 0.28 + flick * 0.32;
        s.position.y = f.base.y + Math.sin(time * 2 + ph) * 0.12;
      }
    }

    motes.rotation.y = time * 0.006;
    skyGroup.rotation.y = time * 0.0014;
    moonGlow.material.opacity = (timeOfDay === "void" ? 0.09 : 0.06) + Math.sin(time * 0.7) * 0.006;

    astro.rotation.y += dt * 0.035;
    core.rotation.y += dt * 0.4;
    astroLight.intensity = 24 + Math.sin(time * 1.6) * 5;
    projectionBeam.material.opacity = 0.07 + Math.sin(time * 1.3) * 0.02;
    for (const ripple of basinRipples) {
      const phase = ((time * 0.12 + (ripple.userData.phase as number)) % 1);
      ripple.scale.setScalar(1 + phase * 2.4);
      (ripple.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.3 * (1 - phase));
    }

    bowlGlow.material.opacity = 0.5 + Math.sin(time * 1.2) * 0.12;
    bowlLight.intensity = 22 + Math.sin(time * 1.1) * 5;
    commonsLantern.rotation.y += dt * 0.25;
    commonsLantern.rotation.x += dt * 0.12;
    lanternGlow.material.opacity = 0.18 + Math.sin(time * 1.4) * 0.04;
    commonsBeam.material.opacity = 0.08 + Math.sin(time * 1.1) * 0.02;

    for (const visual of plots) {
      visual.beacon.position.y = 5.8 + Math.sin(time * 1.4 + visual.index) * 0.08;
      visual.group.rotation.y = PLOTS[visual.index].ry;
    }

    space.update(time, dt);

    const target = smoothstep(420, 1050, player.y);
    spaceBlend += (target - spaceBlend) * Math.min(1, dt * 3.2);
    const s = spaceBlend;
    skyUniforms.uTime.value = time;
    skyDome.visible = s < 0.58;
    space.group.visible = s > 0.03;
    terrain.visible = s < 0.42;
    water.visible = s < 0.42;
    skirt.visible = s < 0.42;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = base.fogDensity * Math.max(0, 1 - s * 1.7) + 0.00001 * s;
    }
    sunLight.intensity = base.sunI * (1 - s) + (timeOfDay === "void" ? 0.9 : 1.8) * s;
    hemi.intensity = base.hemiI * (1 - s) + 0.1 * s;
    fill.intensity = 0.3 * (1 - s) + 0.06 * s;
    moon.visible = timeOfDay !== "golden" && s < 0.55;
    moonGlow.visible = moon.visible;
    moonLight.intensity = (timeOfDay === "void" ? 0.55 : timeOfDay === "dusk" ? 0.45 : 0.12) * (1 - s);
    (stars.material as THREE.PointsMaterial).opacity = Math.max(starBase, smoothstep(0.1, 0.62, s));
    (brightStars.material as THREE.PointsMaterial).opacity = Math.max(0.7, smoothstep(0.08, 0.55, s));
    (milkyWay.material as THREE.PointsMaterial).opacity = Math.max(0.012, smoothstep(0.06, 0.5, s) * 0.03);
    sunGlow.material.opacity = glowBase * Math.max(0, 1 - s * 2) * 0.9;
    sunCore.material.opacity = 0.9 * Math.max(0, 1 - s * 1.5);
    (motes.material as THREE.PointsMaterial).opacity = (timeOfDay === "void" ? 0.2 : 0.3) * (1 - s);
    exposure = base.exposure * (1 - s) + 1.0 * s;

    const grounded = player.y < 650;
    sunLight.castShadow = grounded && q !== "low";
    if (grounded) {
      sunLight.position.copy(player).addScaledVector(new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z), 380);
      sunLight.target.position.set(player.x, heightAt(player.x, player.z), player.z);
      sunLight.target.updateMatrixWorld();
    }
  }

  /* ── standing surfaces ────────────────────────────────────────────────── */

  const supports = [
    { x: 0, z: 0, r: 45, top: 22.12 },
    { x: 0, z: -150, r: 22, top: obsY + 2.4 },
    { x: -148, z: 28, r: 9, top: ampY + 0.6 },
    { x: 150, z: 36, r: 17, top: studioY + 0.45 },
    { x: 122, z: -166, r: 24, top: sancY + 0.85 },
    { x: -188, z: -36, r: 38, top: terrY + 1.4 },
    { x: 0, z: 136, r: 70, top: commonsY + 0.5 },
    { x: 0, z: -268, r: 10, top: gateY + 1 },
  ];

  function surfaceAt(x: number, z: number, y: number): number {
    let h = heightAt(x, z);
    for (const support of supports) {
      if (Math.hypot(x - support.x, z - support.z) <= support.r && y > support.top - 2.6 && support.top > h) {
        h = support.top;
      }
    }
    if (y > 1400) {
      const sp = space.surfaceAt(x, z, y);
      if (sp !== null && sp > h) h = sp;
    }
    return h;
  }

  // Diagnostic handle for bisecting a GPU problem from a real browser. It is
  // small, read-only and harmless in production.
  (globalThis as unknown as { __cipherParts?: Record<string, THREE.Object3D> }).__cipherParts = {
    skyDome,
    stars,
    motes,
    terrain,
    water,
    grass,
    trees: trunks,
    canopies,
    shrubs,
    boulders,
    axis,
    observatory,
    amphitheatre: amp,
    studio,
    sanctuary,
    terraces,
    commons,
    gate,
    space: space.group,
  };

  applySky(timeOfDay);
  drawSessionScreen(sessionCtx, null);
  sessionTexture.needsUpdate = true;

  const dispose = () => {
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
      if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.dispose();
      if ((o as THREE.Line).isLine) {
        const line = o as THREE.Line;
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      if ((o as THREE.Points).isPoints) {
        const points = o as THREE.Points;
        points.geometry.dispose();
        (points.material as THREE.Material).dispose();
      }
    });
    space.dispose();
    scene.remove(root);
  };

  return {
    root,
    terrain,
    water,
    sun: sunLight,
    hemi,
    fill,
    stars,
    motes,
    fires,
    space,
    plots,
    interactables,
    get timeOfDay() {
      return timeOfDay;
    },
    get spaceBlend() {
      return spaceBlend;
    },
    get exposure() {
      return exposure;
    },
    setTimeOfDay: applySky,
    setPlots,
    setSession,
    update,
    surfaceAt,
    dispose,
  } as World;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function makeStars(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const rand = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < count; i++) {
    const u = rand(i + 0.5) * 2 - 1;
    const theta = rand(i + 17.3) * Math.PI * 2;
    const r = 2600 + rand(i + 41.7) * 1800;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: starTexture(),
    size: 42,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  return new THREE.Points(geo, mat);
}


/** A sparse layer of brighter, slightly coloured stars. */
function makeBrightStars(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = 2500 + Math.random() * 1900;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
    const tone = Math.random();
    const color =
      tone < 0.18
        ? new THREE.Color(0xffd9a0)
        : tone < 0.48
          ? new THREE.Color(0xa9c8ff)
          : new THREE.Color(0xf4f1ff);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    map: starTexture(),
    size: 60,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = -3;
  return points;
}

/**
 * A faint galactic band. The sky should have structure when you look up, not
 * an even sprinkle of dots; this is a ring of cold dust around the valley.
 */
function makeMilkyWay(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const normal = new THREE.Vector3(0.25, 0.78, 0.57).normalize();
  const u = new THREE.Vector3(1, 0, 0).cross(normal).normalize();
  const v = normal.clone().cross(u).normalize();
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Sum of uniforms gives a soft, triangular band rather than a hard stripe.
    const spread = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 0.34;
    dir.copy(u).multiplyScalar(Math.cos(angle));
    dir.addScaledVector(v, Math.sin(angle));
    dir.addScaledVector(normal, spread);
    dir.normalize().multiplyScalar(3000 + Math.random() * 2400);
    positions[i * 3] = dir.x;
    positions[i * 3 + 1] = dir.y;
    positions[i * 3 + 2] = dir.z;
    const tone = Math.random();
    const color =
      tone < 0.4
        ? new THREE.Color(0x8f7fd0)
        : tone < 0.75
          ? new THREE.Color(0x9fb6e8)
          : new THREE.Color(0xf0eaff);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    map: starTexture(),
    size: 2.6,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = -6;
  return points;
}

function moonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  const grad = g.createRadialGradient(108, 104, 8, 128, 128, 120);
  grad.addColorStop(0, "#fbf8ef");
  grad.addColorStop(0.55, "#ded8e8");
  grad.addColorStop(0.86, "#b9b0cf");
  grad.addColorStop(1, "rgba(120,110,150,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(95,88,120,0.16)";
  for (const [x, y, r] of [
    [92, 92, 17],
    [146, 82, 10],
    [164, 140, 20],
    [104, 148, 13],
    [128, 168, 8],
    [78, 128, 7],
    [150, 180, 6],
  ]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeMotes(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 10 + Math.random() * 420;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 20 + Math.random() * 60;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: starTexture(),
    color: 0xd4ff3f,
    size: 1.35,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  return new THREE.Points(geo, mat);
}

function drawSessionScreen(ctx: CanvasRenderingContext2D, session: SessionState | null) {
  const w = 1024;
  const h = 420;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(6,4,14,0.94)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = session ? "#d4ff3f" : "#5ce1e6";
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.globalAlpha = 1;
  ctx.font = "500 24px ui-monospace, monospace";
  ctx.fillStyle = session ? "#d4ff3f" : "#5ce1e6";
  ctx.fillText(session ? "LIVE · THE FLOOR IS TAKEN" : "THE FLOOR IS OPEN", 44, 74);
  ctx.font = "700 58px Syne, ui-sans-serif, sans-serif";
  ctx.fillStyle = "#f4f1ff";
  ctx.fillText(session ? trim(session.title, 30) : "Take the floor", 44, 158);
  ctx.font = "400 28px ui-sans-serif, sans-serif";
  ctx.fillStyle = "rgba(244,241,255,0.68)";
  ctx.fillText(
    session ? `${session.host} · teaching the room` : "Press E at the lectern to begin. Everyone here will see it.",
    44,
    212,
  );
  ctx.font = "400 22px ui-monospace, monospace";
  ctx.fillStyle = "rgba(244,241,255,0.42)";
  ctx.fillText("KP · HUMAN DESIGN · ASTROCARTOGRAPHY · THE COLLECTIVE", 44, 300);
  ctx.fillText("ONE WORLD · MANY ROOMS", 44, 336);
}

function drawChartScreen(ctx: CanvasRenderingContext2D, chart: MemberChart | null) {
  const w = 768;
  const h = 512;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(6,4,14,0.94)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#5ce1e6";
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.globalAlpha = 1;
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillStyle = "#5ce1e6";
  ctx.fillText("THE NINE GRAHAS", 36, 54);
  ctx.font = "700 34px Syne, ui-sans-serif, sans-serif";
  ctx.fillStyle = "#f4f1ff";
  ctx.fillText(chart?.lagnaName ? `Lagna ${chart.lagnaName}` : "The sidereal sky", 36, 100);
  ctx.font = "400 19px ui-monospace, monospace";
  const rows = chart?.grahas ?? [];
  rows.forEach((graha, index) => {
    const x = 36 + (index % 3) * 240;
    const y = 152 + Math.floor(index / 3) * 82;
    ctx.fillStyle = graha.css;
    ctx.font = "400 26px ui-serif, Georgia, serif";
    ctx.fillText(graha.glyph, x, y);
    ctx.fillStyle = "#f4f1ff";
    ctx.font = "600 18px Syne, ui-sans-serif, sans-serif";
    ctx.fillText(graha.name, x + 34, y - 2);
    ctx.fillStyle = "rgba(244,241,255,0.6)";
    ctx.font = "400 15px ui-monospace, monospace";
    ctx.fillText(`${graha.lon.toFixed(1)}° ${graha.nakshatraName}`, x + 34, y + 20);
  });
  if (!rows.length) {
    ctx.fillStyle = "rgba(244,241,255,0.6)";
    ctx.font = "400 20px ui-sans-serif, sans-serif";
    ctx.fillText("Add your birth data on the 2D site.", 36, 180);
  }
  ctx.fillStyle = "rgba(212,255,63,0.7)";
  ctx.font = "400 17px ui-monospace, monospace";
  ctx.fillText("ASTRONOMY, NOT A FORECAST", 36, h - 34);
}

function drawBodygraphScreen(ctx: CanvasRenderingContext2D, chart: MemberChart | null) {
  const w = 768;
  const h = 512;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(6,4,14,0.94)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#b45cff";
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.globalAlpha = 1;
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillStyle = "#b45cff";
  ctx.fillText("THE BODYGRAPH", 36, 58);
  ctx.font = "700 42px Syne, ui-sans-serif, sans-serif";
  ctx.fillStyle = "#f4f1ff";
  ctx.fillText(chart?.bodygraphType ?? "Add your birth data", 36, 116);
  ctx.font = "400 22px ui-sans-serif, sans-serif";
  ctx.fillStyle = "rgba(244,241,255,0.66)";
  const lines = chart
    ? [
        `${chart.bodygraphProfile ?? "—"} profile · ${chart.bodygraphAuthority ?? "—"} authority`,
        `${chart.bodygraphChannels ?? 0} channels defined`,
        chart.definedCentres.length
          ? `Defined: ${chart.definedCentres.join(", ")}`
          : "No centres defined",
        chart.label,
        chart.place,
      ]
    : ["Enter your date, exact second and place on the 2D site,", "then return. The Observatory reads from your profile."];
  lines.forEach((line, i) => ctx.fillText(trim(line, 46), 36, 174 + i * 38));
  ctx.font = "400 20px ui-monospace, monospace";
  ctx.fillStyle = "rgba(212,255,63,0.7)";
  ctx.fillText("THE CHART IS ASTRONOMY · THE MEANING IS TRADITION", 36, h - 38);
}

function trim(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Kept as a type anchor for the build editor's material previews. */
export type BuildPaletteEntry = BuildMaterial;
