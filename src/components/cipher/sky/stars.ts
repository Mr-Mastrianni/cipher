import * as THREE from "three";

/**
 * The stars, far behind everything: a sphere of points that the camera turns
 * inside, so looking around reads as looking around. Most are scattered; a
 * third crowd toward one great circle, a faint Milky Way across the sky.
 * Seeded, so every visitor sees the same heavens.
 */

const STAR_RADIUS = 160;

export function createStars(count: number, light = false) {
  let seed = 4242;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gaussian = () => {
    const u = Math.max(random(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };

  const galaxy = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.05, 0.4, 0.2));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const direction = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const banded = i % 3 === 0;
    if (banded) {
      const angle = random() * Math.PI * 2;
      direction.set(Math.cos(angle), gaussian() * 0.09, Math.sin(angle)).normalize().applyQuaternion(galaxy);
    } else {
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      direction.set(Math.cos(angle) * r, z, Math.sin(angle) * r);
    }
    direction.multiplyScalar(STAR_RADIUS).toArray(positions, i * 3);

    // Mostly white, some warm, some blue; a few bright, most faint. In
    // daylight the same stars are ink dust on paper: cool, low, never white.
    const warmth = random();
    if (light) {
      tint.setRGB(0.34 + warmth * 0.05, 0.37 + warmth * 0.04, 0.45);
    } else {
      tint.setRGB(1, 0.94 + warmth * 0.06, 0.86 + (1 - warmth) * 0.14);
      if (warmth < 0.18) tint.setRGB(0.78, 0.86, 1);
    }
    const brightness = Math.pow(random(), 2.6) * (light ? 0.72 : 0.85) + (banded ? 0.1 : 0.14) * (light ? 0.6 : 1);
    tint.multiplyScalar(brightness).toArray(colors, i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: light ? 1.2 : 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: light ? 0.85 : 1,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    /** Keep the sphere centred on the camera: the stars are at infinity. */
    follow(camera: THREE.Camera) {
      points.position.copy(camera.position);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
