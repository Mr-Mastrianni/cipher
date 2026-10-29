import * as THREE from "three";

import { poseCamera, type Pose } from "./layout";

/**
 * The visitor's point of view: floating, free to look around, and carried
 * between bodies on a rising arc rather than cut from one to the next.
 *
 * Drag turns the view about whatever it is looking at, with momentum; wheel
 * or pinch zooms while the whole sky is in view; left alone, the view drifts.
 * A tap that did not move is reported, so the scene can pick what was under
 * it.
 */

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function shortestAngle(from: number, to: number) {
  return from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export interface Rig {
  /** Fly to a pose; `instant` jumps (reduced motion, first frame). */
  goTo(pose: Pose, instant?: boolean): void;
  update(dt: number, camera: THREE.PerspectiveCamera, width: number, height: number): void;
  /** Whether the visitor may zoom now (only with the whole sky in view). */
  setZoomable(zoomable: boolean): void;
  /** The current distance from what the camera looks at. */
  readonly distance: number;
  dispose(): void;
}

export function createRig(
  element: HTMLElement,
  options: { reduced: boolean; onTap: (x: number, y: number) => void; onHover: (x: number, y: number) => void },
): Rig {
  const current: Pose = {
    target: new THREE.Vector3(),
    distance: 30,
    azimuth: 0,
    elevation: 0.5,
    shiftX: 0,
    shiftY: 0,
  };
  let goal: Pose = { ...current, target: current.target.clone() };
  let from: Pose = { ...current, target: current.target.clone() };
  let flight = 1;
  let flightLength = 1;
  let arc = 0;

  // What the visitor has added on top of the goal.
  let lookAzimuth = 0;
  let lookElevation = 0;
  let zoom = 1;
  let spinAzimuth = 0;
  let spinElevation = 0;
  let zoomable = true;
  let lastInput = -Infinity;
  let clock = 0;

  const snapshot = (): Pose => ({
    target: current.target.clone(),
    distance: current.distance * zoom,
    azimuth: current.azimuth + lookAzimuth,
    elevation: current.elevation + lookElevation,
    shiftX: current.shiftX,
    shiftY: current.shiftY,
  });

  // ── Pointer: drag to look, pinch to zoom, tap to choose.
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt = { x: 0, y: 0, t: 0 };
  let moved = 0;
  let pinch = 0;

  const onDown = (event: PointerEvent) => {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      downAt = { x: event.clientX, y: event.clientY, t: performance.now() };
      moved = 0;
      spinAzimuth = spinElevation = 0;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    lastInput = clock;
  };
  const onMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      options.onHover(event.clientX, event.clientY);
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    lastInput = clock;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const span = Math.hypot(a.x - b.x, a.y - b.y);
      if (zoomable && pinch > 0) zoom = THREE.MathUtils.clamp(zoom * (pinch / span), 0.45, 1.5);
      pinch = span;
      return;
    }
    const rate = 0.0055;
    lookAzimuth -= dx * rate;
    lookElevation = THREE.MathUtils.clamp(lookElevation + dy * rate * 0.8, -1.1, 1.1);
    spinAzimuth = -dx * rate * 60;
    spinElevation = dy * rate * 0.8 * 60;
  };
  const onUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0 && moved < 6 && performance.now() - downAt.t < 450) {
      spinAzimuth = spinElevation = 0;
      options.onTap(event.clientX, event.clientY);
    }
  };
  const onWheel = (event: WheelEvent) => {
    if (!zoomable) return;
    event.preventDefault();
    zoom = THREE.MathUtils.clamp(zoom * Math.exp(event.deltaY * 0.0012), 0.45, 1.5);
    lastInput = clock;
  };
  element.addEventListener("pointerdown", onDown);
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onUp);
  element.addEventListener("wheel", onWheel, { passive: false });

  return {
    get distance() {
      return current.distance * zoom;
    },
    setZoomable(value) {
      zoomable = value;
      if (!value) zoom = 1;
    },
    goTo(pose, instant = false) {
      // Fold whatever the visitor had added into the starting point, so the
      // flight leaves from exactly where they were looking.
      from = snapshot();
      lookAzimuth = lookElevation = 0;
      zoom = 1;
      Object.assign(current, from, { target: from.target.clone() });
      goal = { ...pose, target: pose.target.clone() };
      goal.azimuth = shortestAngle(from.azimuth, goal.azimuth);
      const travel = from.target.distanceTo(goal.target);
      flightLength = THREE.MathUtils.clamp(1.4 + travel / 9, 1.4, 3.2);
      // A long trip rises before it descends.
      arc = travel > 2 ? Math.min(0.9, travel / 14) : 0;
      flight = instant || options.reduced ? 1 : 0;
      if (flight === 1) Object.assign(current, goal, { target: goal.target.clone() });
    },
    update(dt, camera, width, height) {
      clock += dt;
      if (flight < 1) {
        flight = Math.min(1, flight + dt / flightLength);
        const e = easeInOut(flight);
        current.target.lerpVectors(from.target, goal.target, e);
        // Distance in log space: a dive feels even all the way down.
        current.distance = Math.exp(THREE.MathUtils.lerp(Math.log(from.distance), Math.log(goal.distance), e));
        current.distance *= 1 + arc * Math.sin(Math.PI * e);
        current.azimuth = THREE.MathUtils.lerp(from.azimuth, goal.azimuth, e);
        current.elevation = THREE.MathUtils.lerp(from.elevation, goal.elevation, e) + arc * 0.35 * Math.sin(Math.PI * e);
        current.shiftX = THREE.MathUtils.lerp(from.shiftX, goal.shiftX, e);
        current.shiftY = THREE.MathUtils.lerp(from.shiftY, goal.shiftY, e);
      }

      // Momentum after a drag, then a slow drift once left alone.
      if (pointers.size === 0 && !options.reduced) {
        lookAzimuth += spinAzimuth * dt;
        lookElevation = THREE.MathUtils.clamp(lookElevation + spinElevation * dt, -1.1, 1.1);
        const decay = Math.exp(-dt * 2.6);
        spinAzimuth *= decay;
        spinElevation *= decay;
        if (clock - lastInput > 4 && flight === 1) lookAzimuth += dt * 0.012;
      }

      const shown: Pose = {
        target: current.target,
        distance: current.distance * zoom,
        azimuth: current.azimuth + lookAzimuth,
        elevation: THREE.MathUtils.clamp(current.elevation + lookElevation, -1.35, 1.45),
        shiftX: current.shiftX,
        shiftY: current.shiftY,
      };
      camera.aspect = width / height;
      camera.setViewOffset(width, height, -shown.shiftX * width, shown.shiftY * height, width, height);
      camera.updateProjectionMatrix();
      poseCamera(shown, camera);
    },
    dispose() {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.removeEventListener("wheel", onWheel);
    },
  };
}
