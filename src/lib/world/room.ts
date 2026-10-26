/**
 * The world's room rules, shared by the HTTP room API.
 *
 * The standalone WebSocket server in `server/world-server.mjs` remains the
 * preferred transport when a long-lived process is available. On Vercel there is
 * no WebSocket, so the same shared state is served over short HTTP requests and
 * Postgres. This module contains only the parts both transports must agree on:
 * the player shape, the validation, and the world document transitions.
 *
 * It is server-only (it imports `node:crypto`); the client talks to it through
 * `/api/world/room`.
 */

import { createHash } from "node:crypto";

import {
  BUILD_MATERIALS,
  BUILD_PIECES,
  GRAHAS,
  PLOTS,
  PLOT_PIECE_LIMIT,
} from "@/world/content/world";
import type {
  AvatarForm,
  BuildPiece,
  PlotState,
  SessionState,
} from "@/world/state";

export const WORLD_ROOM_MAX_PLAYERS = 24;
export const WORLD_ROOM_MAX_BUILDS = 1200;
export const WORLD_CHAT_LIMIT = 100;
export const WORLD_SIGNAL_LIMIT = 12;
export const PRESENCE_WINDOW_SECONDS = 20;

const PIECES = new Set(BUILD_PIECES.map((piece) => piece.id));
const MATERIALS = new Set(BUILD_MATERIALS.map((material) => material.id));
const FORMS = new Set<AvatarForm>(["cloak", "orb", "wanderer"]);
const PLOT_COUNT = PLOTS.length;
const ROOM_RE = /^[a-z0-9-]{1,40}$/;

export interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  form: AvatarForm;
  crest: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  mode: "walk" | "fly";
  region: string;
  at: number;
}

export interface RoomChat {
  id: number;
  from: string;
  color: string;
  text: string;
  where: string;
  at: number;
}

export interface RoomSignal {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  at: number;
}

export interface WorldDoc {
  builds: BuildPiece[];
  plots: Record<string, PlotState>;
  session: SessionState | null;
  signals: RoomSignal[];
  version: number;
}

export function emptyWorld(): WorldDoc {
  return { builds: [], plots: {}, session: null, signals: [], version: 1 };
}

/* ── sanitising ─────────────────────────────────────────────────────────── */

export function sanitizeRoom(value: unknown): string {
  const room = String(value ?? "").toLowerCase();
  return ROOM_RE.test(room) ? room : "the-cipher";
}

export function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export function cleanColor(value: unknown): string {
  const v = String(value ?? "");
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#d4ff3f";
}

export function cleanNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * A stable, opaque world id for a signed-in member.
 *
 * The Clerk id is never exposed in a room: two different rooms should not be
 * linkable by the same public identifier, and a member's account id should not
 * be broadcast to strangers. The hash is deterministic so a member keeps their
 * terrace and their name association across sessions.
 */
export function memberWorldId(userId: string): string {
  return `m-${createHash("sha256")
    .update(`cipher-world:${userId}`)
    .digest("hex")
    .slice(0, 20)}`;
}

/** A player id as read back from storage (member hashes and anonymous ids). */
export function cleanPlayerId(value: unknown): string {
  const id = String(value ?? "");
  if (/^m-[a-f0-9]{20}$/.test(id)) return id;
  if (/^w-[a-z0-9-]{6,40}$/.test(id)) return id;
  return "";
}

/**
 * An anonymous id a client may present. Member hashes are deliberately refused:
 * a signed-in identity must come from the Clerk session, never from a body field.
 */
export function cleanAnonymousId(value: unknown): string {
  const id = String(value ?? "");
  return /^w-[a-z0-9-]{6,40}$/.test(id) ? id : "";
}

export interface PlayerIdentity {
  id: string;
  name: string;
  color: string;
  form: AvatarForm;
  crest: string;
}

export function resolveIdentity(
  userId: string | null,
  raw: unknown,
  fallbackId = "",
): PlayerIdentity {
  const source = (raw ?? {}) as Record<string, unknown>;
  const form = FORMS.has(source.form as AvatarForm)
    ? (source.form as AvatarForm)
    : "cloak";
  return {
    id: userId
      ? memberWorldId(userId)
      : cleanAnonymousId(source.id) || cleanAnonymousId(fallbackId) || "",
    name: cleanText(source.name, 32) || "A traveller",
    color: cleanColor(source.color),
    form,
    crest: cleanText(source.crest, 4) || "\u2726",
  };
}

/* ── world transitions ──────────────────────────────────────────────────── */

export interface ActionResult {
  ok: boolean;
  error?: string;
  changed: boolean;
  world: WorldDoc;
}

function cloneWorld(world: WorldDoc): WorldDoc {
  return {
    builds: world.builds.map((piece) => ({ ...piece })),
    plots: Object.fromEntries(
      Object.entries(world.plots).map(([key, plot]) => [key, { ...plot }]),
    ),
    session: world.session ? { ...world.session } : null,
    signals: world.signals.map((signal) => ({ ...signal })),
    version: world.version,
  };
}

function fail(world: WorldDoc, error: string): ActionResult {
  return { ok: false, error, changed: false, world };
}

/**
 * Apply one world-mutating action. Presence, chat and identity are handled by
 * the route because they live in their own tables.
 */
export function applyWorldAction(
  current: WorldDoc,
  action: string,
  payload: Record<string, unknown>,
  player: PlayerIdentity,
  now = Date.now(),
): ActionResult {
  const world = cloneWorld(current);
  const markChanged = () => {
    world.version += 1;
  };

  switch (action) {
    case "build:add": {
      if (world.builds.length >= WORLD_ROOM_MAX_BUILDS) {
        return fail(current, "This room's bench is full.");
      }
      const piece = (payload.piece ?? {}) as Record<string, unknown>;
      const type = String(piece.type ?? "");
      const material = String(piece.material ?? "");
      if (!PIECES.has(type) || !MATERIALS.has(material)) {
        return fail(current, "That piece or material is not in the palette.");
      }
      const x = cleanNumber(piece.x);
      const y = cleanNumber(piece.y);
      const z = cleanNumber(piece.z);
      if (Math.abs(x) > 750 || Math.abs(z) > 750 || y < -20 || y > 300) {
        return fail(current, "That piece is outside the valley.");
      }
      const plot =
        typeof piece.plot === "number" &&
        Number.isInteger(piece.plot) &&
        piece.plot >= 0 &&
        piece.plot < PLOT_COUNT
          ? piece.plot
          : null;
      if (plot !== null) {
        const claim = world.plots[String(plot)];
        if (!claim || claim.owner !== player.id) {
          return fail(current, "That terrace is not yours.");
        }
        const count = world.builds.filter((item) => item.plot === plot).length;
        if (count >= PLOT_PIECE_LIMIT) {
          return fail(current, `A terrace holds ${PLOT_PIECE_LIMIT} pieces.`);
        }
      }
      const id =
        cleanText(piece.id, 48) ||
        `b-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      if (world.builds.some((item) => item.id === id)) {
        return { ok: true, changed: false, world: current };
      }
      const clean: BuildPiece = {
        id,
        type,
        material,
        x: Math.round(x * 2) / 2,
        y: Math.round(y * 4) / 4,
        z: Math.round(z * 2) / 2,
        ry: Math.round(cleanNumber(piece.ry) * 24) / 24,
        scale: Math.round(Math.max(0.4, Math.min(4, cleanNumber(piece.scale, 1))) * 20) / 20,
        owner: player.id,
        ownerName: player.name,
        plot,
        at: now,
      };
      world.builds.push(clean);
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "build:remove": {
      const id = cleanText(payload.id, 48);
      const index = world.builds.findIndex((piece) => piece.id === id);
      if (index < 0) return { ok: true, changed: false, world: current };
      if (world.builds[index].owner !== player.id) {
        return fail(current, "Only the member who placed it can remove it.");
      }
      world.builds.splice(index, 1);
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "plot:claim": {
      const index = Number(payload.index);
      if (!Number.isInteger(index) || index < 0 || index >= PLOT_COUNT) {
        return fail(current, "That terrace does not exist.");
      }
      const existing = world.plots[String(index)];
      if (existing && existing.owner !== player.id) {
        return fail(current, `Terrace ${index + 1} is already claimed.`);
      }
      const owned = Object.values(world.plots).find(
        (plot) => plot.owner === player.id && plot.index !== index,
      );
      if (owned) {
        delete world.plots[String(owned.index)];
        world.builds = world.builds.filter((piece) => piece.plot !== owned.index);
      }
      const plot: PlotState = {
        index,
        owner: player.id,
        ownerName: player.name,
        title: cleanText(payload.title, 40) || `${player.name}'s terrace`,
        color: cleanColor(payload.color),
        glyph: cleanText(payload.glyph, 4) || "\u2726",
        motto: cleanText(payload.motto, 80) || "a place of their own",
        at: now,
      };
      world.plots[String(index)] = plot;
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "plot:update": {
      const index = Number(payload.index);
      const existing = world.plots[String(index)];
      if (!existing || existing.owner !== player.id) {
        return fail(current, "That terrace is not yours to edit.");
      }
      existing.title = cleanText(payload.title, 40) || existing.title;
      existing.color = cleanColor(payload.color);
      existing.glyph = cleanText(payload.glyph, 4) || existing.glyph;
      existing.motto = cleanText(payload.motto, 80);
      existing.at = now;
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "plot:release": {
      const index = Number(payload.index);
      const existing = world.plots[String(index)];
      if (!existing || existing.owner !== player.id) {
        return fail(current, "That terrace is not yours to release.");
      }
      world.builds = world.builds.filter((piece) => piece.plot !== index);
      delete world.plots[String(index)];
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "session:start": {
      const title = cleanText(payload.title, 80);
      if (!title) return fail(current, "A session needs a title.");
      world.session = {
        id: `s-${now.toString(36)}`,
        title,
        hostId: player.id,
        host: player.name,
        at: now,
      };
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "session:end": {
      if (!world.session) return { ok: true, changed: false, world: current };
      if (world.session.hostId !== player.id) {
        return fail(current, "Only the host can close the floor.");
      }
      world.session = null;
      markChanged();
      return { ok: true, changed: true, world };
    }

    case "signal": {
      const from = Array.isArray(payload.from)
        ? (payload.from.map((n) => cleanNumber(n)) as [number, number, number])
        : null;
      const to = Array.isArray(payload.to)
        ? (payload.to.map((n) => cleanNumber(n)) as [number, number, number])
        : null;
      if (!from || !to || from.length !== 3 || to.length !== 3) {
        return fail(current, "A signal needs a start and an end.");
      }
      world.signals.push({
        id: `sg-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        from,
        to,
        at: now,
      });
      world.signals = world.signals.slice(-WORLD_SIGNAL_LIMIT);
      markChanged();
      return { ok: true, changed: true, world };
    }

    default:
      return fail(current, "Unknown world action.");
  }
}

/* ── action classification ──────────────────────────────────────────────── */

export type WorldActionName =
  | "build:add"
  | "build:remove"
  | "plot:claim"
  | "plot:update"
  | "plot:release"
  | "session:start"
  | "session:end"
  | "signal";

export function isWorldAction(action: string): action is WorldActionName {
  return (
    action === "build:add" ||
    action === "build:remove" ||
    action === "plot:claim" ||
    action === "plot:update" ||
    action === "plot:release" ||
    action === "session:start" ||
    action === "session:end" ||
    action === "signal"
  );
}

/** The nine grahas are rendered from the client content; keep the import alive
 *  so a future server-side validation of graha names has one source of truth. */
export const GRAHA_IDS = GRAHAS.map((graha) => graha.id);
