import * as THREE from "three";

import { createEarth, earthTexturePaths } from "./earth";
import { createFleet } from "./fleet";
import { CAMERA_Z, FOV, frameFor } from "./framing";
import { createPlanets, PLANET_MAPS, type Transit } from "./planets";

/**
 * The landing's sky, in plain three.js: the Earth, the zodiac wheel with the
 * nine grahas in today's transits, and the civilisation in orbit.
 *
 * Framework-free on purpose: the React wrapper only mounts it, and the same
 * module can be rendered on its own to check what it draws.
 *
 * The page's scroll drives two things. Its first screens push the camera in on
 * the planet; its whole length turns the sky once, bringing each graha
 * overhead in turn, and the light on the Earth follows the Sun round.
 */

/** Degrees the surface turns per pixel scrolled: travel, not a spin. */
const SPIN_PER_PX = 0.006;

export interface SkyOptions {
  transits: readonly Transit[];
  reduced: boolean;
  /** Read once per frame: pixels scrolled and progress through the page. */
  readScroll: () => { px: number; progress: number };
  onReady: () => void;
  /** The GPU refused a shader or dropped the context: hand back. */
  onLost: () => void;
}

export interface Sky {
  dispose(): void;
}

export function createSky(canvas: HTMLCanvasElement, labelLayer: HTMLElement | null, options: SkyOptions): Sky {
  const { transits, reduced, readScroll, onReady, onLost } = options;

  // Phones and small screens get 2k Earth maps; the surface is never larger
  // than the screen there, and the download is a third of the size.
  const large = window.innerWidth * Math.min(window.devicePixelRatio, 2) >= 1600;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, large ? 1.75 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.debug.onShaderError = (context, program) => {
    console.warn("Sky shader failed; using the dotted globe.", context.getProgramInfoLog(program));
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onLost, { once: true });

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 200);
  camera.position.set(0, 0, CAMERA_Z);
  const scene = new THREE.Scene();
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.6);
  scene.add(sunLight, new THREE.AmbientLight(0x3a4466, 0.35));

  let width = 1;
  let height = 1;
  const resize = () => {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let disposed = false;
  let teardown = () => {};

  const loader = new THREE.TextureLoader();
  const earthPaths = earthTexturePaths(large);
  Promise.all([
    Promise.all(Object.values(earthPaths).map((path) => loader.loadAsync(path))),
    Promise.all(PLANET_MAPS.map((path) => loader.loadAsync(path))),
  ])
    .then(([earthMaps, planetMaps]) => {
      if (disposed) {
        for (const texture of [...earthMaps, ...planetMaps]) texture.dispose();
        return;
      }
      const [day, night, clouds, specular, normal] = earthMaps;
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const earth = createEarth({ day, night, clouds, specular, normal }, anisotropy);

      const maps = new Map<string, THREE.Texture>();
      PLANET_MAPS.forEach((path, index) => {
        const texture = planetMaps[index];
        if (!path.endsWith(".png")) texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = anisotropy;
        maps.set(path, texture);
      });
      const planets = createPlanets(transits, maps, labelLayer);
      const fleet = createFleet(earth.globe, { ships: large ? 9 : 5 });
      earth.frame.add(fleet.orbital);
      scene.add(earth.frame, planets.group, fleet.near);

      const sunDir = new THREE.Vector3();
      const clock = new THREE.Timer();
      let time = 0;
      let idle = 0;
      let readied = false;

      renderer.setAnimationLoop((timestamp) => {
        clock.update(timestamp);
        const dt = Math.min(clock.getDelta(), 0.1);
        if (!reduced) {
          time += dt;
          idle += dt * 0.006;
        }
        const scroll = reduced ? { px: 0, progress: 0 } : readScroll();

        const frame = frameFor(width, height, scroll.px);
        earth.frame.position.set(0, frame.centreY, 0);
        earth.frame.scale.setScalar(frame.radius);

        planets.update(frame, planets.turnAt(scroll.progress), time, dt);
        // The light on the Earth comes from where the Sun stands on the
        // wheel, a touch from behind so the limb catches it.
        sunDir.subVectors(planets.sun, earth.frame.position).setZ(0).normalize();
        sunDir.z = -0.1;
        sunDir.normalize();
        sunLight.position.copy(sunDir).multiplyScalar(50);

        earth.update(sunDir, idle + THREE.MathUtils.degToRad(scroll.px * SPIN_PER_PX), time * 0.0035);
        fleet.update({
          time,
          sunDir,
          earthRadius: frame.radius,
          halfWidth: frame.halfWidth,
          moving: !reduced,
        });

        renderer.render(scene, camera);
        planets.place(camera, width, height);

        if (!readied) {
          readied = true;
          onReady();
        }
      });

      teardown = () => {
        earth.dispose();
        planets.dispose();
        fleet.dispose();
        for (const texture of maps.values()) texture.dispose();
      };
    })
    .catch(() => {
      if (!disposed) onLost();
    });

  return {
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      teardown();
      renderer.dispose();
    },
  };
}
