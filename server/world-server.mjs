#!/usr/bin/env node
/**
 * The Cipher — room server.
 *
 * A small, standalone WebSocket service that keeps a room of members in the same
 * place: presence, chat, the shared Studio bench, terrace claims, and the live
 * session on the Amphitheatre floor. It is authoritative only about shared
 * things. Each client simulates its own body.
 *
 * Run it beside the Next.js app:
 *
 *   node server/world-server.mjs                 # ws://localhost:8787/ws
 *   PORT=9000 node server/world-server.mjs
 *
 * Then point the browser at it with NEXT_PUBLIC_WORLD_WS_URL (wss://…/ws in
 * production). If the app is served behind a reverse proxy that maps /ws to this
 * process, no variable is needed.
 *
 * Persistence is a single JSON file (atomic write, debounced). Presence is
 * in-memory and deliberately ephemeral. There are no accounts here: the room name
 * is the only key, exactly as the invitation should be. Set WORLD_ROOM_SECRET to
 * require a shared key as well.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || process.env.WORLD_PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SECRET = process.env.WORLD_ROOM_SECRET || "";
const MAX_PLAYERS = Number(process.env.WORLD_MAX_PLAYERS || 24);
const MAX_BUILDS = Number(process.env.WORLD_MAX_BUILDS || 1200);
const DATA_FILE =
  process.env.WORLD_DATA_FILE || path.join(process.cwd(), "data", "world.json");

/* Keep these in step with `src/world/content/world.ts`. The server is the
   boundary that validates before broadcasting; it must not trust the client. */
const PIECES = new Set([
  "plinth",
  "pillar",
  "arch",
  "wall",
  "orb",
  "ring",
  "stair",
  "banner",
  "prism",
  "altar",
]);
const MATERIALS = new Set([
  "cipher",
  "basalt",
  "gold",
  "verdigris",
  "violet",
  "lime",
  "bone",
  "obsidian",
]);
const FORMS = new Set(["cloak", "orb", "wanderer"]);
const PLOT_COUNT = 12;
const PLOT_PIECES = 24;
const ROOM_RE = /^[a-z0-9-]{1,40}$/;

/* ── persistence ─────────────────────────────────────────────────────────── */

/** @type {Record<string, {builds: any[], plots: Record<string, any>, session: any|null, updatedAt: number}>} */
let data = {};
let saveTimer = null;

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    // save() writes { version, rooms }. Older files were a bare room map; read
    // both, so a restart never silently forgets a room.
    data =
      parsed && typeof parsed === "object" && parsed.rooms && typeof parsed.rooms === "object"
        ? parsed.rooms
        : parsed && typeof parsed === "object"
          ? parsed
          : {};
    console.log(`[world] loaded ${Object.keys(data).length} room(s) from ${DATA_FILE}`);
  } catch (error) {
    console.warn(`[world] could not read ${DATA_FILE}; starting empty`, error.message);
  }
}

function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 700);
}

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    const rooms = {};
    for (const [room, state] of Object.entries(data)) {
      rooms[room] = {
        builds: state.builds ?? [],
        plots: state.plots ?? {},
        session: state.session ?? null,
        updatedAt: state.updatedAt ?? Date.now(),
      };
    }
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, rooms }, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (error) {
    console.warn(`[world] could not write ${DATA_FILE}`, error.message);
  }
}

function roomData(room) {
  if (!data[room]) data[room] = { builds: [], plots: {}, session: null, updatedAt: Date.now() };
  return data[room];
}

/* ── rooms and players ───────────────────────────────────────────────────── */

/** @type {Map<string, {clients:Set<any>, players:Map<string, any>}>} */
const rooms = new Map();

function roomFor(name) {
  let room = rooms.get(name);
  if (!room) {
    room = { clients: new Set(), players: new Map() };
    rooms.set(name, room);
  }
  return room;
}

let playerSeq = 0;
function newPlayerId() {
  playerSeq += 1;
  return `p-${Date.now().toString(36)}-${playerSeq.toString(36)}`;
}

function playersList(roomName) {
  const room = rooms.get(roomName);
  if (!room) return [];
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    form: p.form,
    crest: p.crest,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    mode: p.mode,
    region: p.region,
    plot: p.plot,
    at: p.at,
  }));
}

function plotsList(roomName) {
  const state = roomData(roomName);
  return Object.values(state.plots ?? {}).sort((a, b) => a.index - b.index);
}

function send(ws, payload) {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* a dead socket is cleaned up by the close handler */
    }
  }
}

function broadcast(roomName, payload, exclude = null) {
  const room = rooms.get(roomName);
  if (!room) return;
  for (const client of room.clients) {
    if (client !== exclude) send(client, payload);
  }
}

function system(roomName, text) {
  broadcast(roomName, { t: "system", text, at: Date.now() });
}

function sanitizeRoom(value) {
  const room = String(value ?? "").toLowerCase();
  return ROOM_RE.test(room) ? room : "the-cipher";
}

function cleanText(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function cleanColor(value) {
  const v = String(value ?? "");
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#d4ff3f";
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rateLimit(player, key, count, windowMs) {
  const now = Date.now();
  const bucket = (player.limits[key] ??= []);
  while (bucket.length && now - bucket[0] > windowMs) bucket.shift();
  if (bucket.length >= count) return false;
  bucket.push(now);
  return true;
}

/* ── HTTP + WebSocket ────────────────────────────────────────────────────── */

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/health" || req.url === "/") {
    let players = 0;
    for (const room of rooms.values()) players += room.players.size;
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "cipher-world",
        players,
        rooms: rooms.size,
        builds: Object.values(data).reduce((n, r) => n + (r.builds?.length ?? 0), 0),
        uptime: Math.round(process.uptime()),
      }),
    );
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

wss.on("connection", (ws, request) => {
  const url = new URL(request.url ?? "/ws", `http://${request.headers.host ?? "localhost"}`);
  if (SECRET && url.searchParams.get("key") !== SECRET) {
    send(ws, { t: "error", message: "This room needs an invitation key." });
    ws.close(1008, "key required");
    return;
  }
  const roomName = sanitizeRoom(url.searchParams.get("room"));
  const room = roomFor(roomName);
  if (room.players.size >= MAX_PLAYERS) {
    send(ws, { t: "error", message: `This room is full (${MAX_PLAYERS} members).` });
    ws.close(1013, "room full");
    return;
  }

  const player = {
    id: newPlayerId(),
    name: "A traveller",
    color: "#d4ff3f",
    form: "cloak",
    crest: "\u2726",
    x: 0,
    y: 24,
    z: 48,
    yaw: 0,
    pitch: 0,
    mode: "walk",
    region: "Arrivals",
    plot: null,
    at: Date.now(),
    limits: {},
    greeted: false,
  };
  ws.meta = { roomName, playerId: player.id };
  room.clients.add(ws);
  room.players.set(player.id, player);

  const state = roomData(roomName);
  // Restore a plot this member owned on a previous visit, if the name matches.
  send(ws, {
    t: "welcome",
    you: { id: player.id, plot: null },
    room: roomName,
    players: playersList(roomName),
    builds: state.builds ?? [],
    plots: plotsList(roomName),
    session: state.session ?? null,
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    const now = Date.now();
    player.at = now;

    switch (String(msg.t ?? "")) {
      case "hello": {
        const previousName = player.name;
        player.name = cleanText(msg.name, 32) || "A traveller";
        player.color = cleanColor(msg.color);
        player.form = FORMS.has(msg.form) ? msg.form : "cloak";
        player.crest = cleanText(msg.crest, 4) || "\u2726";
        if (!player.greeted) {
          player.greeted = true;
          system(roomName, `${player.name} arrived.`);
        } else if (previousName !== player.name) {
          system(roomName, `${previousName} is now ${player.name}.`);
        }
        // If the member already owned a plot under this name and it is unclaimed
        // in this room, reconnect them to it.
        const owned = Object.values(state.plots ?? {}).find((p) => p.ownerName === player.name);
        if (owned && !player.plot) {
          player.plot = owned.index;
          owned.owner = player.id;
          // Everyone needs the new socket id, not only the member returning.
          broadcast(roomName, { t: "plot:claim", plot: owned });
          saveSoon();
        }
        send(ws, { t: "players", players: playersList(roomName) });
        broadcast(roomName, { t: "players", players: playersList(roomName) }, ws);
        break;
      }

      case "move": {
        if (!rateLimit(player, "move", 30, 1000)) return;
        player.x = Math.max(-900, Math.min(900, cleanNumber(msg.x)));
        player.y = Math.max(-90, Math.min(2700, cleanNumber(msg.y)));
        player.z = Math.max(-900, Math.min(900, cleanNumber(msg.z)));
        player.yaw = cleanNumber(msg.yaw);
        player.pitch = cleanNumber(msg.pitch);
        player.mode = msg.m === "fly" ? "fly" : "walk";
        player.region = cleanText(msg.region, 24);
        break;
      }

      case "chat": {
        if (!rateLimit(player, "chat", 3, 3000)) {
          send(ws, { t: "error", message: "Easy — one message at a time." });
          return;
        }
        const text = cleanText(msg.text, 400);
        if (!text) return;
        const where = cleanText(msg.where, 32) || "world";
        broadcast(roomName, {
          t: "chat",
          from: player.name,
          color: player.color,
          text,
          where,
          at: now,
        });
        break;
      }

      case "build:add": {
        if (!rateLimit(player, "build", 14, 10000)) {
          send(ws, { t: "error", message: "Slow down a moment before placing more." });
          return;
        }
        const piece = msg.piece;
        if (!piece || typeof piece !== "object") return;
        const type = String(piece.type ?? "");
        const material = String(piece.material ?? "");
        if (!PIECES.has(type) || !MATERIALS.has(material)) return;
        if ((state.builds?.length ?? 0) >= MAX_BUILDS) {
          send(ws, { t: "error", message: "This room's bench is full." });
          return;
        }
        const x = cleanNumber(piece.x);
        const y = cleanNumber(piece.y);
        const z = cleanNumber(piece.z);
        if (Math.abs(x) > 750 || Math.abs(z) > 750 || y < -20 || y > 300) return;
        const scale = Math.max(0.4, Math.min(4, cleanNumber(piece.scale, 1)));
        const ry = cleanNumber(piece.ry);
        const plot =
          typeof piece.plot === "number" && piece.plot >= 0 && piece.plot < PLOT_COUNT
            ? Math.floor(piece.plot)
            : null;
        if (plot !== null) {
          const claim = state.plots?.[String(plot)];
          if (!claim || claim.owner !== player.id) {
            send(ws, { t: "error", message: "That terrace is not yours." });
            return;
          }
          const count = state.builds.filter((b) => b.plot === plot).length;
          if (count >= PLOT_PIECES) {
            send(ws, { t: "error", message: `A terrace holds ${PLOT_PIECES} pieces.` });
            return;
          }
        }
        const id = cleanText(piece.id, 48) || `b-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        if (state.builds.some((b) => b.id === id)) return;
        const clean = {
          id,
          type,
          material,
          x: Math.round(x * 2) / 2,
          y: Math.round(y * 4) / 4,
          z: Math.round(z * 2) / 2,
          ry: Math.round(ry * 24) / 24,
          scale: Math.round(scale * 20) / 20,
          owner: player.id,
          ownerName: player.name,
          plot,
          at: now,
        };
        state.builds.push(clean);
        state.updatedAt = now;
        saveSoon();
        broadcast(roomName, { t: "build:add", piece: clean });
        break;
      }

      case "build:remove": {
        const id = cleanText(msg.id, 48);
        const index = state.builds.findIndex((b) => b.id === id);
        if (index < 0) return;
        const piece = state.builds[index];
        if (piece.owner !== player.id) {
          send(ws, { t: "error", message: "Only the member who placed it can remove it." });
          return;
        }
        state.builds.splice(index, 1);
        state.updatedAt = now;
        saveSoon();
        broadcast(roomName, { t: "build:remove", id });
        break;
      }

      case "plot:claim": {
        const index = Number(msg.index);
        if (!Number.isInteger(index) || index < 0 || index >= PLOT_COUNT) return;
        const existing = state.plots?.[String(index)];
        if (existing && existing.owner !== player.id) {
          send(ws, { t: "error", message: `Terrace ${index + 1} is already claimed.` });
          return;
        }
        const owned = Object.values(state.plots ?? {}).find((p) => p.owner === player.id);
        if (owned && owned.index !== index) {
          delete state.plots[String(owned.index)];
          player.plot = null;
          broadcast(roomName, { t: "plot:release", index: owned.index });
        }
        const plot = {
          index,
          owner: player.id,
          ownerName: player.name,
          title: cleanText(msg.title, 40) || `${player.name}'s terrace`,
          color: cleanColor(msg.color),
          glyph: cleanText(msg.glyph, 4) || "\u2726",
          motto: cleanText(msg.motto, 80) || "a place of their own",
          at: now,
        };
        state.plots[String(index)] = plot;
        state.updatedAt = now;
        player.plot = index;
        saveSoon();
        broadcast(roomName, { t: "plot:claim", plot });
        broadcast(roomName, { t: "players", players: playersList(roomName) });
        break;
      }

      case "plot:update": {
        const index = Number(msg.index);
        const existing = state.plots?.[String(index)];
        if (!existing || existing.owner !== player.id) {
          send(ws, { t: "error", message: "That terrace is not yours to edit." });
          return;
        }
        existing.title = cleanText(msg.title, 40) || existing.title;
        existing.color = cleanColor(msg.color);
        existing.glyph = cleanText(msg.glyph, 4) || existing.glyph;
        existing.motto = cleanText(msg.motto, 80);
        existing.at = now;
        state.updatedAt = now;
        saveSoon();
        broadcast(roomName, { t: "plot:claim", plot: existing });
        break;
      }

      case "plot:release": {
        const index = Number(msg.index);
        const existing = state.plots?.[String(index)];
        if (!existing || existing.owner !== player.id) return;
        // Do not silently destroy the work on a terrace: remove its pieces too.
        state.builds = state.builds.filter((b) => b.plot !== index);
        delete state.plots[String(index)];
        state.updatedAt = now;
        player.plot = null;
        saveSoon();
        broadcast(roomName, { t: "plot:release", index });
        broadcast(roomName, { t: "world", builds: state.builds, plots: plotsList(roomName), session: state.session });
        break;
      }

      case "session:start": {
        if (!rateLimit(player, "session", 4, 60000)) return;
        const title = cleanText(msg.title, 80);
        if (!title) return;
        const session = {
          id: `s-${now.toString(36)}`,
          title,
          hostId: player.id,
          host: player.name,
          at: now,
        };
        state.session = session;
        state.updatedAt = now;
        saveSoon();
        broadcast(roomName, { t: "session", session });
        break;
      }

      case "session:end": {
        if (!state.session) return;
        if (state.session.hostId !== player.id) {
          send(ws, { t: "error", message: "Only the host can close the floor." });
          return;
        }
        state.session = null;
        state.updatedAt = now;
        saveSoon();
        broadcast(roomName, { t: "session", session: null });
        break;
      }

      case "signal": {
        if (!rateLimit(player, "signal", 8, 4000)) return;
        const from = Array.isArray(msg.from) ? msg.from.map((n) => cleanNumber(n)) : null;
        const to = Array.isArray(msg.to) ? msg.to.map((n) => cleanNumber(n)) : null;
        if (!from || !to || from.length !== 3 || to.length !== 3) return;
        broadcast(
          roomName,
          { t: "signal", from, to, fromId: player.id },
          ws,
        );
        break;
      }

      case "emote": {
        broadcast(roomName, { t: "emote", kind: cleanText(msg.kind, 20), from: player.name }, ws);
        break;
      }

      case "ping":
        send(ws, { t: "pong", at: now });
        break;

      default:
        break;
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);
    room.players.delete(player.id);
    if (room.players.size === 0) {
      // Keep the persisted world, but release the in-memory presence.
      rooms.delete(roomName);
    } else {
      system(roomName, `${player.name} left.`);
      broadcast(roomName, { t: "players", players: playersList(roomName) });
    }
  });

  ws.on("error", () => {
    /* the close handler does the cleanup */
  });
});

// Presence at 10 Hz is enough for a body at walking speed and cheap on a room
// of two dozen. Positions are interpolated on the client.
setInterval(() => {
  for (const [roomName, room] of rooms) {
    if (room.clients.size === 0) continue;
    const players = playersList(roomName);
    for (const client of room.clients) send(client, { t: "players", players });
  }
}, 120);

setInterval(() => save(), 30_000);

function shutdown() {
  console.log("[world] saving and closing");
  save();
  for (const room of rooms.values()) {
    for (const client of room.clients) client.close(1001, "server closing");
  }
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

load();
server.listen(PORT, HOST, () => {
  console.log(`[world] The Cipher room server is listening on ws://${HOST}:${PORT}/ws`);
  console.log(`[world] health: http://${HOST}:${PORT}/health`);
  if (SECRET) console.log("[world] WORLD_ROOM_SECRET is set; clients must present the key.");
  if (!fs.existsSync(DATA_FILE)) console.log(`[world] no world yet; will create ${DATA_FILE}`);
});
