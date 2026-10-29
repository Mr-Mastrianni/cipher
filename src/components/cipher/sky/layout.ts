import * as THREE from "three";

/**
 * Where everything stands in the space, and where the camera goes to see it.
 *
 * The sky is geocentric, as a chart is: the Earth at the centre, and each
 * graha on its own sphere in the Chaldean order — Moon, Mercury, Venus, Sun,
 * Mars, Jupiter, Saturn — at its real sidereal longitude on the ecliptic. The
 * zodiac's twelve rasis ring the whole of it. Rahu and Ketu sit on the Moon's
 * orbit, which is where the lunar nodes are: that orbit is tipped five degrees
 * to the ecliptic and crosses it exactly at them.
 *
 * Units are Earth radii. Sizes are cinematic, not to scale.
 */

export type BodyId =
  | "earth"
  | "sun"
  | "moon"
  | "mars"
  | "mercury"
  | "jupiter"
  | "venus"
  | "saturn"
  | "rahu"
  | "ketu";

export const ORBIT: Record<Exclude<BodyId, "earth">, number> = {
  moon: 3.2,
  rahu: 3.2,
  ketu: 3.2,
  mercury: 4.6,
  venus: 6.0,
  sun: 7.6,
  mars: 9.2,
  jupiter: 11.0,
  saturn: 12.8,
};
export const ZODIAC_RADIUS = 14.6;
/** The Moon's orbit is inclined to the ecliptic by this much. */
export const LUNAR_INCLINATION = THREE.MathUtils.degToRad(5.14);

export const RADIUS: Record<BodyId, number> = {
  earth: 1,
  sun: 1.0,
  jupiter: 0.75,
  saturn: 0.6,
  venus: 0.42,
  moon: 0.36,
  mars: 0.34,
  mercury: 0.26,
  rahu: 0.3,
  ketu: 0.26,
};

/** A point on the ecliptic: longitude runs counter-clockwise seen from above. */
export function eclipticPoint(longitude: number, radius: number, target = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(longitude);
  return target.set(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
}

export const FOV = 45;
const HALF_TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** A camera pose: what it looks at, from how far, from which side. */
export interface Pose {
  target: THREE.Vector3;
  distance: number;
  /** Radians about +y, measured like longitude. */
  azimuth: number;
  /** Radians above the ecliptic. */
  elevation: number;
  /** Where the target sits on screen, as a share of width and height from centre. */
  shiftX: number;
  shiftY: number;
}

export function poseCamera(pose: Pose, camera: THREE.PerspectiveCamera) {
  const { target, distance, azimuth, elevation } = pose;
  camera.position.set(
    target.x + Math.cos(elevation) * Math.cos(azimuth) * distance,
    target.y + Math.sin(elevation) * distance,
    target.z - Math.cos(elevation) * Math.sin(azimuth) * distance,
  );
  camera.lookAt(target);
}

/**
 * Pulled back just far enough that every graha's sphere is on screen at once,
 * in the part of the screen the page leaves free: above the text on a phone,
 * above and beside it on a wide screen. A phone looks down more steeply, so
 * the rings read as rings in a narrow frame.
 *
 * Fitted by projection, not estimated: the near side of an orbit is much
 * closer to the camera than its centre, and perspective spreads it wide.
 */
export function overviewPose(aspect: number, sunLongitude: number): Pose {
  const portrait = aspect < 1;
  const pose: Pose = {
    target: new THREE.Vector3(0, 0, 0),
    distance: 10,
    // From behind the Earth's evening side: the Sun off to one flank, the
    // planet half lit, its cities on.
    azimuth: THREE.MathUtils.degToRad(sunLongitude + 140),
    elevation: THREE.MathUtils.degToRad(portrait ? 58 : 30),
    shiftX: portrait ? 0 : 0.1,
    shiftY: portrait ? 0.25 : 0.16,
  };
  // The free box, in normalised device coordinates.
  const box = portrait
    ? { left: -0.95, right: 0.95, bottom: 0.14, top: 0.84 }
    : { left: -0.75, right: 0.96, bottom: -0.42, top: 0.86 };

  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.02, 600);
  const width = 1000 * aspect;
  const height = 1000;
  camera.setViewOffset(width, height, -pose.shiftX * width, pose.shiftY * height, width, height);
  camera.updateProjectionMatrix();
  const edge = ORBIT.saturn + RADIUS.saturn * 2.4;
  const ring = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * edge, 0, Math.sin(a) * edge);
  });
  const point = new THREE.Vector3();
  const fits = () => {
    poseCamera(pose, camera);
    camera.updateMatrixWorld();
    return ring.every((p) => {
      point.copy(p).project(camera);
      return point.x >= box.left && point.x <= box.right && point.y >= box.bottom && point.y <= box.top;
    });
  };
  pose.distance = (edge * 0.6) / HALF_TAN;
  for (let i = 0; i < 60 && !fits(); i++) pose.distance *= 1.04;
  return pose;
}

/**
 * Close on one body, from the side the Sun lights, with room left for the
 * page: the body sits to the right on a wide screen and high on a phone.
 */
export function focusPose(
  body: BodyId,
  position: THREE.Vector3,
  sun: THREE.Vector3,
  aspect: number,
): Pose {
  const portrait = aspect < 1;
  const radius = RADIUS[body];
  // Toward the light, turned a little so the terminator shows.
  const toSun = body === "sun" ? position.clone().normalize() : sun.clone().sub(position).normalize();
  const azimuth = Math.atan2(-toSun.z, toSun.x) + (body === "sun" ? 0 : THREE.MathUtils.degToRad(38));
  return {
    target: position.clone(),
    distance: radius * (portrait ? 9 : 5.6) + (body === "earth" ? 0.9 : 0),
    azimuth,
    elevation: THREE.MathUtils.degToRad(body === "earth" ? 18 : 12),
    shiftX: portrait ? 0 : 0.24,
    shiftY: portrait ? 0.28 : 0,
  };
}
