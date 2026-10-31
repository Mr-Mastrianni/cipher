import * as THREE from "three";

import { createBodies, PLANET_MAPS, type Caption, type Transit } from "./bodies";
import { createRig } from "./camera";
import { createEarth, earthTexturePaths } from "./earth";
import { createFleet } from "./fleet";
import { eclipticPoint, focusPose, FOV, ORBIT, overviewPose, type BodyId } from "./layout";
import { createStars } from "./stars";

/**
 * The space the marketing site floats in, in plain three.js: the Earth at the
 * centre with its civilisation, the nine grahas on their spheres at today's
 * transits, the zodiac around them, and the stars.
 *
 * Framework-free on purpose: the React shell only mounts it and tells it where
 * to look, and the same module can be rendered on its own to check it.
 */

/** At the overview, bodies are drawn larger so a phone still shows them. */
const OVERVIEW_DISTANCE = 34;
const MAX_BOOST = 1.6;

export interface SkyOptions {
  transits: readonly Transit[];
  reduced: boolean;
  /** The line under each body's name: a destination, or today's place. */
  caption: Caption;
  onReady: () => void;
  /** The GPU refused a shader or dropped the context: hand back. */
  onLost: () => void;
  /** A body was tapped. */
  onSelect: (id: BodyId) => void;
}

export interface Sky {
  /** Look at one body, or at the whole sky (`null`). */
  focus(id: BodyId | null): void;
  dispose(): void;
}

export function createSky(canvas: HTMLCanvasElement, labelLayer: HTMLElement | null, options: SkyOptions): Sky {
  const { transits, reduced, caption, onReady, onLost, onSelect } = options;

  // Phones and small screens get 2k Earth maps; the download is a third.
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
    console.warn("Sky shader failed; using the plain sky.", context.getProgramInfoLog(program));
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onLost, { once: true });

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 600);
  const scene = new THREE.Scene();
  const stars = createStars(window.innerWidth < 700 ? 2400 : 4200);
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.6);
  scene.add(stars.points, sunLight, new THREE.AmbientLight(0x3a4466, 0.35));

  const sunLongitude = transits.find((transit) => transit.graha === "sun")?.longitude ?? 0;
  const sunPosition = eclipticPoint(sunLongitude, ORBIT.sun);
  const sunDir = sunPosition.clone().normalize();
  sunLight.position.copy(sunPosition);

  let width = 1;
  let height = 1;
  let focusId: BodyId | null = null;
  let hoverId: BodyId | null = null;
  let positionOf: (id: BodyId) => THREE.Vector3 = () => new THREE.Vector3();
  let pickTargets: THREE.Object3D[] = [];

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (x: number, y: number): BodyId | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickTargets, false)[0];
    return hit ? (hit.object.name as BodyId) : null;
  };

  const rig = createRig(canvas, {
    reduced,
    onTap: (x, y) => {
      const id = pick(x, y);
      if (id) onSelect(id);
    },
    onHover: (x, y) => {
      hoverId = pick(x, y);
      canvas.style.cursor = hoverId ? "pointer" : "grab";
    },
  });

  const poseFor = (id: BodyId | null) =>
    id === null
      ? overviewPose(width / height, sunLongitude)
      : focusPose(id, positionOf(id), sunPosition, width / height);

  const resize = () => {
    const aspectBefore = width / height;
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    // Turning a phone changes the framing; re-frame without a flight.
    if (Math.sign(aspectBefore - 1) !== Math.sign(width / height - 1)) rig.goTo(poseFor(focusId), true);
  };
  resize();
  rig.goTo(poseFor(null), true);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let disposed = false;
  let built = false;
  let teardown = () => {};

  // The Earth's own name, under it.
  const earthLabel = document.createElement("button");
  earthLabel.type = "button";
  earthLabel.tabIndex = -1;
  earthLabel.className =
    "pointer-events-none absolute left-0 top-0 cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-center opacity-0 transition-opacity duration-500 will-change-transform focus:outline-none";
  earthLabel.innerHTML = `<span class="block font-display text-[15px] leading-tight text-bone">Earth</span><span class="block font-display text-[13px] italic leading-tight text-gold">${caption("earth", "")}</span>`;
  earthLabel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect("earth");
  });
  labelLayer?.appendChild(earthLabel);

  const loader = new THREE.TextureLoader();
  Promise.all([
    Promise.all(Object.values(earthTexturePaths(large)).map((path) => loader.loadAsync(path))),
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
      const bodies = createBodies(transits, maps, labelLayer, caption, onSelect);
      const fleet = createFleet(earth.globe, { ships: large ? 9 : 6 });
      earth.frame.add(fleet.orbital);

      const earthTarget = new THREE.Mesh(
        new THREE.SphereGeometry(1.35, 12, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      earthTarget.name = "earth";
      earth.frame.add(earthTarget);
      pickTargets = [...bodies.targets, earthTarget];
      positionOf = (id) => (id === "earth" ? new THREE.Vector3() : bodies.position(id));

      scene.add(earth.frame, bodies.group, fleet.near);
      built = true;
      rig.goTo(poseFor(focusId), true);

      const clock = new THREE.Timer();
      const projected = new THREE.Vector3();
      const edge = new THREE.Vector3();
      let time = 0;
      let readied = false;

      renderer.setAnimationLoop((timestamp) => {
        clock.update(timestamp);
        const dt = Math.min(clock.getDelta(), 0.1);
        if (!reduced) time += dt;

        rig.update(dt, camera, width, height);
        const boost = THREE.MathUtils.clamp(rig.distance / OVERVIEW_DISTANCE, 1, MAX_BOOST);
        earth.frame.scale.setScalar(boost);
        bodies.update(time, dt, boost);
        earth.update(sunDir, time * 0.01, time * 0.0035);
        fleet.update({ time, sunDir, earthRadius: boost, moving: !reduced });
        stars.follow(camera);

        renderer.render(scene, camera);
        bodies.place(camera, width, height, focusId, hoverId);

        // The Earth's label sits under the planet, unless we are there.
        projected.copy(earth.frame.position).project(camera);
        edge.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(-boost * 1.12);
        edge.project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-edge.y * 0.5 + 0.5) * height;
        const hidden = focusId === "earth" || projected.z > 1;
        earthLabel.style.opacity = hidden ? "0" : hoverId && hoverId !== "earth" ? "0.55" : "1";
        earthLabel.style.pointerEvents = hidden ? "none" : "auto";
        earthLabel.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y + 4)}px, 0) translateX(-50%)`;

        if (!readied) {
          readied = true;
          onReady();
        }
      });

      teardown = () => {
        earth.dispose();
        bodies.dispose();
        fleet.dispose();
        earthTarget.geometry.dispose();
        (earthTarget.material as THREE.Material).dispose();
        for (const texture of maps.values()) texture.dispose();
      };
    })
    .catch(() => {
      if (!disposed) onLost();
    });

  return {
    focus(id) {
      if (id === focusId && built) return;
      focusId = id;
      rig.setZoomable(id === null);
      if (built) rig.goTo(poseFor(id));
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      rig.dispose();
      canvas.removeEventListener("webglcontextlost", onLost);
      teardown();
      stars.dispose();
      earthLabel.remove();
      renderer.dispose();
    },
  };
}
