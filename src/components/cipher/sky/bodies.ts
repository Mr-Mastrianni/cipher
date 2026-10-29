import * as THREE from "three";

import { SURFACE_VERTEX } from "./earth";
import { eclipticPoint, LUNAR_INCLINATION, ORBIT, RADIUS, ZODIAC_RADIUS, type BodyId } from "./layout";

/**
 * The nine grahas in the space around the Earth.
 *
 * Every body stands on its own sphere at its real sidereal longitude (KP
 * engine, mean node), so it is inside the rasi it is transiting today. The
 * Moon rides an orbit tipped to the ecliptic, crossing it at Rahu and Ketu, so
 * its latitude above or below the ecliptic is real in kind. Light comes from
 * where the Sun actually is in the space, so every phase — the Moon's above
 * all — falls out of the geometry rather than being painted on.
 *
 * Textures: Solar System Scope, CC BY 4.0 (public/textures/planets). Rahu and
 * Ketu are not bodies; they are drawn as what they cause — an eclipse.
 */

export type GrahaId = Exclude<BodyId, "earth">;

export interface Transit {
  graha: GrahaId;
  /** Sidereal longitude, [0, 360). */
  longitude: number;
  /** Ecliptic latitude, degrees. */
  latitude: number;
  retrograde: boolean;
  /** "Jupiter" */
  name: string;
  /** "Karka 14°" */
  place: string;
}

const MAP: Partial<Record<GrahaId, string>> = {
  sun: "/textures/planets/1k_sun.jpg",
  moon: "/textures/planets/1k_moon.jpg",
  mercury: "/textures/planets/1k_mercury.jpg",
  venus: "/textures/planets/1k_venus_atmosphere.jpg",
  mars: "/textures/planets/1k_mars.jpg",
  jupiter: "/textures/planets/1k_jupiter.jpg",
  saturn: "/textures/planets/1k_saturn.jpg",
};
const RING_MAP = "/textures/planets/2k_saturn_ring_alpha.png";
export const PLANET_MAPS = [...Object.values(MAP), RING_MAP];

const ATMOSPHERE: Partial<Record<GrahaId, [number, number, number, number]>> = {
  venus: [1.0, 0.86, 0.6, 0.9],
  mars: [1.0, 0.6, 0.45, 0.35],
  jupiter: [0.95, 0.86, 0.72, 0.4],
  saturn: [0.95, 0.88, 0.7, 0.3],
};

const BODY_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 lightDir;
  uniform vec4 atmosphere;
  uniform float lunar;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    float ndl = dot(n, lightDir);
    float ndv = max(dot(n, v), 0.0);
    // Airless dust scatters back to the source (a flat full Moon);
    // everything else is Lambertian.
    float lambert = max(ndl, 0.0);
    float lommel = 2.0 * lambert / (lambert + ndv + 1e-3);
    float diffuse = mix(lambert, lommel * 0.62, lunar);
    vec3 color = texture2D(map, vUv).rgb * (diffuse * 1.2 + 0.006);
    float rim = pow(1.0 - ndv, 3.0) * smoothstep(-0.25, 0.4, ndl);
    color += atmosphere.rgb * rim * atmosphere.a;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SUN_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float mu = max(dot(n, normalize(cameraPosition - vWorldPos)), 0.0);
    vec3 surface = texture2D(map, vUv + vec2(time * 0.002, 0.0)).rgb;
    // Limb darkening: the edge of a star is cooler and dimmer.
    float limb = 0.42 + 0.58 * pow(mu, 0.55);
    gl_FragColor = vec4(surface * vec3(2.4, 1.75, 1.1) * limb + vec3(0.35, 0.18, 0.04), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const RING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 lightDir;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vec4 band = texture2D(map, vec2(vUv.x, 0.5));
    float lit = abs(dot(normalize(vWorldNormal), lightDir)) * 0.85 + 0.12;
    gl_FragColor = vec4(band.rgb * lit * 1.1, band.a * 0.9);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A soft radial sprite, drawn once on a canvas. */
export function glowTexture(stops: [number, string][], size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sprite(texture: THREE.Texture, color: THREE.ColorRepresentation, opacity: number) {
  return new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
}

function ringLine(radius: number, material: THREE.LineBasicMaterial, segments = 360) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }),
  );
  return new THREE.Line(geometry, material);
}

interface Body {
  id: GrahaId;
  transit: Transit;
  group: THREE.Group;
  spinner: THREE.Object3D | null;
  lightDir: THREE.Vector3 | null;
  label: HTMLElement;
}

/** What each label says under the name: a destination, or today's place. */
export type Caption = (id: BodyId, place: string) => string;

export interface Bodies {
  group: THREE.Group;
  /** World position of each body; fixed for the visit. */
  position(id: GrahaId): THREE.Vector3;
  /** Invisible spheres, a little larger than each body, for picking. */
  targets: THREE.Mesh[];
  update(time: number, dt: number, scale: number): void;
  /** Place the DOM labels; call after the camera has rendered. */
  place(camera: THREE.Camera, width: number, height: number, focus: BodyId | null, hover: BodyId | null): void;
  dispose(): void;
}

export function createBodies(
  transits: readonly Transit[],
  maps: Map<string, THREE.Texture>,
  labelLayer: HTMLElement | null,
  caption: Caption,
): Bodies {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(value: T) => (disposables.push(value), value);

  const longitudeOf = (id: GrahaId) => transits.find((transit) => transit.graha === id)?.longitude ?? 0;

  // ── Orbits, the zodiac ring and its twelve bounds.
  const orbitMaterial = keep(
    new THREE.LineBasicMaterial({ color: 0xbfa273, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  const ringMaterial = keep(
    new THREE.LineBasicMaterial({ color: 0xd9c9a6, transparent: true, opacity: 0.34, depthWrite: false }),
  );
  for (const radius of new Set([ORBIT.mercury, ORBIT.venus, ORBIT.sun, ORBIT.mars, ORBIT.jupiter, ORBIT.saturn])) {
    const line = ringLine(radius, orbitMaterial);
    keep(line.geometry);
    group.add(line);
  }
  // The Moon's orbit: tipped about the line of the nodes.
  const nodeAxis = eclipticPoint(longitudeOf("rahu"), 1).normalize();
  const lunarTilt = new THREE.Quaternion().setFromAxisAngle(nodeAxis, LUNAR_INCLINATION);
  const lunarOrbit = ringLine(ORBIT.moon, orbitMaterial);
  keep(lunarOrbit.geometry);
  lunarOrbit.quaternion.copy(lunarTilt);
  group.add(lunarOrbit);

  const zodiac = ringLine(ZODIAC_RADIUS, ringMaterial, 720);
  keep(zodiac.geometry);
  group.add(zodiac);
  const ticks: THREE.Vector3[] = [];
  for (let rasi = 0; rasi < 12; rasi++) {
    ticks.push(eclipticPoint(rasi * 30, ZODIAC_RADIUS - 0.35), eclipticPoint(rasi * 30, ZODIAC_RADIUS + 0.35));
  }
  group.add(new THREE.LineSegments(keep(new THREE.BufferGeometry().setFromPoints(ticks)), ringMaterial));

  // ── Glows, shared.
  const coreGlow = keep(
    glowTexture([
      [0, "rgba(255,255,255,1)"],
      [0.18, "rgba(255,235,200,0.85)"],
      [0.42, "rgba(255,170,90,0.28)"],
      [1, "rgba(255,120,40,0)"],
    ]),
  );
  const halo = keep(
    glowTexture([
      [0, "rgba(255,210,150,0.5)"],
      [0.35, "rgba(255,170,100,0.12)"],
      [1, "rgba(255,140,80,0)"],
    ]),
  );
  const corona = keep(
    glowTexture([
      [0, "rgba(0,0,0,0)"],
      [0.44, "rgba(0,0,0,0)"],
      [0.5, "rgba(255,255,255,1)"],
      [0.58, "rgba(255,245,225,0.45)"],
      [0.8, "rgba(255,230,190,0.08)"],
      [1, "rgba(255,220,180,0)"],
    ]),
  );

  const sphere = keep(new THREE.SphereGeometry(1, 64, 32));
  const pickSphere = keep(new THREE.SphereGeometry(1.6, 12, 8));
  const pickMaterial = keep(new THREE.MeshBasicMaterial({ visible: false }));
  const targets: THREE.Mesh[] = [];
  const sunPosition = eclipticPoint(longitudeOf("sun"), ORBIT.sun);

  const bodies: Body[] = transits.map((transit) => {
    const id = transit.graha;
    const body = new THREE.Group();
    body.name = id;
    let spinner: THREE.Object3D | null = null;
    let lightDir: THREE.Vector3 | null = null;

    if (id === "moon") {
      eclipticPoint(transit.longitude, ORBIT.moon, body.position).applyQuaternion(lunarTilt);
    } else {
      eclipticPoint(transit.longitude, ORBIT[id], body.position);
    }

    if (id === "sun") {
      const material = keep(
        new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERTEX,
          fragmentShader: SUN_FRAGMENT,
          uniforms: { map: { value: maps.get(MAP.sun!) }, time: { value: 0 } },
        }),
      );
      spinner = new THREE.Mesh(sphere, material);
      const glow = sprite(coreGlow, 0xffffff, 1);
      glow.scale.setScalar(5.2);
      const wide = sprite(halo, 0xffffff, 0.5);
      wide.scale.setScalar(18);
      body.add(wide, glow, spinner);
    } else if (id === "rahu" || id === "ketu") {
      const disc = new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: 0x000000 })));
      const ring = sprite(corona, id === "rahu" ? 0xffe1b0 : 0xd6e2ff, 0.95);
      ring.scale.setScalar(2.35);
      const outer = sprite(halo, id === "rahu" ? 0xffd9a0 : 0xc8d8ff, 0.35);
      outer.scale.setScalar(6);
      body.add(outer, ring, disc);
    } else {
      lightDir = sunPosition.clone().sub(body.position).normalize();
      const material = keep(
        new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERTEX,
          fragmentShader: BODY_FRAGMENT,
          uniforms: {
            map: { value: maps.get(MAP[id]!) },
            lightDir: { value: lightDir },
            atmosphere: { value: new THREE.Vector4(...(ATMOSPHERE[id] ?? [0, 0, 0, 0])) },
            lunar: { value: id === "moon" ? 1 : 0 },
          },
        }),
      );
      spinner = new THREE.Mesh(sphere, material);
      spinner.rotation.x = 0.2;
      body.add(spinner);

      if (id === "saturn") {
        const ringGeometry = keep(new THREE.RingGeometry(1.24, 2.27, 128, 1));
        // Map u across the ring's width, the way the band texture runs.
        const position = ringGeometry.attributes.position;
        const uv = ringGeometry.attributes.uv;
        for (let i = 0; i < position.count; i++) {
          const r = Math.hypot(position.getX(i), position.getY(i));
          uv.setXY(i, (r - 1.24) / (2.27 - 1.24), 0.5);
        }
        const ring = new THREE.Mesh(
          ringGeometry,
          keep(
            new THREE.ShaderMaterial({
              vertexShader: RING_VERTEX,
              fragmentShader: RING_FRAGMENT,
              uniforms: { map: { value: maps.get(RING_MAP) }, lightDir: { value: lightDir } },
              side: THREE.DoubleSide,
              transparent: true,
              depthWrite: false,
            }),
          ),
        );
        // Saturn's equator, and so its rings, is tipped 26.7° to its orbit.
        ring.rotation.set(-Math.PI / 2 + 0.47, 0, 0.2);
        body.add(ring);
      }
    }

    const target = new THREE.Mesh(pickSphere, pickMaterial);
    target.name = id;
    body.add(target);
    targets.push(target);
    group.add(body);

    const label = document.createElement("div");
    label.className =
      "pointer-events-none absolute left-0 top-0 whitespace-nowrap text-left opacity-0 transition-opacity duration-500 will-change-transform";
    label.innerHTML = `<span class="block font-display text-[15px] leading-tight text-bone">${transit.name}${
      transit.retrograde && id !== "rahu" && id !== "ketu" ? ' <span class="text-faint">℞</span>' : ""
    }</span><span class="block font-display text-[13px] italic leading-tight text-gold">${caption(id, transit.place)}</span>`;
    labelLayer?.appendChild(label);

    return { id, transit, group: body, spinner, lightDir, label };
  });

  // Rasi names, just outside the ring at the middle of each sign.
  const RASI_NAMES = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"];
  const rasiPoints = RASI_NAMES.map((_, index) => eclipticPoint(index * 30 + 15, ZODIAC_RADIUS + 1.1));
  const rasiLabels = RASI_NAMES.map((name) => {
    const element = document.createElement("div");
    element.className =
      "pointer-events-none absolute left-0 top-0 whitespace-nowrap font-display text-[13px] italic text-gold/70 will-change-transform";
    element.textContent = name;
    labelLayer?.appendChild(element);
    return element;
  });

  const projected = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const right = new THREE.Vector3();
  const labelWidth = new Map<Body, number>();

  return {
    group,
    targets,
    position(id) {
      return bodies.find((body) => body.id === id)?.group.position ?? new THREE.Vector3();
    },
    update(time, dt, scale) {
      for (const body of bodies) {
        body.group.scale.setScalar(RADIUS[body.id] * scale);
        if (body.spinner && body.id !== "sun") body.spinner.rotation.y += dt * 0.06;
      }
      const star = bodies.find((body) => body.id === "sun");
      if (star?.spinner) ((star.spinner as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.time.value = time;
    },
    place(camera, width, height, focus, hover) {
      const toScreen = (world: THREE.Vector3) => {
        projected.copy(world).project(camera);
        return [(projected.x * 0.5 + 0.5) * width, (-projected.y * 0.5 + 0.5) * height, projected.z] as const;
      };
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      const discs = bodies.map((body) => {
        const [x, y, z] = toScreen(body.group.position);
        edge.copy(body.group.position).addScaledVector(right, body.group.scale.x);
        const [ex, ey] = toScreen(edge);
        const r = Math.hypot(ex - x, ey - y);
        const visible =
          z < 1 && body.id !== focus && x > -r && x < width + r && y > -r && y < height + r;
        return { body, x, y, r, visible };
      });

      // Each label takes the first of right, left or below that clears every
      // other disc and every label already placed.
      const taken: { left: number; top: number; right: number; bottom: number }[] = [];
      const clear = (box: (typeof taken)[number], self: Body) =>
        discs.every(
          (disc) =>
            disc.body === self ||
            !disc.visible ||
            disc.x + disc.r < box.left ||
            disc.x - disc.r > box.right ||
            disc.y + disc.r < box.top ||
            disc.y - disc.r > box.bottom,
        ) &&
        taken.every(
          (other) =>
            box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom,
        );
      for (const { body, x, y, r, visible } of discs) {
        body.label.style.opacity = visible ? (hover && hover !== body.id ? "0.55" : "1") : "0";
        if (!visible) continue;
        labelWidth.set(body, labelWidth.get(body) || body.label.offsetWidth || 110);
        const w = labelWidth.get(body)!;
        const h = 34;
        const gap = Math.max(8, r * 0.35);
        const options = [
          { left: x + r + gap, top: y - h / 2 },
          { left: x - r - gap - w, top: y - h / 2 },
          { left: x - w / 2, top: y + r + 4 },
        ];
        const chosen =
          options.find((option) =>
            clear({ left: option.left, top: option.top, right: option.left + w, bottom: option.top + h }, body),
          ) ?? options[0];
        taken.push({ left: chosen.left, top: chosen.top, right: chosen.left + w, bottom: chosen.top + h });
        body.label.style.transform = `translate3d(${Math.round(chosen.left)}px, ${Math.round(chosen.top)}px, 0)`;
      }

      // Rasi names only when the whole sky is in view.
      rasiLabels.forEach((element, index) => {
        const [x, y, z] = toScreen(rasiPoints[index]);
        const visible = focus === null && z < 1 && x > -60 && x < width + 60 && y > -20 && y < height + 20;
        element.style.opacity = visible ? "1" : "0";
        if (visible) element.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
      });
    },
    dispose() {
      for (const item of disposables) item.dispose();
      for (const body of bodies) body.label.remove();
      for (const element of rasiLabels) element.remove();
    },
  };
}
