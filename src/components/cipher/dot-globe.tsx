"use client";

import { useEffect, useRef } from "react";
import { landDots } from "@/lib/geo/land-dots";
import { cn } from "@/lib/utils";

/**
 * The entry globe.
 *
 * A dot-matrix Earth that spins under a thumb: drag to rotate, pinch or wheel
 * to zoom, tap a pin to choose a place. It is drawn on a 2D canvas through an
 * orthographic projection — no WebGL, no three.js, no extra dependency — so it
 * costs no GPU context, survives weak phones and old Safari, and cannot collide
 * with the 3D world's renderer.
 *
 * Deliberate choices:
 *
 * - Land is ~6,000 points sampled on a Fibonacci sphere and tested against
 *   Natural Earth land once, offline (`pnpm geo:dots`). The component decodes a
 *   packed buffer and does pure arithmetic per frame.
 * - Depth is expressed as alpha, not as size or colour: the front of the sphere
 *   is bright, the limb fades out. That fade is what stops the moiré on dense
 *   coastlines.
 * - Colour comes from the same CSS variables as everything else, read once per
 *   theme, so Noir and Ivory both work without a second code path.
 * - The canvas is `aria-hidden`. The accessible control is the list of places
 *   the parent renders beside it; a canvas is not a form control, and pretending
 *   otherwise is worse than exposing the real buttons.
 * - Offscreen, and in a hidden tab, the loop stops. Idle drift is suppressed
 *   under `prefers-reduced-motion`.
 */

export interface GlobePlace {
  id: string;
  /** Display name on the globe and in the list. */
  name: string;
  /** A quiet second line for the list, e.g. "the KP meridian". */
  note: string;
  /** What the place should write into a city field. */
  city: string;
  /** IANA zone for the place, so the intake need not geocode it again. */
  timeZone: string;
  lat: number;
  lon: number;
}

interface DotGlobeProps {
  places: readonly GlobePlace[];
  activeId?: string | null;
  onSelect: (place: GlobePlace) => void;
  /** Where the globe rests when nothing is selected. */
  initialLon?: number;
  initialLat?: number;
  /**
   * `globe` is the instrument: pins, labels, zoom, a slow drift.
   * `horizon` is the same planet used as landscape — no pins, no labels, no
   * zoom, a slower drift, and a warm rim. It is still draggable: you can take
   * the world by the edge and turn it.
   */
  variant?: "globe" | "horizon";
  className?: string;
}

const RAD = Math.PI / 180;
const MIN_ZOOM = 0.86;
const MAX_ZOOM = 1.85;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Shortest signed difference between two longitudes, in degrees. */
const shortestAngle = (from: number, to: number) => {
  let delta = ((to - from) % 360 + 540) % 360 - 180;
  if (delta < -180) delta += 360;
  return delta;
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function readColor(value: string, fallback: Rgb): Rgb {
  const hex = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  const long = /^#([0-9a-f]{6})$/i.exec(hex);
  if (long) {
    const int = parseInt(long[1], 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }
  return fallback;
}

export function DotGlobe({
  places,
  activeId = null,
  onSelect,
  initialLon = 24,
  initialLat = 18,
  variant = "globe",
  className,
}: DotGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Everything the frame loop touches lives in a ref: the globe redraws at
  // 60fps and must never re-render React.
  const motion = useRef({
    lon: initialLon,
    lat: initialLat,
    targetLon: initialLon,
    targetLat: initialLat,
    zoom: 1,
    targetZoom: 1,
    dragging: false,
    moved: 0,
    lastX: 0,
    lastY: 0,
    idle: 0,
    activeId: activeId as string | null,
  });

  // The frame loop is bound once, so it reads the latest callback and place
  // list through refs rather than through a stale closure.
  const selectRef = useRef(onSelect);
  const placesRef = useRef(places);
  useEffect(() => {
    selectRef.current = onSelect;
    placesRef.current = places;
  }, [onSelect, places]);

  // Keep the latest active place reachable from the frame loop.
  useEffect(() => {
    motion.current.activeId = activeId;
  }, [activeId]);

  // Rotate to the selected place, choosing the short way round.
  useEffect(() => {
    if (!activeId) return;
    const place = places.find((candidate) => candidate.id === activeId);
    if (!place) return;
    const state = motion.current;
    state.targetLon = state.lon + shortestAngle(state.lon, place.lon);
    state.targetLat = clamp(place.lat, -58, 58);
    state.idle = 0;
  }, [activeId, places]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const horizon = variant === "horizon";

    const dots = landDots();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let radius = 1;
    let cx = 0;
    let cy = 0;
    let dpr = 1;

    let colors = {
      ink: { r: 236, g: 230, b: 218 },
      brass: { r: 191, g: 162, b: 115 },
      line: { r: 38, g: 38, b: 44 },
    };
    // Bound after the first read so the draw functions always see the palette
    // for the current theme, not the one captured at mount.
    let ink = colors.ink;
    let brass = colors.brass;

    /** Screen positions of the pins from the last frame, for tap hit-testing. */
    let hits: { id: string; x: number; y: number }[] = [];

    const readColors = () => {
      const styles = getComputedStyle(document.documentElement);
      colors = {
        ink: readColor(styles.getPropertyValue("--c-bone"), colors.ink),
        brass: readColor(styles.getPropertyValue("--c-gold"), colors.brass),
        line: readColor(styles.getPropertyValue("--c-line"), colors.line),
      };
      ink = colors.ink;
      brass = colors.brass;
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      // CSS pixels; the canvas backing store is scaled by the device ratio.
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // The globe sits in the middle, with room for the outer ring and labels.
      radius = Math.min(width, height) * 0.475;
      cx = width / 2;
      cy = height / 2;
    };

    const project = (lon: number, lat: number) => {
      const state = motion.current;
      const phi = lat * RAD;
      const lambda = (lon - state.lon) * RAD;
      const phi0 = state.lat * RAD;
      const cosc =
        Math.sin(phi0) * Math.sin(phi) +
        Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda);
      if (cosc <= 0.002) return null;
      const r = radius * state.zoom;
      return {
        x: cx + r * Math.cos(phi) * Math.sin(lambda),
        y:
          cy -
          r *
            (Math.cos(phi0) * Math.sin(phi) -
              Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda)),
        depth: cosc,
      };
    };

    const drawSphere = (r: number) => {
      const surface = ctx.createRadialGradient(
        cx - r * 0.3,
        cy - r * 0.35,
        r * 0.1,
        cx,
        cy,
        r,
      );
      surface.addColorStop(0, `rgba(${ink.r},${ink.g},${ink.b},0.030)`);
      surface.addColorStop(0.6, `rgba(${ink.r},${ink.g},${ink.b},0.008)`);
      surface.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = surface;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      if (horizon) {
        // The limb is the whole picture: one bright line and a warm bloom.
        ctx.save();
        ctx.shadowColor = `rgba(${brass.r},${brass.g},${brass.b},0.55)`;
        ctx.shadowBlur = Math.max(18, r * 0.06);
        ctx.strokeStyle = `rgba(${brass.r},${brass.g},${brass.b},0.95)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = `rgba(${ink.r},${ink.g},${ink.b},0.14)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(${ink.r},${ink.g},${ink.b},0.05)`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.075, 0, Math.PI * 2);
      ctx.stroke();

      // A whisper of limb shading: dimension without a glow.
      const limb = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
      limb.addColorStop(0, "rgba(0,0,0,0)");
      limb.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = limb;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    };

    const drawGraticule = () => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${ink.r},${ink.g},${ink.b},${horizon ? 0.035 : 0.052})`;
      for (let lat = -75; lat <= 75; lat += 15) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const point = project(lon, lat);
          if (!point) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
          started = true;
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 15) {
        ctx.beginPath();
        let started = false;
        for (let lat = -88; lat <= 88; lat += 4) {
          const point = project(lon, lat);
          if (!point) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
          started = true;
        }
        ctx.stroke();
      }
    };

    const drawLand = () => {
      const state = motion.current;
      const size = radius / 165;
      const dot = Math.max(0.55, size * state.zoom);
      for (let i = 0; i < dots.length; i += 2) {
        const point = project(dots[i], dots[i + 1]);
        if (!point) continue;
        // Fade the limb rather than letting dots pile up on the edge.
        const edge = clamp((point.depth - 0.03) / 0.22, 0, 1);
        const alpha = (0.07 + 0.5 * Math.pow(point.depth, 1.8)) * edge;
        if (alpha < 0.02) continue;
        ctx.fillStyle = `rgba(${ink.r},${ink.g},${ink.b},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, dot * (0.66 + 0.44 * point.depth), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawPins = (now: number) => {
      const next: typeof hits = [];
      if (horizon) {
        hits = next;
        return;
      }
      ctx.textAlign = "left";
      const spacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
      if ("letterSpacing" in ctx) spacing.letterSpacing = "1.6px";

      for (const place of placesRef.current) {
        const point = project(place.lon, place.lat);
        if (!point || point.depth < 0.12) continue;

        const active = place.id === motion.current.activeId;
        const alpha = 0.45 + 0.55 * point.depth;
        next.push({ id: place.id, x: point.x, y: point.y });

        if (active) {
          const phase = (now % 2600) / 2600;
          for (const ring of [0, 1]) {
            const pulse = 7 + phase * 26 + ring * 9;
            ctx.strokeStyle = `rgba(${brass.r},${brass.g},${brass.b},${(0.22 * (1 - phase) * (1 - ring * 0.4)).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(point.x, point.y, pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.strokeStyle = `rgba(${brass.r},${brass.g},${brass.b},${(alpha * (active ? 0.95 : 0.55)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, active ? 6.5 : 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(${brass.r},${brass.g},${brass.b},${(alpha * (active ? 1 : 0.85)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, active ? 2.4 : 1.9, 0, Math.PI * 2);
        ctx.fill();

        // No label on a pin that is edge-on: it would sit on the limb.
        if (point.depth < 0.42) continue;

        ctx.font = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace";
        const label = place.name.toUpperCase();

        // Labels near the rim always point inward; labels near the middle
        // point outward. That rule cannot clip, whatever the canvas width.
        const rim = radius * motion.current.zoom * 0.52;
        const side: 1 | -1 =
          point.x > cx + rim ? -1 : point.x < cx - rim ? 1 : point.x > cx ? 1 : -1;

        const lx = point.x + side * 16;
        const ly = point.y - 13;

        ctx.strokeStyle = `rgba(${ink.r},${ink.g},${ink.b},${(0.18 * alpha).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.x + side * 6, point.y - 7);
        ctx.lineTo(lx, ly);
        ctx.lineTo(lx + side * 34, ly);
        ctx.stroke();

        ctx.textAlign = side > 0 ? "left" : "right";
        ctx.shadowColor = "rgba(6,6,8,0.95)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(${ink.r},${ink.g},${ink.b},${(0.74 * alpha).toFixed(3)})`;
        ctx.fillText(label, lx + side * 3, ly - 5);
        ctx.shadowBlur = 0;
      }

      ctx.textAlign = "left";
      if ("letterSpacing" in ctx) spacing.letterSpacing = "0px";
      hits = next;
    };

    let frame = 0;
    let visible = true;

    const render = (now: number) => {
      const state = motion.current;

      if (!state.dragging) {
        state.lon += (state.targetLon - state.lon) * 0.12;
        state.lat += (state.targetLat - state.lat) * 0.12;
        state.idle += 1;
        if (
          !reduced.matches &&
          state.idle > (horizon ? 160 : 50) &&
          !state.activeId &&
          Math.abs(state.targetLon - state.lon) < 0.05
        ) {
          // A very slow drift: the instrument is awake, not spinning. The
          // horizon turns even more slowly; it is scenery, not a control.
          state.targetLon += horizon ? 0.006 : 0.018;
        }
      }
      state.zoom += (state.targetZoom - state.zoom) * 0.12;

      ctx.clearRect(0, 0, width, height);
      const r = radius * state.zoom;
      drawSphere(r);
      drawGraticule();
      drawLand();
      drawPins(now);

      if (visible) frame = requestAnimationFrame(render);
    };

    const start = () => {
      if (frame) return;
      frame = requestAnimationFrame(render);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    // ── interaction ──────────────────────────────────────────────────────
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    const onPointerDown = (event: PointerEvent) => {
      const state = motion.current;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture?.(event.pointerId);
      if (pointers.size === 1) {
        state.dragging = true;
        state.moved = 0;
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        state.idle = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = motion.current;
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2 && !horizon) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance > 0) {
          state.targetZoom = clamp(
            state.targetZoom * (distance / pinchDistance),
            MIN_ZOOM,
            MAX_ZOOM,
          );
        }
        pinchDistance = distance;
        return;
      }

      if (!state.dragging) return;
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.moved += Math.abs(dx) + Math.abs(dy);

      // One pixel of travel turns the sphere by one pixel of arc.
      const perPixel = 180 / (Math.PI * radius * state.zoom);
      state.targetLon -= dx * perPixel;
      state.targetLat = clamp(state.targetLat + dy * perPixel, -72, 72);
      state.lon += (state.targetLon - state.lon) * 0.55;
      state.lat += (state.targetLat - state.lat) * 0.55;
      state.idle = 0;
    };

    const endPointer = (event: PointerEvent) => {
      const state = motion.current;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      if (pointers.size > 0) return;

      if (state.dragging && state.moved < 7) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let nearest: { id: string; distance: number } | null = null;
        for (const hit of hits) {
          const distance = Math.hypot(hit.x - x, hit.y - y);
          if (distance < 30 && (!nearest || distance < nearest.distance)) {
            nearest = { id: hit.id, distance };
          }
        }
        if (nearest) {
          const place = placesRef.current.find((candidate) => candidate.id === nearest?.id);
          if (place) {
            selectRef.current(place);
            state.activeId = place.id;
            state.targetLon = state.lon + shortestAngle(state.lon, place.lon);
            state.targetLat = clamp(place.lat, -58, 58);
          }
        }
      }

      state.dragging = false;
      state.idle = 0;
    };

    const onWheel = (event: WheelEvent) => {
      if (horizon) return;
      event.preventDefault();
      const state = motion.current;
      state.targetZoom = clamp(
        state.targetZoom - event.deltaY * 0.0012,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      state.idle = 0;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ── lifecycle ────────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      resize();
      start();
    });
    resizeObserver.observe(wrap);

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible && document.visibilityState === "visible") start();
        else stop();
      },
      { threshold: 0.05 },
    );
    intersection.observe(wrap);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Re-read the palette when the theme changes; the canvas has no CSS.
    const themeObserver = new MutationObserver(() => {
      readColors();
      start();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("wheel", onWheel);
    };
    // Places and selection are read through refs, so a re-render never
    // restarts the renderer; the variant is fixed for the life of the mount.
  }, [variant]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative aspect-square w-full select-none",
        "cursor-grab active:cursor-grabbing",
        className,
      )}
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}
