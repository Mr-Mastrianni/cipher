/**
 * Lightning, as a physical event rather than a muzzle flash.
 *
 * A bolt is a midpoint-displaced path through the air, drawn as a camera-facing
 * ribbon so it has width, with two or three branches falling off it. It carries
 * a real point light, throws a shockwave, leaves a scorch mark, and the thunder
 * arrives late by distance/343. The whole effect lives for under half a second;
 * almost all of the work is preallocated, so a held trigger cannot allocate.
 */
import * as THREE from 'three';
import { audio } from './audio';
import { normalAt } from './terrain';

function displace(from: THREE.Vector3, to: THREE.Vector3, depth: number, rough = 0.22): THREE.Vector3[] {
  let pts = [from.clone(), to.clone()];
  for (let d = 0; d < depth; d++) {
    const next: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const side = new THREE.Vector3(dir.z, Math.random() - 0.5, -dir.x).normalize();
      const side2 = new THREE.Vector3().crossVectors(dir, side).normalize();
      mid.addScaledVector(side, (Math.random() - 0.5) * len * rough);
      mid.addScaledVector(side2, (Math.random() - 0.5) * len * rough * 0.6);
      next.push(a, mid);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

function ribbon(points: THREE.Vector3[], width: number, viewDir: THREE.Vector3, color: THREE.Color): { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dir = next.clone().sub(prev).normalize();
    const side = new THREE.Vector3().crossVectors(dir, viewDir).normalize();
    const t = i / (points.length - 1);
    const w = width * (1 - t * 0.55) * (0.7 + Math.random() * 0.35);
    positions.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
    positions.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
    uvs.push(0, t, 1, t);
    if (i < points.length - 1) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  return { geometry, material };
}

interface Bolt {
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  light: THREE.PointLight;
  life: number;
  maxLife: number;
  flash: number;
}

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

function scorchTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(6,4,3,0.95)');
  grad.addColorStop(0.35, 'rgba(12,8,6,0.7)');
  grad.addColorStop(0.75, 'rgba(20,14,10,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LightningSystem {
  private bolts: Bolt[] = [];
  private sparks: Spark[] = [];
  private points: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;
  private scorches: { mesh: THREE.Mesh; life: number; max: number }[] = [];
  private shockwaves: { mesh: THREE.Mesh; life: number; max: number }[] = [];
  private scorchMap = scorchTexture();
  private flashValue = 0;
  private tmp = new THREE.Vector3();
  private viewDir = new THREE.Vector3();
  private sparkGeo = new THREE.BufferGeometry();
  private sparkPool = 420;

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    this.sparkPositions = new Float32Array(this.sparkPool * 3);
    this.sparkColors = new Float32Array(this.sparkPool * 3);
    for (let i = 0; i < this.sparkPool; i++) {
      this.sparkPositions[i * 3 + 1] = -9999;
    }
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.points = new THREE.Points(this.sparkGeo, sparkMat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  get flash() {
    return this.flashValue;
  }

  /**
   * @param from  world position the bolt leaves from
   * @param to    world position it strikes
   * @param opts  `power` 0..1 scales the event; `remote` suppresses the local flash
   */
  strike(from: THREE.Vector3, to: THREE.Vector3, opts: { power?: number; remote?: boolean } = {}) {
    const power = Math.max(0.25, Math.min(1, opts.power ?? 0.7));
    this.camera.getWorldDirection(this.viewDir);
    const group = new THREE.Group();
    const main = displace(from, to, 4, 0.16 + Math.random() * 0.1);
    const core = ribbon(main, 0.06 + power * 0.055, this.viewDir, new THREE.Color(0xe8fbff));
    const halo = ribbon(main, 0.18 + power * 0.16, this.viewDir, new THREE.Color(0x5fa8ff));
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.18;
    const coreMesh = new THREE.Mesh(core.geometry, core.material);
    const haloMesh = new THREE.Mesh(halo.geometry, halo.material);
    haloMesh.renderOrder = -1;
    group.add(haloMesh, coreMesh);

    // Branches: shorter forks, each its own ribbon, falling away from the main path.
    const branchCount = 2 + Math.floor(Math.random() * 3);
    for (let b = 0; b < branchCount; b++) {
      const start = main[Math.floor(main.length * (0.2 + Math.random() * 0.6))];
      const dir = to.clone().sub(from).normalize();
      const side = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const end = start.clone().addScaledVector(dir, 2 + Math.random() * 6).addScaledVector(side, 3 + Math.random() * 7);
      const branch = displace(start, end, 2, 0.3);
      const bc = ribbon(branch, 0.028 + Math.random() * 0.03, this.viewDir, new THREE.Color(0xbfe6ff));
      const bm = new THREE.Mesh(bc.geometry, bc.material);
      group.add(bm);
    }

    const light = new THREE.PointLight(0x9fd4ff, 0, 45, 1.8);
    light.position.copy(to);
    light.castShadow = false;
    group.add(light);
    this.scene.add(group);

    this.bolts.push({ group, core: coreMesh, halo: haloMesh, light, life: 0.62, maxLife: 0.62, flash: power });
    this.flashValue = Math.max(this.flashValue, power * (opts.remote ? 0.35 : 0.9));

    this.impact(to, power);
    audio.lightning(from.distanceTo(to), 0.6 + power * 0.6);
  }

  private impact(at: THREE.Vector3, power: number) {
    const n = 26 + Math.floor(power * 34);
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      this.addSpark(at, dir.multiplyScalar(3 + Math.random() * 13 * power), 0.4 + Math.random() * 0.9, Math.random() < 0.35 ? 0xbfe9ff : 0xffd27a);
    }

    // A ring of air, flattened to the surface normal.
    const normal = normalAt(at.x, at.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 40),
      new THREE.MeshBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    ring.position.copy(at).add(new THREE.Vector3(0, 0.08, 0));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(normal[0], normal[1], normal[2]));
    this.scene.add(ring);
    this.shockwaves.push({ mesh: ring, life: 0.55, max: 0.55 });

    if (normal[1] > 0.5) {
      const scorch = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: this.scorchMap, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      scorch.position.copy(at).add(new THREE.Vector3(0, 0.03, 0));
      scorch.rotation.x = -Math.PI / 2;
      scorch.rotation.z = Math.random() * Math.PI;
      this.scene.add(scorch);
      this.scorches.push({ mesh: scorch, life: 26, max: 26 });
      if (this.scorches.length > 30) {
        const old = this.scorches.shift()!;
        this.scene.remove(old.mesh);
        old.mesh.geometry.dispose();
        (old.mesh.material as THREE.Material).dispose();
      }
    }
  }

  private sparkCursor = 0;
  private addSpark(at: THREE.Vector3, vel: THREE.Vector3, life: number, color: number) {
    const i = this.sparkCursor++ % this.sparkPool;
    const c = new THREE.Color(color);
    this.sparks[i] = { pos: at.clone(), vel, life, maxLife: life, color: c };
    this.sparkPositions[i * 3] = at.x;
    this.sparkPositions[i * 3 + 1] = at.y;
    this.sparkPositions[i * 3 + 2] = at.z;
    this.sparkColors[i * 3] = c.r;
    this.sparkColors[i * 3 + 1] = c.g;
    this.sparkColors[i * 3 + 2] = c.b;
  }

  /** Sparks for the anvil, sharing the same pool. */
  forgeSparks(at: THREE.Vector3, count = 10) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 1.1, Math.random() - 0.5).normalize();
      this.addSpark(at, dir.multiplyScalar(1.5 + Math.random() * 4), 0.35 + Math.random() * 0.5, 0xff9a3d);
    }
  }

  update(dt: number) {
    this.flashValue = Math.max(0, this.flashValue - dt * 3.2);

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      const k = Math.max(0, b.life / b.maxLife);
      (b.core.material as THREE.MeshBasicMaterial).opacity = k;
      (b.halo.material as THREE.MeshBasicMaterial).opacity = 0.2 * k;
      b.light.intensity = 14 * k * k;
      if (b.life <= 0) {
        this.scene.remove(b.group);
        b.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            const m = o as THREE.Mesh;
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        this.bolts.splice(i, 1);
      }
    }

    for (let i = 0; i < this.sparkPool; i++) {
      const s = this.sparks[i];
      if (!s) continue;
      s.life -= dt;
      if (s.life <= 0) {
        this.sparkPositions[i * 3 + 1] = -9999;
        delete this.sparks[i];
        continue;
      }
      s.vel.y -= 18 * dt;
      s.pos.addScaledVector(s.vel, dt);
      this.sparkPositions[i * 3] = s.pos.x;
      this.sparkPositions[i * 3 + 1] = s.pos.y;
      this.sparkPositions[i * 3 + 2] = s.pos.z;
      const k = Math.max(0, s.life / s.maxLife);
      this.sparkColors[i * 3] = s.color.r * k;
      this.sparkColors[i * 3 + 1] = s.color.g * k;
      this.sparkColors[i * 3 + 2] = s.color.b * k;
    }
    (this.sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.sparkGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.life -= dt;
      const k = 1 - w.life / w.max;
      w.mesh.scale.setScalar(0.4 + k * 4.2);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.32;
      if (w.life <= 0) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        (w.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.scorches.length - 1; i >= 0; i--) {
      const s = this.scorches[i];
      s.life -= dt;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, Math.min(0.75, s.life / 4));
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        mat.dispose();
        this.scorches.splice(i, 1);
      }
    }
  }
  /** Release every geometry and material this system owns. */
  dispose() {
    this.scene.remove(this.points);
    this.sparkGeo.dispose();
    (this.points.material as THREE.Material).dispose();
    for (const bolt of this.bolts) {
      this.scene.remove(bolt.group);
      bolt.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
        if ((o as THREE.PointLight).isPointLight) (o as THREE.PointLight).dispose();
      });
    }
    this.bolts.length = 0;
    for (const scorch of this.scorches) {
      this.scene.remove(scorch.mesh);
      scorch.mesh.geometry.dispose();
      (scorch.mesh.material as THREE.Material).dispose();
    }
    this.scorches.length = 0;
    for (const wave of this.shockwaves) {
      this.scene.remove(wave.mesh);
      wave.mesh.geometry.dispose();
      (wave.mesh.material as THREE.Material).dispose();
    }
    this.shockwaves.length = 0;
    this.scorchMap.dispose();
  }

}
