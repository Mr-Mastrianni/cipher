import * as THREE from "three";

import { SURFACE_VERTEX } from "./earth";
import { HALF_HEIGHT, type Frame } from "./framing";

/**
 * The nine grahas on a zodiac wheel arching over the horizon.
 *
 * Every body stands at its real sidereal longitude (from the KP engine, mean
 * node), so it sits inside the rasi it is transiting today; ecliptic latitude
 * lifts it a little off the wheel. The page opens with tonight's Moon overhead;
 * as it scrolls, the wheel turns the way the sky turns through a night,
 * pausing as each graha — or each close gathering of them — comes to the top.
 * The Sun's place on the wheel is where the light on everything comes from.
 *
 * Sizes are cinematic, not to scale: each body is sized against the screen.
 * Phases are real in kind: the Moon's follows its elongation from the Sun, and
 * the planets' follow the Sun–planet–Earth angle their orbits allow.
 *
 * Textures: Solar System Scope, CC BY 4.0 (public/textures/planets). Rahu and
 * Ketu are not bodies; they are drawn as what they cause — an eclipse.
 */

export type GrahaId =
  | "sun"
  | "moon"
  | "mars"
  | "mercury"
  | "jupiter"
  | "venus"
  | "saturn"
  | "rahu"
  | "ketu";

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

interface Look {
  /** Radius as a share of the screen height. */
  size: number;
  map?: string;
  /** Orbital radius in AU; sets how full the disc can look. */
  orbit?: number;
  atmosphere?: [number, number, number, number];
}

const LOOK: Record<GrahaId, Look> = {
  sun: { size: 0.07, map: "/textures/planets/1k_sun.jpg" },
  moon: { size: 0.04, map: "/textures/planets/1k_moon.jpg" },
  mercury: { size: 0.022, map: "/textures/planets/1k_mercury.jpg", orbit: 0.387 },
  venus: { size: 0.034, map: "/textures/planets/1k_venus_atmosphere.jpg", orbit: 0.723, atmosphere: [1.0, 0.86, 0.6, 0.9] },
  mars: { size: 0.028, map: "/textures/planets/1k_mars.jpg", orbit: 1.524, atmosphere: [1.0, 0.6, 0.45, 0.35] },
  jupiter: { size: 0.06, map: "/textures/planets/1k_jupiter.jpg", orbit: 5.2, atmosphere: [0.95, 0.86, 0.72, 0.4] },
  saturn: { size: 0.046, map: "/textures/planets/1k_saturn.jpg", orbit: 9.54, atmosphere: [0.95, 0.88, 0.7, 0.3] },
  rahu: { size: 0.032 },
  ketu: { size: 0.026 },
};

export const PLANET_MAPS = [
  ...new Set(Object.values(LOOK).flatMap((look) => (look.map ? [look.map] : []))),
  "/textures/planets/2k_saturn_ring_alpha.png",
];

/** Grahas closer than this along the wheel come overhead together. */
const GATHER_DEG = 18;
/** The share of each step the wheel holds still before turning on. */
const HOLD = 0.45;

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
function glowTexture(stops: [number, string][], size = 256): THREE.Texture {
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

/** The Sun–body–Earth angle: 0 is a full disc, 180 a new one. */
function phaseAngle(graha: GrahaId, elongation: number): number {
  if (graha === "moon") return 180 - elongation;
  const orbit = LOOK[graha].orbit;
  if (!orbit) return 0;
  const sine = Math.min(1, Math.sin(THREE.MathUtils.degToRad(elongation)) / orbit);
  return THREE.MathUtils.radToDeg(Math.asin(sine));
}

interface Body {
  transit: Transit;
  look: Look;
  group: THREE.Group;
  spinner: THREE.Object3D | null;
  lightDir: THREE.Vector3 | null;
  label: HTMLElement;
}

/**
 * The wheel's turn at each stop, from 0 (the Moon overhead) to 360 (the Moon
 * again), one stop per graha or gathering, in the order the turning sky
 * brings them up.
 */
function stopsFor(transits: readonly Transit[], anchor: number): number[] {
  const turns = transits
    .map((transit) => (((anchor - transit.longitude) % 360) + 360) % 360)
    .filter((turn) => turn > GATHER_DEG / 2 && turn < 360 - GATHER_DEG / 2)
    .sort((a, b) => a - b);
  const stops = [0];
  let gathering: number[] = [];
  for (const turn of turns) {
    if (gathering.length && turn - gathering[gathering.length - 1] > GATHER_DEG) {
      stops.push(gathering.reduce((sum, value) => sum + value, 0) / gathering.length);
      gathering = [];
    }
    gathering.push(turn);
  }
  if (gathering.length) stops.push(gathering.reduce((sum, value) => sum + value, 0) / gathering.length);
  stops.push(360);
  return stops;
}

export interface Planets {
  group: THREE.Group;
  /** The wheel's turn, in degrees, at this progress through the page. */
  turnAt(progress: number): number;
  /** World position of the Sun this frame; light comes from here. */
  sun: THREE.Vector3;
  update(frame: Frame, turnDeg: number, time: number, dt: number): void;
  /** Place the DOM labels; call after the camera has rendered. */
  place(camera: THREE.Camera, width: number, height: number): void;
  dispose(): void;
}

export function createPlanets(
  transits: readonly Transit[],
  maps: Map<string, THREE.Texture>,
  labelLayer: HTMLElement | null,
): Planets {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(value: T) => (disposables.push(value), value);

  const sunLon = transits.find((transit) => transit.graha === "sun")?.longitude ?? 0;
  // Tonight's Moon is overhead when the page opens.
  const anchor = transits.find((transit) => transit.graha === "moon")?.longitude ?? sunLon;
  const stops = stopsFor(transits, anchor);

  // ── The wheel: a hairline circle, twelve rasi bounds, twenty-seven
  //    nakshatra beads. It rotates as one with the sky.
  const wheel = new THREE.Group();
  const lineMaterial = keep(
    new THREE.LineBasicMaterial({ color: 0xbfa273, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  const circle = keep(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 721 }, (_, i) => {
        const a = (i / 720) * Math.PI * 2;
        return new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
      }),
    ),
  );
  wheel.add(new THREE.Line(circle, lineMaterial));
  const ticks: THREE.Vector3[] = [];
  for (let rasi = 0; rasi < 12; rasi++) {
    const a = THREE.MathUtils.degToRad(rasi * 30);
    const dir = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    ticks.push(dir.clone().multiplyScalar(0.982), dir.clone().multiplyScalar(1.018));
  }
  const tickGeometry = keep(new THREE.BufferGeometry().setFromPoints(ticks));
  wheel.add(new THREE.LineSegments(tickGeometry, lineMaterial));
  const beads = keep(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 27 }, (_, i) => {
        const a = THREE.MathUtils.degToRad((i * 360) / 27);
        return new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
      }),
    ),
  );
  const beadMaterial = keep(
    new THREE.PointsMaterial({ color: 0xd9c9a6, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.45 }),
  );
  wheel.add(new THREE.Points(beads, beadMaterial));
  group.add(wheel);

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
  const streakCanvas = document.createElement("canvas");
  streakCanvas.width = 512;
  streakCanvas.height = 16;
  {
    const context = streakCanvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 512, 0);
    gradient.addColorStop(0, "rgba(255,190,120,0)");
    gradient.addColorStop(0.5, "rgba(255,225,190,0.9)");
    gradient.addColorStop(1, "rgba(255,190,120,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 6, 512, 4);
  }
  const streak = keep(new THREE.CanvasTexture(streakCanvas));

  const sphere = keep(new THREE.SphereGeometry(1, 64, 32));

  const bodies: Body[] = transits.map((transit) => {
    const look = LOOK[transit.graha];
    const body = new THREE.Group();
    let spinner: THREE.Object3D | null = null;
    let lightDir: THREE.Vector3 | null = null;

    if (transit.graha === "sun") {
      const material = keep(
        new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERTEX,
          fragmentShader: SUN_FRAGMENT,
          uniforms: { map: { value: maps.get(look.map!) }, time: { value: 0 } },
        }),
      );
      spinner = new THREE.Mesh(sphere, material);
      const glow = sprite(coreGlow, 0xffffff, 1);
      glow.scale.setScalar(5.2);
      const wide = sprite(halo, 0xffffff, 0.55);
      wide.scale.setScalar(16);
      const flare = sprite(streak, 0xffe2c2, 0.5);
      flare.scale.set(46, 1.2, 1);
      body.add(wide, glow, spinner, flare);
    } else if (transit.graha === "rahu" || transit.graha === "ketu") {
      const disc = new THREE.Mesh(sphere, keep(new THREE.MeshBasicMaterial({ color: 0x000000 })));
      const ring = sprite(corona, transit.graha === "rahu" ? 0xffe1b0 : 0xd6e2ff, 0.95);
      ring.scale.setScalar(2.35);
      const outer = sprite(halo, transit.graha === "rahu" ? 0xffd9a0 : 0xc8d8ff, 0.35);
      outer.scale.setScalar(6);
      body.add(outer, ring, disc);
    } else {
      lightDir = new THREE.Vector3(1, 0, 0);
      const atmosphere = look.atmosphere ?? [0, 0, 0, 0];
      const material = keep(
        new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERTEX,
          fragmentShader: BODY_FRAGMENT,
          uniforms: {
            map: { value: maps.get(look.map!) },
            lightDir: { value: lightDir },
            atmosphere: { value: new THREE.Vector4(...atmosphere) },
            lunar: { value: transit.graha === "moon" ? 1 : 0 },
          },
        }),
      );
      spinner = new THREE.Mesh(sphere, material);
      spinner.rotation.x = 0.2;
      body.add(spinner);

      if (transit.graha === "saturn") {
        const ringGeometry = keep(new THREE.RingGeometry(1.24, 2.27, 128, 1));
        // Map u across the ring's width, the way the band texture runs.
        const position = ringGeometry.attributes.position;
        const uv = ringGeometry.attributes.uv;
        for (let i = 0; i < position.count; i++) {
          const r = Math.hypot(position.getX(i), position.getY(i));
          uv.setXY(i, (r - 1.24) / (2.27 - 1.24), 0.5);
        }
        const ringMaterial = keep(
          new THREE.ShaderMaterial({
            vertexShader: RING_VERTEX,
            fragmentShader: RING_FRAGMENT,
            uniforms: {
              map: { value: maps.get("/textures/planets/2k_saturn_ring_alpha.png") },
              lightDir: { value: lightDir },
            },
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
          }),
        );
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.set(-Math.PI / 2 + 0.26, 0.42, 0);
        body.add(ring);
      }
    }

    group.add(body);
    const label = document.createElement("div");
    label.className =
      "pointer-events-none absolute left-0 top-0 whitespace-nowrap font-mono text-[8.5px] uppercase leading-[1.5] tracking-[0.2em] opacity-0 transition-opacity duration-500 will-change-transform";
    label.innerHTML = `<span class="block text-bone">${transit.name}${transit.retrograde && transit.graha !== "rahu" && transit.graha !== "ketu" ? ' <span class="text-faint">℞</span>' : ""}</span><span class="block text-gold">${transit.place}</span>`;
    labelLayer?.appendChild(label);

    return { transit, look, group: body, spinner, lightDir, label };
  });

  // Larger bodies claim the wheel line first; smaller ones step aside.
  const bySize = [...bodies].sort((a, b) => b.look.size - a.look.size);

  // Rasi names, just outside the wheel at the middle of each sign.
  const RASI_NAMES = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"];
  const rasiLabels = RASI_NAMES.map((name) => {
    const element = document.createElement("div");
    element.className =
      "pointer-events-none absolute left-0 top-0 whitespace-nowrap font-mono text-[7.5px] uppercase tracking-[0.28em] text-gold/60 will-change-transform";
    element.textContent = name;
    labelLayer?.appendChild(element);
    return element;
  });

  const sun = new THREE.Vector3();
  const wheelCentre = new THREE.Vector3();
  const toCamera = new THREE.Vector3(0, 0, 1);
  const towardSun = new THREE.Vector3();
  let wheelRadius = 1;
  let unit = 1;
  let turn = 0;

  /** Screen angle (counter-clockwise from the top) of a longitude, degrees. */
  const angleOf = (longitude: number) => longitude - anchor + turn;

  const positionOf = (longitude: number, lift: number, target: THREE.Vector3) => {
    const a = THREE.MathUtils.degToRad(angleOf(longitude));
    const r = wheelRadius + lift;
    return target.set(wheelCentre.x - Math.sin(a) * r, wheelCentre.y + Math.cos(a) * r, 0);
  };

  const projected = new THREE.Vector3();
  /** Label widths, measured once: the text never changes. */
  const labelWidth = new Map<Body, number>();
  const edge = new THREE.Vector3();

  return {
    group,
    sun,
    turnAt(progress) {
      const steps = stops.length - 1;
      const at = Math.min(Math.max(progress, 0), 1) * steps;
      const step = Math.min(steps - 1, Math.floor(at));
      const within = THREE.MathUtils.smoothstep((at - step - HOLD) / (1 - HOLD), 0, 1);
      return stops[step] + (stops[step + 1] - stops[step]) * within;
    },
    update(frame, turnDeg, time, dt) {
      turn = turnDeg;
      wheelRadius = frame.wheelRadius;
      unit = 2 * HALF_HEIGHT;
      wheelCentre.set(0, frame.centreY, 0);

      wheel.position.copy(wheelCentre);
      wheel.scale.setScalar(wheelRadius);
      wheel.rotation.z = THREE.MathUtils.degToRad(angleOf(0));

      positionOf(sunLon, 0, sun);

      // Bodies that would overlap on screen step off the wheel line, the
      // first outward, the next inward, so a conjunction reads as a
      // gathering rather than a pile.
      const placed: Body[] = [];
      for (const body of bySize) {
        const { transit, look } = body;
        const radius = look.size * unit;
        let lift = transit.latitude * 0.012 * unit;
        positionOf(transit.longitude, lift, body.group.position);
        const crowded = placed.filter(
          (other) =>
            other.group.position.distanceTo(body.group.position) < (other.group.scale.x + radius) * 1.25,
        );
        if (crowded.length) {
          const step = Math.max(...crowded.map((other) => other.group.scale.x)) + radius;
          lift += (crowded.length % 2 === 1 ? 1 : -1) * step * 1.3 * Math.ceil(crowded.length / 2);
          positionOf(transit.longitude, lift, body.group.position);
        }
        body.group.scale.setScalar(radius);
        placed.push(body);
      }

      for (const body of bodies) {
        const { transit } = body;
        if (body.spinner && transit.graha !== "sun") body.spinner.rotation.y += dt * 0.06;
        if (body.lightDir) {
          const elongation = Math.abs(((transit.longitude - sunLon + 540) % 360) - 180);
          const phase = THREE.MathUtils.degToRad(phaseAngle(transit.graha, elongation));
          towardSun.subVectors(sun, body.group.position).setZ(0).normalize();
          body.lightDir
            .copy(toCamera)
            .multiplyScalar(Math.cos(phase))
            .addScaledVector(towardSun, Math.sin(phase))
            .normalize();
        }
      }
      const star = bodies.find((body) => body.transit.graha === "sun");
      if (star?.spinner) {
        const material = (star.spinner as THREE.Mesh).material as THREE.ShaderMaterial;
        material.uniforms.time.value = time;
      }
    },
    place(camera, width, height) {
      const toScreen = (world: THREE.Vector3) => {
        projected.copy(world).project(camera);
        return [(projected.x * 0.5 + 0.5) * width, (-projected.y * 0.5 + 0.5) * height] as const;
      };
      const discs = bodies.map((body) => {
        const [x, y] = toScreen(body.group.position);
        edge.copy(body.group.position).setX(body.group.position.x + body.group.scale.x);
        const [ex] = toScreen(edge);
        const r = Math.abs(ex - x);
        return { body, x, y, r, visible: x > -r && x < width + r && y > -r && y < height + r };
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
        body.label.style.opacity = visible ? "1" : "0";
        if (!visible) continue;
        labelWidth.set(body, labelWidth.get(body) || body.label.offsetWidth || 90);
        const w = labelWidth.get(body)!;
        const h = 26;
        const options = [
          { left: x + r + 10, top: y - h / 2 },
          { left: x - r - 10 - w, top: y - h / 2 },
          { left: x - w / 2, top: y + r + 6 },
        ];
        const chosen =
          options.find((option) =>
            clear({ left: option.left, top: option.top, right: option.left + w, bottom: option.top + h }, body),
          ) ?? options[0];
        taken.push({ left: chosen.left, top: chosen.top, right: chosen.left + w, bottom: chosen.top + h });
        body.label.style.transform = `translate3d(${Math.round(chosen.left)}px, ${Math.round(chosen.top)}px, 0)`;
      }
      rasiLabels.forEach((element, index) => {
        positionOf(index * 30 + 15, 0.045 * unit, edge);
        const [x, y] = toScreen(edge);
        const visible = x > -60 && x < width + 60 && y > -20 && y < height + 20;
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
