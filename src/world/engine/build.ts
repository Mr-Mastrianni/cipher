/**
 * The Studio, and the terraces: everything a member can put in the world.
 *
 * Ten piece types, eight materials, placed on a half-metre grid with a ghost
 * that is always the real geometry at 42% opacity. A piece placed in the Studio
 * is shared the instant it lands; a piece placed on a terrace plot belongs to
 * that plot, and the server checks both the claim and the radius before it
 * broadcasts. The local copy is added optimistically with the same id, so a slow
 * link never makes a placed thing disappear and then reappear.
 */

import * as THREE from "three";
import {
  BUILD_MATERIALS,
  BUILD_PIECES,
  PLOT_PIECE_LIMIT,
  PLOTS,
} from "../content/world";
import type { BuildPieceType } from "../content/world";
import { getStore, toast, type BuildPiece } from "../state";
import type { RoomTransport } from "../net/types";
import { audio } from "./audio";

const pieceById = (id: string) => BUILD_PIECES.find((p) => p.id === id) ?? BUILD_PIECES[0];
const materialById = (id: string) => BUILD_MATERIALS.find((m) => m.id === id) ?? BUILD_MATERIALS[0];

const materialCache = new Map<string, THREE.Material>();

function materialFor(id: string): THREE.Material {
  const hit = materialCache.get(id);
  if (hit) return hit;
  const m = materialById(id);
  const mat = new THREE.MeshStandardMaterial({
    color: m.color,
    roughness: m.roughness,
    metalness: m.metalness,
    emissive: m.emissive,
    emissiveIntensity: m.emissiveIntensity,
    envMapIntensity: 1.05,
  });
  if (m.id === "violet") {
    mat.transparent = true;
    mat.opacity = 0.86;
  }
  materialCache.set(id, mat);
  return mat;
}

/** The real geometry for a piece, and the height of its base above the anchor. */
function geometryFor(type: BuildPieceType): {
  geometry: THREE.BufferGeometry;
  offset: number;
} {
  const [hx, hy, hz] = type.size;
  switch (type.shape) {
    case "box":
      return { geometry: new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), offset: hy };
    case "cylinder":
      return { geometry: new THREE.CylinderGeometry(hx, hx * 1.1, hy * 2, 18, 1), offset: hy };
    case "octa":
      return { geometry: new THREE.OctahedronGeometry(Math.max(hx, hy) * 0.92, 0), offset: hy };
    case "torus":
      return { geometry: new THREE.TorusGeometry(hx, hy * 0.9, 8, 40), offset: hy };
    case "stair":
    case "arch":
    default:
      return { geometry: new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), offset: hy };
  }
}

const GHOST_MAT = new THREE.MeshBasicMaterial({
  color: 0x8fe3ff,
  transparent: true,
  opacity: 0.36,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

const GHOST_BAD = new THREE.MeshBasicMaterial({
  color: 0xff5c8a,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

interface Collider {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
  id: string;
}

export class BuildSystem {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Group>();
  private colliders: Collider[] = [];
  private ghost: THREE.Group | null = null;
  private ghostMesh: THREE.Mesh | null = null;
  private ghostRing: THREE.Mesh | null = null;
  private ghostKey = "";
  private highlightRing: THREE.Mesh;
  private hovered: string | null = null;
  private lastSync = 0;
  private valid = true;

  constructor(private scene: THREE.Scene, private net: RoomTransport | null) {
    scene.add(this.group);
    this.highlightRing = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xd4ff3f,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.highlightRing.rotation.x = -Math.PI / 2;
    this.highlightRing.visible = false;
    scene.add(this.highlightRing);
  }

  setNet(net: RoomTransport) {
    this.net = net;
  }

  /** Reconcile with the shared list. Cheap: it only touches changed ids. */
  sync(pieces: BuildPiece[], force = false) {
    const now = performance.now();
    if (!force && now - this.lastSync < 250) return;
    this.lastSync = now;
    const seen = new Set<string>();
    for (const p of pieces) {
      seen.add(p.id);
      if (!this.meshes.has(p.id)) this.addLocal(p);
    }
    for (const id of [...this.meshes.keys()]) {
      if (!seen.has(id)) this.removeLocal(id);
    }
  }

  private addLocal(p: BuildPiece) {
    const type = pieceById(p.type);
    const { geometry, offset } = geometryFor(type);
    const holder = new THREE.Group();
    const mat = (materialFor(p.material) as THREE.MeshStandardMaterial).clone();
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = offset * p.scale;
    holder.add(mesh);

    if (type.shape === "arch") {
      // Two legs and a lintel: a door you can see through is a door you walk to.
      holder.clear();
      const [hx, hy, hz] = type.size;
      const legGeo = new THREE.BoxGeometry(hx * 0.22, hy * 1.6, hz);
      const legL = new THREE.Mesh(legGeo, mat);
      legL.position.set(-hx * 0.72, hy * 0.8, 0);
      const legR = new THREE.Mesh(legGeo, mat);
      legR.position.set(hx * 0.72, hy * 0.8, 0);
      const top = new THREE.Mesh(new THREE.BoxGeometry(hx * 1.8, hy * 0.3, hz * 1.05), mat);
      top.position.y = hy * 1.62;
      holder.add(legL, legR, top);
      holder.scale.setScalar(p.scale);
    }

    if (type.shape === "stair") {
      holder.clear();
      const [hx, hy, hz] = type.size;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 1.2, hz * 2), mat);
      lower.position.y = hy * 0.6;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 1.2, hz), mat);
      upper.position.set(0, hy * 1.8, -hz * 0.5);
      holder.add(lower, upper);
      holder.scale.setScalar(p.scale);
    }

    if (type.id === "orb") {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 * p.scale, 20, 14),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(materialById(p.material).css),
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      glow.position.y = 0.9 * p.scale;
      holder.add(glow);
      const light = new THREE.PointLight(
        new THREE.Color(materialById(p.material).css),
        3 * p.scale,
        6 * p.scale,
        2,
      );
      light.position.y = 0.9 * p.scale;
      holder.add(light);
    }

    holder.position.set(p.x, p.y, p.z);
    holder.rotation.y = p.ry;
    holder.userData.buildId = p.id;
    holder.traverse((o) => {
      o.userData.buildId = p.id;
    });
    this.group.add(holder);
    this.meshes.set(p.id, holder);
    this.colliders.push({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      hx: type.size[0] * p.scale,
      hy: type.size[1] * p.scale,
      hz: type.size[2] * p.scale,
    });
  }

  private removeLocal(id: string) {
    const holder = this.meshes.get(id);
    if (holder) {
      this.group.remove(holder);
      holder.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material;
          if (mat !== GHOST_MAT) mat.dispose();
        }
        if ((o as THREE.PointLight).isPointLight) {
          (o as THREE.PointLight).dispose();
        }
      });
      this.meshes.delete(id);
    }
    this.colliders = this.colliders.filter((c) => c.id !== id);
    if (this.hovered === id) this.highlight(null);
  }

  /** The ghost is rebuilt whenever the selection changes, and moved every frame. */
  setGhost(
    typeId: string,
    materialId: string,
    point: THREE.Vector3 | null,
    ry: number,
    scale: number,
    valid = true,
  ) {
    if (!point) {
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    const key = `${typeId}:${materialId}`;
    if (key !== this.ghostKey) {
      const old = this.ghost;
      if (old) {
        this.scene.remove(old);
        old.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
        });
      }
      const type = pieceById(typeId);
      const { geometry, offset } = geometryFor(type);
      const holder = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, GHOST_MAT);
      mesh.position.y = offset;
      holder.add(mesh);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.25, 1.4, 40),
        new THREE.MeshBasicMaterial({
          color: 0xd4ff3f,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      holder.add(ring);
      this.ghost = holder;
      this.ghostMesh = mesh;
      this.ghostRing = ring;
      this.ghostKey = key;
      this.scene.add(holder);
    }
    const ghost = this.ghost;
    if (!ghost) return;
    ghost.visible = true;
    ghost.position.copy(point);
    ghost.rotation.y = ry;
    ghost.scale.setScalar(scale);
    if (this.ghostMesh) this.ghostMesh.material = valid ? GHOST_MAT : GHOST_BAD;
    if (this.ghostRing) {
      (this.ghostRing.material as THREE.MeshBasicMaterial).color.set(valid ? 0xd4ff3f : 0xff5c8a);
    }
    this.valid = valid;
  }

  hideGhost() {
    if (this.ghost) this.ghost.visible = false;
  }

  /**
   * Place a piece. `plot` is the terrace the member is standing on, if any; the
   * server re-checks the claim before accepting it.
   */
  place(
    point: THREE.Vector3,
    typeId: string,
    materialId: string,
    ry: number,
    scale: number,
    plot: number | null,
  ) {
    const store = getStore();
    if (plot !== null) {
      const mine = store.get().identity.plot === plot;
      if (!mine) {
        toast("This terrace is not yours", "Claim it from the Plots panel before building here.", "danger");
        return null;
      }
      const mineCount = store.get().builds.filter((b) => b.plot === plot && b.owner === store.get().selfId).length;
      if (mineCount >= PLOT_PIECE_LIMIT) {
        toast("This terrace is full", `A plot holds ${PLOT_PIECE_LIMIT} pieces. Remove one to place another.`, "danger");
        return null;
      }
    }
    if (!this.valid) return null;
    const id = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const piece: BuildPiece = {
      id,
      type: typeId,
      material: materialId,
      x: Math.round(point.x * 2) / 2,
      y: Math.round(point.y * 4) / 4,
      z: Math.round(point.z * 2) / 2,
      ry: Math.round(ry * 24) / 24,
      scale: Math.round(scale * 20) / 20,
      owner: store.get().selfId || "local",
      ownerName: store.get().identity.name,
      plot,
      at: Date.now(),
    };
    this.addLocal(piece);
    store.update((s) => ({ builds: [...s.builds, piece] }));
    this.net?.buildAdd(piece);
    audio.build();
    return piece;
  }

  remove(id: string) {
    const store = getStore();
    const piece = store.get().builds.find((b) => b.id === id);
    if (piece && piece.owner !== store.get().selfId) {
      toast("That is someone else's piece", "Only the member who placed it can remove it.", "info");
      return;
    }
    this.removeLocal(id);
    store.update((s) => ({ builds: s.builds.filter((b) => b.id !== id) }));
    this.net?.buildRemove(id);
  }

  /** Does this screen ray hit a piece? Returns the build id and point. */
  pick(raycaster: THREE.Raycaster): { id: string; point: THREE.Vector3 } | null {
    const hits = raycaster.intersectObjects(this.group.children, true);
    for (const h of hits) {
      const id = (h.object.userData.buildId ?? h.object.parent?.userData.buildId) as string | undefined;
      if (id) return { id, point: h.point };
    }
    return null;
  }

  highlight(id: string | null) {
    this.hovered = id;
    if (!id) {
      this.highlightRing.visible = false;
      return;
    }
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    this.highlightRing.visible = true;
    this.highlightRing.position.set(mesh.position.x, mesh.position.y + 0.06, mesh.position.z);
  }

  /**
   * Collision and standing surfaces. Returns the highest build surface under the
   * feet and the horizontal correction needed to stay outside a wall.
   *
   * Pieces are treated as axis-aligned boxes. Rotation is visual only; at the
   * 15° increments the ghost uses, an AABB is within a few centimetres, and a
   * forgiving collider is better than a player caught on a corner of their own
   * house.
   */
  resolve(
    prev: THREE.Vector3,
    next: THREE.Vector3,
    radius: number,
    falling: boolean,
  ): { ground: number; pushX: number; pushZ: number; hit: boolean } {
    let ground = -Infinity;
    let pushX = 0;
    let pushZ = 0;
    let hit = false;
    for (const c of this.colliders) {
      const top = c.y + c.hy * 2;
      const bottom = c.y;
      const dx = next.x - c.x;
      const dz = next.z - c.z;
      const ex = c.hx + radius;
      const ez = c.hz + radius;
      if (Math.abs(dx) > ex || Math.abs(dz) > ez) continue;

      if (falling && prev.y >= top - 0.35 && next.y <= top + 0.02) {
        ground = Math.max(ground, top);
        continue;
      }
      if (next.y + 1.65 < bottom || next.y > top - 0.1) continue;
      const px = ex - Math.abs(dx);
      const pz = ez - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      hit = true;
      if (px < pz) pushX += Math.sign(dx || 1) * px;
      else pushZ += Math.sign(dz || 1) * pz;
    }
    return { ground, pushX, pushZ, hit };
  }

  /** The terrace a point falls inside, or null. */
  plotAt(x: number, z: number): number | null {
    for (const plot of PLOTS) {
      if (Math.hypot(x - plot.x, z - plot.z) < 9.5) return plot.index;
    }
    return null;
  }

  count() {
    return this.meshes.size;
  }

  dispose() {
    for (const id of [...this.meshes.keys()]) this.removeLocal(id);
    this.scene.remove(this.group);
    if (this.ghost) this.scene.remove(this.ghost);
    this.scene.remove(this.highlightRing);
  }
}
