/** Angle helpers shared by the astronomy, KP and Human Design code. */

/** Normalise an angle into [0, 360). */
export function normalize(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Signed separation `b − a`, in (−180, 180]. */
export function separation(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}
