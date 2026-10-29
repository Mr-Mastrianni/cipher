import * as THREE from "three";

import { HALF_HEIGHT } from "./framing";

/**
 * The civilisation: what a people who build in gold and indigo have put
 * around their world.
 *
 * - An orbital ring in the equatorial plane, set with habitat modules, held
 *   by two light-tethers that rise from the equator over Kenya and Gabon.
 * - Beacon spires over Africa's great cities, lit as night reaches them.
 * - Ships in orbit, each with a hull shaped like a cowrie — the shell that was
 *   currency and ornament across the continent — a crescent of wing around it,
 *   and a trail of light behind.
 * - Now and then, one ship crosses the sky close to us.
 *
 * Everything here is original geometry; nothing is copied from a sacred mark.
 */

const CITIES: readonly [string, number, number][] = [
  ["Lagos", 6.5, 3.4],
  ["Accra", 5.6, -0.2],
  ["Abidjan", 5.3, -4.0],
  ["Dakar", 14.7, -17.4],
  ["Kano", 12.0, 8.5],
  ["Kinshasa", -4.3, 15.3],
  ["Nairobi", -1.3, 36.8],
  ["Addis Ababa", 9.0, 38.7],
  ["Khartoum", 15.6, 32.5],
  ["Cairo", 30.0, 31.2],
  ["Dar es Salaam", -6.8, 39.3],
  ["Johannesburg", -26.2, 28.0],
  ["Luanda", -8.8, 13.2],
];

/** Equatorial anchor longitudes for the two tethers. */
const TETHERS = [37.0, 10.5];
const RING_RADIUS = 1.14;

/** A direction on the unit sphere, in the globe texture's own frame. */
function surfacePoint(lat: number, lon: number): THREE.Vector3 {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta),
    Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
  );
}

/** Seeded, so every visitor sees the same fleet. */
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function glowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,220,160,0.6)");
  gradient.addColorStop(1, "rgba(255,180,90,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** One ship, nose along +z: hull, crescent wing, indigo band, engine. */
function buildShipParts() {
  // The cowrie: a long, swollen seed, flattened underneath.
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.17 * Math.pow(Math.sin(Math.PI * t), 0.75) * (1 - 0.25 * t);
    profile.push(new THREE.Vector2(Math.max(r, 0.0001), t - 0.5));
  }
  const hull = new THREE.LatheGeometry(profile, 20);
  hull.rotateX(Math.PI / 2);
  hull.scale(1, 0.62, 1);

  const wing = new THREE.TorusGeometry(0.27, 0.022, 6, 32, Math.PI * 1.1);
  wing.rotateZ(-Math.PI * 0.05);
  wing.rotateX(Math.PI / 2);
  wing.translate(0, 0, -0.08);

  const band = new THREE.TorusGeometry(0.145, 0.012, 6, 28);
  band.translate(0, 0, 0.05);

  return { hull, wing, band };
}

interface Ship {
  group: THREE.Group;
  engine: THREE.Sprite;
  plane: THREE.Quaternion;
  radius: number;
  speed: number;
  phase: number;
  trail: THREE.Line;
  history: Float32Array;
  filled: number;
}

export interface Fleet {
  /** Added to the Earth's frame (units of Earth radii). */
  orbital: THREE.Group;
  /** Added to the scene (world units): the ship that passes close. */
  near: THREE.Group;
  update(input: {
    time: number;
    sunDir: THREE.Vector3;
    earthRadius: number;
    halfWidth: number;
    moving: boolean;
  }): void;
  dispose(): void;
}

export function createFleet(globe: THREE.Group, options: { ships: number }): Fleet {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(value: T) => (disposables.push(value), value);
  const random = seeded(1957);
  const glow = keep(glowTexture());

  // ── The orbital ring and its habitats, turning with the planet.
  const ringMaterial = keep(
    new THREE.MeshBasicMaterial({ color: 0xd9b26f, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(RING_RADIUS, 0.0016, 6, 384)), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  globe.add(ring);

  const habitatMaterial = keep(
    new THREE.MeshStandardMaterial({ color: 0x8c6a3c, metalness: 0.85, roughness: 0.32, emissive: 0x3b2a12 }),
  );
  const HABITATS = 64;
  const habitats = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.03, 0.007, 0.011)), habitatMaterial, HABITATS);
  const placement = new THREE.Object3D();
  for (let i = 0; i < HABITATS; i++) {
    const a = (i / HABITATS) * Math.PI * 2;
    placement.position.set(Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS);
    placement.rotation.set(0, -a, 0);
    placement.scale.setScalar(i % 4 === 0 ? 1.8 : 1);
    placement.updateMatrix();
    habitats.setMatrixAt(i, placement.matrix);
  }
  globe.add(habitats);

  const tetherMaterial = keep(
    new THREE.LineBasicMaterial({
      color: 0xffd28a,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  for (const lon of TETHERS) {
    const base = surfacePoint(0, lon);
    const geometry = keep(new THREE.BufferGeometry().setFromPoints([base, base.clone().multiplyScalar(RING_RADIUS)]));
    globe.add(new THREE.Line(geometry, tetherMaterial));
  }

  // ── Beacons over the cities: a glow at the foot and a spire of light.
  const spireMaterial = keep(
    new THREE.LineBasicMaterial({
      color: 0xffc46b,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const spirePoints: THREE.Vector3[] = [];
  const beacons = CITIES.map(([, lat, lon]) => {
    const dir = surfacePoint(lat, lon);
    spirePoints.push(dir.clone().multiplyScalar(1.001), dir.clone().multiplyScalar(1.035));
    const light = new THREE.Sprite(
      keep(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xffc77a,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        }),
      ),
    );
    light.position.copy(dir).multiplyScalar(1.004);
    light.scale.setScalar(0.03);
    globe.add(light);
    return { dir, light };
  });
  globe.add(new THREE.LineSegments(keep(new THREE.BufferGeometry().setFromPoints(spirePoints)), spireMaterial));

  // ── Ships.
  const parts = buildShipParts();
  for (const geometry of Object.values(parts)) keep(geometry);
  const hullMaterial = keep(
    new THREE.MeshStandardMaterial({ color: 0x7a5530, metalness: 0.85, roughness: 0.3, emissive: 0x1c1007 }),
  );
  const wingMaterial = keep(
    new THREE.MeshStandardMaterial({ color: 0xd4a256, metalness: 0.9, roughness: 0.22, emissive: 0x2a1a08 }),
  );
  const bandMaterial = keep(new THREE.MeshBasicMaterial({ color: 0x7d8cff }));
  const trailMaterial = keep(
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const makeShip = (engineColor: number) => {
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(parts.hull, hullMaterial),
      new THREE.Mesh(parts.wing, wingMaterial),
      new THREE.Mesh(parts.band, bandMaterial),
    );
    const engine = new THREE.Sprite(
      keep(
        new THREE.SpriteMaterial({
          map: glow,
          color: engineColor,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      ),
    );
    engine.position.set(0, 0, -0.55);
    engine.scale.setScalar(0.55);
    group.add(engine);
    return { group, engine };
  };

  const TRAIL = 56;
  const makeTrail = (color: THREE.Color) => {
    const history = new Float32Array(TRAIL * 3);
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(history, 3));
    const colors = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      const fade = Math.pow(1 - i / (TRAIL - 1), 1.6);
      colors.set([color.r * fade, color.g * fade, color.b * fade], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0);
    const trail = new THREE.Line(geometry, trailMaterial);
    trail.frustumCulled = false;
    return { trail, history };
  };

  const orbital = new THREE.Group();
  const ships: Ship[] = Array.from({ length: options.ships }, (_, index) => {
    const { group, engine } = makeShip(index % 3 === 0 ? 0x9fb4ff : 0xffc27a);
    const plane = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((random() - 0.5) * 1.3, random() * Math.PI * 2, (random() - 0.5) * 0.9),
    );
    const { trail, history } = makeTrail(new THREE.Color(index % 3 === 0 ? 0x7f95ff : 0xffb766));
    orbital.add(group, trail);
    return {
      group,
      engine,
      plane,
      radius: 1.09 + random() * 0.45,
      speed: (0.07 + random() * 0.08) * (random() < 0.2 ? -1 : 1),
      phase: random() * Math.PI * 2,
      trail,
      history,
      filled: 0,
    };
  });

  // The one that passes close: world space, above the horizon.
  const near = new THREE.Group();
  const nearShip = makeShip(0xffd29a);
  const nearTrail = makeTrail(new THREE.Color(0xffc27a));
  near.add(nearShip.group, nearTrail.trail);
  const nearState = { history: nearTrail.history, filled: 0 };
  const NEAR_Z = 12;
  const NEAR_PERIOD = 34;
  const NEAR_FLIGHT = 11;
  /** World length of the close ship: about 70 px at its depth. */
  const NEAR_SIZE = 0.245;

  const local = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const globeRotation = new THREE.Quaternion();

  const pushHistory = (state: { history: Float32Array; filled: number }, line: THREE.Line, point: THREE.Vector3) => {
    state.history.copyWithin(3, 0, (TRAIL - 1) * 3);
    state.history.set([point.x, point.y, point.z], 0);
    state.filled = Math.min(TRAIL, state.filled + 1);
    line.geometry.setDrawRange(0, state.filled);
    line.geometry.attributes.position.needsUpdate = true;
  };

  return {
    orbital,
    near,
    update({ time, sunDir, earthRadius, halfWidth, moving }) {
      const t = moving ? time : 0;

      // Ships are sized against the screen, not the planet.
      const shipScale = (0.022 * 2 * HALF_HEIGHT) / earthRadius;
      for (const ship of ships) {
        const angle = ship.phase + t * ship.speed;
        local.set(Math.cos(angle) * ship.radius, 0, Math.sin(angle) * ship.radius).applyQuaternion(ship.plane);
        ahead
          .set(Math.cos(angle + 0.02 * Math.sign(ship.speed)) * ship.radius, 0, Math.sin(angle + 0.02 * Math.sign(ship.speed)) * ship.radius)
          .applyQuaternion(ship.plane);
        ship.group.position.copy(local);
        ship.group.lookAt(ahead.applyMatrix4(orbital.matrixWorld));
        ship.group.scale.setScalar(shipScale);
        ship.engine.material.opacity = 0.75 + 0.25 * Math.sin(time * 9 + ship.phase);
        if (moving) pushHistory(ship, ship.trail, local);
      }

      // Night reaches a city: its beacon and spire come up.
      globe.getWorldQuaternion(globeRotation);
      let night = 0;
      for (const beacon of beacons) {
        worldNormal.copy(beacon.dir).applyQuaternion(globeRotation);
        const dark = THREE.MathUtils.smoothstep(-worldNormal.dot(sunDir), -0.05, 0.25);
        const pulse = 0.82 + 0.18 * Math.sin(time * 1.4 + beacon.dir.x * 9);
        (beacon.light.material as THREE.SpriteMaterial).opacity = dark * pulse;
        night = Math.max(night, dark);
      }
      spireMaterial.opacity = 0.7 * night;

      // The close pass: once a period, left to right in an easy arc.
      const cycle = t % NEAR_PERIOD;
      const flying = moving && cycle < NEAR_FLIGHT;
      near.visible = flying;
      if (flying) {
        const s = cycle / NEAR_FLIGHT;
        const depthHalfWidth = halfWidth * ((30 - NEAR_Z) / 30);
        const x = THREE.MathUtils.lerp(-depthHalfWidth * 1.3, depthHalfWidth * 1.3, s);
        const y = HALF_HEIGHT * (0.42 + 0.22 * Math.sin(Math.PI * s)) * ((30 - NEAR_Z) / 30);
        local.set(x, y, NEAR_Z);
        ahead.set(x + 0.1, HALF_HEIGHT * (0.42 + 0.22 * Math.sin(Math.PI * (s + 0.01))) * ((30 - NEAR_Z) / 30), NEAR_Z);
        nearShip.group.position.copy(local);
        nearShip.group.lookAt(ahead);
        nearShip.group.scale.setScalar(NEAR_SIZE);
        if (s < 0.02) nearState.filled = 0;
        pushHistory(nearState, nearTrail.trail, local);
      }
    },
    dispose() {
      for (const item of disposables) item.dispose();
      habitats.dispose();
    },
  };
}
