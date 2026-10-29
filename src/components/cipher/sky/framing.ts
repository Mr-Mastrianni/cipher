/**
 * Where the sky's bodies sit on screen, as plain numbers.
 *
 * The Earth is sized and placed by the same rules as the CSS placeholder disc
 * in `cosmic-backdrop.tsx` (diameter as a share of the viewport width, top
 * edge as a share of its height), so the WebGL planet crossfades in exactly
 * over it. Scroll pushes in the way the old CSS scale did — around the centre
 * of the screen — with a slow drift upward.
 */

/** Disc diameter (× viewport width) and top edge (× viewport height). */
export const FRAMING = {
  mobile: { diameter: 1.7, top: 0.54 },
  desktop: { diameter: 1.15, top: 0.52 },
} as const;
export const DESKTOP_MIN_PX = 1024;

/** The page-scroll distance over which the camera finishes pushing in. */
export const PUSH_PX = 2600;
/** The disc grows to this multiple of its size over the push. */
export const PUSH_SCALE = 1.8;
/** The upward drift over the push, as a share of the viewport height. */
export const PUSH_DRIFT = 0.05;

export const CAMERA_Z = 30;
export const FOV = 10;
/** Half the visible height at the Earth's depth, in world units. */
export const HALF_HEIGHT = CAMERA_Z * Math.tan(((FOV / 2) * Math.PI) / 180);

/**
 * How far above the horizon the zodiac wheel arches, as a share of the screen
 * height. A fixed screen distance rather than a multiple of the radius, so the
 * wheel stays in view while the planet grows under it.
 */
export const WHEEL_GAP = 0.3;

export interface Frame {
  /** Earth radius, world units. */
  radius: number;
  /** Earth centre height, world units (the camera looks along −z at y = 0). */
  centreY: number;
  /** Zodiac wheel radius, world units, about the Earth's centre. */
  wheelRadius: number;
  /** Half the visible width at the Earth's depth, world units. */
  halfWidth: number;
}

export function frameFor(width: number, height: number, pushedPx: number): Frame {
  const { diameter, top } = width >= DESKTOP_MIN_PX ? FRAMING.desktop : FRAMING.mobile;
  const aspect = width / height;
  const push = Math.min(1, Math.max(0, pushedPx / PUSH_PX));
  const scale = 1 + (PUSH_SCALE - 1) * push;
  const discShare = diameter * aspect; // diameter as a share of the height
  const centre = top + discShare / 2;
  const centreNow = 0.5 + (centre - 0.5) * scale - PUSH_DRIFT * push;
  const radius = discShare * scale * HALF_HEIGHT;
  return {
    radius,
    centreY: HALF_HEIGHT - 2 * HALF_HEIGHT * centreNow,
    wheelRadius: radius + WHEEL_GAP * 2 * HALF_HEIGHT,
    halfWidth: HALF_HEIGHT * aspect,
  };
}
