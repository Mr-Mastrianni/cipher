/**
 * The Sky Wheel: the nine grahas and the twenty-seven nakshatras at 1,800 m.
 *
 * There is no floor. The wheel is a set of orbital lines, floating markers and
 * textured bodies in the dark; a body that comes here is kept in flight.
 *
 * The grahas sit on the same ring as the lunar mansions, at their sidereal
 * longitudes. A planet therefore stands inside its real nakshatra sector and
 * beside its real rasi. The longitudes are passed in by the server route, which
 * uses the Cipher's KP engine; nothing here invents a position. Planet images
 * are CC BY 4.0 Solar System Scope textures (see public/textures/planets).
 */

import * as THREE from "three";
import { GRAHAS, NAKSHATRAS, RASIS_META } from "../content/world";
import { glyphSprite, textSprite, glowSprite } from "./sprites";

export const SPACE_Y = 1800;
export const WHEEL = {
  radius: 680,
  rashiRadius: 480,
  nakRadius: 600,
  grahaRadius: 596,
};

/** One graha, as the server computed it. */
export interface SkyPosition {
  id: string;
  name: string;
  sanskrit: string;
  glyph: string;
  css: string;
  color: number;
  /** Sidereal longitude, 0–360. */
  lon: number;
  /** Degrees into the rasi, 0–30. */
  degree: number;
  rashi: number;
  rashiName: string;
  nakshatraIndex: number;
  nakshatraName: string;
  retrograde?: boolean;
  /** Rendering size, in the wheel's metres. */
  size: number;
  ring?: boolean;
  shadow?: boolean;
}

export interface SpaceGraha {
  id: string;
  name: string;
  position: THREE.Vector3;
  positionData: SkyPosition;
  mesh: THREE.Object3D;
  group: THREE.Group;
}

export interface SpaceNakshatra {
  index: number;
  name: string;
  position: THREE.Vector3;
}

export interface SpaceWorld {
  group: THREE.Group;
  grahas: SpaceGraha[];
  nakshatras: SpaceNakshatra[];
  update(time: number, dt: number): void;
  surfaceAt(x: number, z: number, y: number): number | null;
  refresh(positions?: SkyPosition[]): void;
  dispose(): void;
}

const LIME = new THREE.MeshBasicMaterial({
  color: 0xd4ff3f,
  transparent: true,
  opacity: 0.52,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
const CYAN = new THREE.MeshBasicMaterial({
  color: 0x5ce1e6,
  transparent: true,
  opacity: 0.46,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});

const PLANET_TEXTURE: Record<string, string> = {
  sun: "2k_sun.jpg",
  moon: "2k_moon.jpg",
  mars: "2k_mars.jpg",
  mercury: "2k_mercury.jpg",
  jupiter: "2k_jupiter.jpg",
  venus: "2k_venus_surface.jpg",
  saturn: "2k_saturn.jpg",
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function planetTexture(id: string): THREE.Texture | null {
  const file = PLANET_TEXTURE[id];
  if (!file) return null;
  const cached = textureCache.get(file);
  if (cached) return cached;
  const tex = textureLoader.load(
    `/textures/planets/${file}`,
    undefined,
    undefined,
    () => console.warn(`[space] planet texture missing: ${file}`),
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(file, tex);
  return tex;
}

function ringTexture(): THREE.Texture {
  const cached = textureCache.get("ring");
  if (cached) return cached;
  const tex = textureLoader.load("/textures/planets/2k_saturn_ring_alpha.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set("ring", tex);
  return tex;
}

function atmosphereMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
        gl_FragColor = vec4(uColor, rim * 0.34);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    toneMapped: false,
  });
}

/** "12°34′" — a compact degree string for the label. */
function dms(degree: number): string {
  const d = Math.floor(degree);
  const m = Math.floor((degree - d) * 60);
  return `${d}\u00b0${String(m).padStart(2, "0")}\u2032`;
}

function makeGraha(position: SkyPosition, index: number): { group: THREE.Group; mesh: THREE.Mesh } {
  const radius = Math.max(9, position.size * 3.4);
  const group = new THREE.Group();
  const color = new THREE.Color(position.color);
  const isSun = position.id === "sun";
  const texture = planetTexture(position.id);

  const mat = isSun
    ? new THREE.MeshBasicMaterial({
        map: texture ?? undefined,
        color: texture ? 0xffffff : position.color,
        toneMapped: false,
      })
    : new THREE.MeshStandardMaterial({
        map: texture ?? undefined,
        color: texture ? 0xffffff : position.color,
        roughness:
          position.id === "jupiter" || position.id === "saturn"
            ? 0.92
            : position.id === "venus"
              ? 0.68
              : 0.84,
        metalness: 0.02,
        emissive: color,
        emissiveIntensity: position.shadow ? 0.12 : 0.045,
      });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 42), mat);
  group.add(mesh);

  if (!isSun) {
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.035, 48, 32),
        atmosphereMaterial(color),
      ),
    );
  }

  const halo = glowSprite(
    `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},1)`,
    radius * (isSun ? 3.4 : 2.1),
    isSun ? 0.42 : 0.13,
  );
  group.add(halo);
  group.userData.halo = halo;

  if (position.ring) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.55, radius * 2.75, 160),
      new THREE.MeshBasicMaterial({
        map: ringTexture(),
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = 0.16;
    group.add(ring);
  }

  if (position.shadow) {
    const cage = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.55, radius * 0.05, 4, 36),
      new THREE.MeshBasicMaterial({
        color: position.color,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    cage.rotation.x = Math.PI / 2;
    cage.rotation.y = index * 0.7;
    group.add(cage);
    const cage2 = cage.clone();
    cage2.rotation.z = Math.PI / 3;
    group.add(cage2);
  }

  // A small axial marker, not a stem to a lost floor.
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.4, 18, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: position.color,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  stem.position.y = -radius - 9;
  group.add(stem);

  const label = textSprite(`${position.glyph}  ${position.name}`, {
    color: position.css,
    sub: `${position.rashiName} ${dms(position.degree)} \u00b7 ${position.nakshatraName}${position.retrograde ? " \u211e" : ""}`,
    size: 52,
    scale: 14,
    overlay: true,
  });
  label.position.y = radius + 13;
  group.add(label);

  return { group, mesh };
}

export function createSpace(
  _quality: "high" | "balanced" | "low",
  initial: SkyPosition[],
): SpaceWorld {
  const group = new THREE.Group();
  group.position.y = SPACE_Y;

  /* ── orbital lines, not a floor ────────────────────────────────────────── */

  for (const r of [WHEEL.rashiRadius, WHEEL.nakRadius]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, r === WHEEL.nakRadius ? 0.45 : 1.1, 6, 260),
      r === WHEEL.nakRadius ? CYAN : LIME,
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  /* ── Meru, the axis ────────────────────────────────────────────────────── */

  const meru = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 4.4, 54, 8),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d14,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x1a2406,
      emissiveIntensity: 1,
    }),
  );
  meru.position.y = 27;
  group.add(meru);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7 - i * 0.9, 0.26, 6, 48), LIME);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8 + i * 9;
    group.add(ring);
  }
  const meruTip = glowSprite("rgba(212,255,63,1)", 30, 0.7);
  meruTip.position.y = 58;
  group.add(meruTip);
  const meruLabel = textSprite("MERU", { color: "#d4ff3f", size: 44, scale: 1.5 });
  meruLabel.position.set(0, 66, 0);
  group.add(meruLabel);
  const centerLight = new THREE.PointLight(0xd4ff3f, 420, 420, 1.7);
  centerLight.position.set(0, 32, 0);
  group.add(centerLight);

  /* ── the twelve rasis, as floating marks ───────────────────────────────── */

  const rashiGroup = new THREE.Group();
  RASIS_META.forEach((r, i) => {
    const a = ((i * 30 + 15) * Math.PI) / 180;
    const x = Math.cos(a) * WHEEL.rashiRadius;
    const z = Math.sin(a) * WHEEL.rashiRadius;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.12, 4, 40), LIME);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 16, z);
    rashiGroup.add(ring);
    const glyph = glyphSprite(r.glyph, "#a9e6c8", 2.4);
    glyph.position.set(x, 19, z);
    rashiGroup.add(glyph);
    const label = textSprite(r.name, { color: "#cfead9", size: 38, scale: 1.8 });
    label.position.set(x, 25, z);
    rashiGroup.add(label);
  });
  group.add(rashiGroup);

  /* ── the twenty-seven mansions ─────────────────────────────────────────── */

  const nakGroup = new THREE.Group();
  const nakshatras: SpaceNakshatra[] = [];
  NAKSHATRAS.forEach((n, i) => {
    const a = ((i * 360) / 27 + 180 / 27) * (Math.PI / 180);
    const x = Math.cos(a) * WHEEL.nakRadius;
    const z = Math.sin(a) * WHEEL.nakRadius;
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.4, 22, 6),
      new THREE.MeshStandardMaterial({
        color: 0x5ce1e6,
        emissive: 0x1d6b70,
        emissiveIntensity: 1.4,
        roughness: 0.5,
      }),
    );
    marker.position.set(x, 11, z);
    nakGroup.add(marker);
    const glow = glowSprite("rgba(92,225,230,1)", 14, 0.42);
    glow.position.set(x, 24, z);
    nakGroup.add(glow);
    const label = textSprite(`${String(i + 1).padStart(2, "0")} \u00b7 ${n.name}`, {
      color: "#a8e6e8",
      size: 38,
      scale: 11,
      overlay: true,
    });
    label.position.set(x, 34, z);
    nakGroup.add(label);
    nakshatras.push({
      index: i,
      name: n.name,
      position: new THREE.Vector3(x, SPACE_Y + 24, z),
    });
  });
  group.add(nakGroup);

  /* ── the nine grahas, inside their mansions ────────────────────────────── */

  const grahaGroup = new THREE.Group();
  const grahas: SpaceGraha[] = [];
  let positions = initial;
  const tethers: { g: SpaceGraha; nak: THREE.Line; rashi: THREE.Line }[] = [];

  const yFor = (i: number) => 44 + (i % 5) * 8;
  const lineMat = (color: number, opacity: number) =>
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

  const buildGrahas = () => {
    grahaGroup.clear();
    grahas.length = 0;
    tethers.length = 0;
    positions.forEach((p, i) => {
      const { group: g } = makeGraha(p, i);
      const a = (p.lon * Math.PI) / 180;
      const y = yFor(i);
      const x = Math.cos(a) * WHEEL.grahaRadius;
      const z = Math.sin(a) * WHEEL.grahaRadius;
      g.position.set(x, y, z);
      g.userData.baseY = y;
      g.userData.spin = 0.055 + (i % 4) * 0.014;
      grahaGroup.add(g);

      const graha: SpaceGraha = {
        id: p.id,
        name: `${p.sanskrit} \u00b7 ${p.name}`,
        position: new THREE.Vector3(x, SPACE_Y + y, z),
        positionData: p,
        mesh: g.children[0],
        group: g,
      };
      grahas.push(graha);

      const nakA = ((p.nakshatraIndex * 360) / 27 + 180 / 27) * (Math.PI / 180);
      const rashiA = ((p.rashi * 30 + 15) * Math.PI) / 180;
      const nakLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(Math.cos(nakA) * WHEEL.nakRadius, 24, Math.sin(nakA) * WHEEL.nakRadius),
        ]),
        lineMat(0x5ce1e6, 0.22),
      );
      const rashiLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(Math.cos(rashiA) * WHEEL.rashiRadius, 19, Math.sin(rashiA) * WHEEL.rashiRadius),
        ]),
        lineMat(0xd4ff3f, 0.1),
      );
      grahaGroup.add(nakLine, rashiLine);
      tethers.push({ g: graha, nak: nakLine, rashi: rashiLine });
    });
  };

  /** Recompute in place so the world's interactable vectors follow the planets. */
  const updatePositions = (next?: SkyPosition[]) => {
    if (next) positions = next;
    positions.forEach((p, i) => {
      const graha = grahas[i];
      const obj = grahaGroup.children[i * 3] as THREE.Group;
      if (!graha || !obj) return;
      const a = (p.lon * Math.PI) / 180;
      const y = yFor(i);
      const x = Math.cos(a) * WHEEL.grahaRadius;
      const z = Math.sin(a) * WHEEL.grahaRadius;
      graha.positionData = p;
      graha.position.set(x, SPACE_Y + y, z);
      obj.position.set(x, y, z);
      obj.userData.baseY = y;
      const tether = tethers[i];
      if (tether) {
        const nakA = ((p.nakshatraIndex * 360) / 27 + 180 / 27) * (Math.PI / 180);
        const rashiA = ((p.rashi * 30 + 15) * Math.PI) / 180;
        (tether.nak.geometry as THREE.BufferGeometry).setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(Math.cos(nakA) * WHEEL.nakRadius, 24, Math.sin(nakA) * WHEEL.nakRadius),
        ]);
        (tether.rashi.geometry as THREE.BufferGeometry).setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(Math.cos(rashiA) * WHEEL.rashiRadius, 19, Math.sin(rashiA) * WHEEL.rashiRadius),
        ]);
      }
    });
  };

  buildGrahas();
  group.add(grahaGroup);

  /* ── animation ────────────────────────────────────────────────────────── */

  const update = (time: number, dt: number) => {
    nakGroup.rotation.y = Math.sin(time * 0.008) * 0.006;
    rashiGroup.rotation.y = Math.sin(time * 0.006 + 1) * 0.004;
    grahas.forEach((g, i) => {
      const obj = g.group;
      if (!obj) return;
      const baseY = obj.userData.baseY ?? 44;
      obj.position.y = baseY + Math.sin(time * 0.5 + i * 1.3) * 0.6;
      g.position.y = SPACE_Y + obj.position.y;
      obj.rotation.y += dt * (obj.userData.spin ?? 0.06);
      const halo = obj.userData.halo as THREE.Sprite | undefined;
      if (halo?.isSprite) {
        halo.material.opacity =
          (g.id === "sun" ? 0.36 : 0.11) + Math.sin(time * 1.1 + i) * 0.03;
      }
    });
    meruTip.material.opacity = 0.55 + Math.sin(time * 1.7) * 0.15;
    centerLight.intensity = 240 + Math.sin(time * 2.2) * 28;
  };

  // The wheel has no walking surface. The body must fly here.
  const surfaceAt = () => null;

  const dispose = () => {
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
      if ((o as THREE.Sprite).isSprite) {
        const s = o as THREE.Sprite;
        (s.material as THREE.SpriteMaterial).dispose();
      }
      if ((o as THREE.Line).isLine) {
        (o as THREE.Line).geometry.dispose();
        ((o as THREE.Line).material as THREE.Material).dispose();
      }
    });
  };

  const refresh = (next?: SkyPosition[]) => updatePositions(next);

  return { group, grahas, nakshatras, update, surfaceAt, refresh, dispose };
}

export const GRAHA_IDS = GRAHAS.map((graha) => graha.id);
