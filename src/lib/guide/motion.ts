/**
 * Where the guide goes, and how she gets there.
 *
 * Pure geometry and a spring, kept apart from React and three.js so the
 * rules can be tested: she docks in a corner, flies to stand beside whatever
 * she is explaining without covering it, and never leaves the screen or
 * hides behind the header.
 *
 * All coordinates are CSS pixels in the viewport; a box is positioned by its
 * top-left corner.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Viewport {
  w: number;
  h: number;
  /** The space the sticky header takes from the top. */
  top: number;
  /** Breathing room kept to every edge. */
  margin: number;
}

export type Side = "left" | "right" | "below" | "above" | "over";

export interface Placement {
  x: number;
  y: number;
  side: Side;
}

/** The size of the guide's box for a viewport: smaller on a phone. */
export function boxFor(viewportWidth: number): Size {
  return viewportWidth < 640 ? { w: 124, h: 132 } : { w: 176, h: 184 };
}

export function viewportFor(width: number, height: number): Viewport {
  return { w: width, h: height, top: 72, margin: 12 };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Keep a box wholly on screen and below the header. */
export function clampBox(x: number, y: number, box: Size, view: Viewport): { x: number; y: number } {
  return {
    x: clamp(x, view.margin, view.w - view.margin - box.w),
    y: clamp(y, view.top, view.h - view.margin - box.h),
  };
}

/** Her resting place: the bottom-right corner. */
export function dock(box: Size, view: Viewport): { x: number; y: number } {
  return { x: view.w - view.margin - box.w, y: view.h - view.margin - box.h };
}

const inside = (x: number, y: number, box: Size, view: Viewport) =>
  x >= view.margin && y >= view.top && x + box.w <= view.w - view.margin && y + box.h <= view.h - view.margin;

/**
 * Stand beside a target rather than on it: to its right, its left, under it,
 * or over it, whichever fits first. If none fits (a target filling the
 * screen), stand as near as the screen allows.
 */
export function placeBeside(target: Rect, box: Size, view: Viewport, gap = 12): Placement {
  const midY = (target.top + target.bottom) / 2 - box.h / 2;
  const midX = (target.left + target.right) / 2 - box.w / 2;
  const candidates: Placement[] = [
    { x: target.right + gap, y: midY, side: "right" },
    { x: target.left - gap - box.w, y: midY, side: "left" },
    { x: midX, y: target.bottom + gap, side: "below" },
    { x: midX, y: target.top - gap - box.h, side: "above" },
  ];
  const fit = candidates.find((candidate) => inside(candidate.x, candidate.y, box, view));
  if (fit) return fit;
  const first = candidates[0];
  const clamped = clampBox(first.x, first.y, box, view);
  return { ...clamped, side: "over" };
}

/**
 * Which way she turns to face what she stands beside, in [-1, 1]: positive
 * turns her toward the right of the screen. Standing to the left of a target,
 * she faces right.
 */
export function facing(side: Side): number {
  return side === "left" ? 1 : side === "right" ? -1 : 0;
}

/**
 * The part of the screen the home page's Earth occupies, for a target that is
 * drawn in the scene rather than in the page: the window above the headline on
 * a phone, the right-hand side on a wide screen.
 */
export function earthWindow(view: Viewport): Rect {
  if (view.w < 1024) {
    const centre = view.w / 2;
    return { left: centre - 80, right: centre + 80, top: view.h * 0.2, bottom: view.h * 0.34 };
  }
  const centre = view.w * 0.7;
  return { left: centre - 120, right: centre + 120, top: view.h * 0.3, bottom: view.h * 0.6 };
}

/**
 * One step of a critically damped spring: she eases into place without
 * overshooting, from any distance, at any frame rate.
 */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  omega = 6.5,
): [number, number] {
  const offset = position - target;
  const decay = Math.exp(-omega * dt);
  const carry = velocity + omega * offset;
  return [target + (offset + carry * dt) * decay, (velocity - omega * carry * dt) * decay];
}

/** Whether a rect has any size on screen at all (a hidden element has none). */
export function isVisible(rect: Rect, view: Viewport): boolean {
  // The header's own links count: they sit above `view.top`, and she stands under them.
  return rect.right - rect.left > 0 && rect.bottom - rect.top > 0 && rect.bottom > 0 && rect.top < view.h;
}

/**
 * How far to scroll so a target sits comfortably in the upper part of the
 * screen, clear of the speech bubble below. Zero when it is already there.
 */
export function scrollToShow(rect: Rect, view: Viewport): number {
  const upper = view.h * 0.55;
  if (rect.top >= view.top && rect.bottom <= upper) return 0;
  return rect.top - view.h * 0.26;
}
