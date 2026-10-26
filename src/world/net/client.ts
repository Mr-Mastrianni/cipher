/**
 * The wire between members.
 *
 * Deliberately small and forgiving: the world is a place to be in, not a
 * tournament. The server is authoritative only about shared things — who is
 * here, what has been built, who owns which terrace, which session is live —
 * while each client simulates its own body. A dropped packet costs a few
 * centimetres of somebody's avatar, never the world.
 *
 * If no room server is reachable the world still opens, alone, and says so.
 * The 2D site is never blocked by a websocket.
 */

import { HttpRoomNet } from "./http";
import type { RoomTransport } from "./types";
import {
  getStore,
  pushChat,
  pushSystem,
  toast,
  type AvatarForm,
  type BuildPiece,
  type PlotState,
  type RemotePlayer,
  type SessionState,
} from "../state";

type Json = Record<string, unknown>;

const MOVE_HZ = 12;
const MAX_SILENT_ATTEMPTS = 3;

/** Resolve the room server. Explicit env wins; otherwise sensible local paths. */
export function worldServerUrl(room: string): string {
  const explicit = process.env.NEXT_PUBLIC_WORLD_WS_URL;
  const base = (() => {
    if (explicit) return explicit;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      return `${proto}://${location.hostname}:8787/ws`;
    }
    // A custom server or reverse proxy mounted at /ws keeps the deployment to
    // one origin. If it is not there, the client falls back to solo cleanly.
    return `${proto}://${location.host}/ws`;
  })();
  const url = new URL(base, location.href);
  url.searchParams.set("room", room);
  const key = process.env.NEXT_PUBLIC_WORLD_ROOM_KEY;
  if (key) url.searchParams.set("key", key);
  return url.toString();
}

export class WorldNet implements RoomTransport {
  private ws: WebSocket | null = null;
  private room: string;
  private retry = 0;
  private silentAttempts = 0;
  private closedByUs = false;
  private lastMove = 0;
  private pendingMove: Json | null = null;
  private moveTimer: number | null = null;
  private pingAt = 0;
  private pingTimer: number | null = null;

  constructor(room: string) {
    this.room = room;
  }

  connect() {
    this.closedByUs = false;
    const store = getStore();
    store.set({ connecting: true });
    let ws: WebSocket;
    try {
      ws = new WebSocket(worldServerUrl(this.room));
    } catch {
      this.fallback("The room server address is not usable.");
      return;
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.retry = 0;
      this.silentAttempts = 0;
      getStore().set({
        connected: true,
        connecting: false,
        solo: false,
        serverNote: null,
      });
      const identity = getStore().get().identity;
      this.send({
        t: "hello",
        name: identity.name,
        color: identity.color,
        form: identity.form,
        crest: identity.crest,
      });
      this.startPing();
    });

    ws.addEventListener("message", (event) => {
      let msg: Json;
      try {
        msg = JSON.parse(String(event.data)) as Json;
      } catch {
        return;
      }
      this.handle(msg);
    });

    ws.addEventListener("close", () => {
      this.ws = null;
      this.stopPing();
      getStore().set({ connected: false, connecting: false });
      if (this.closedByUs) return;
      this.retry = Math.min(this.retry + 1, 5);
      this.silentAttempts += 1;
      if (this.silentAttempts >= MAX_SILENT_ATTEMPTS) {
        this.fallback(
          "No room server is reachable. You are exploring alone: nothing is shared, and a build is not saved after you leave.",
        );
        return;
      }
      const wait = 900 * this.retry;
      getStore().set({
        serverNote: `Looking for the room server (${Math.round(wait / 1000)}s)…`,
      });
      window.setTimeout(() => this.connect(), wait);
    });

    ws.addEventListener("error", () => {
      if (!getStore().get().connected) {
        getStore().set({ serverNote: "The room server did not answer." });
      }
    });
  }

  private fallback(note: string) {
    getStore().set({
      connected: false,
      connecting: false,
      solo: true,
      serverNote: note,
    });
  }

  /** Retry from the UI after a solo session. */
  reconnect() {
    this.silentAttempts = 0;
    this.retry = 0;
    getStore().set({ solo: false, serverNote: null });
    this.connect();
  }

  private handle(msg: Json) {
    const store = getStore();
    const t = String(msg.t ?? "");

    if (t === "welcome") {
      const you = msg.you as { id: string; plot?: number | null } | undefined;
      const players = (msg.players as RemotePlayer[]) ?? [];
      const builds = (msg.builds as BuildPiece[]) ?? [];
      const plots = (msg.plots as PlotState[]) ?? [];
      const session = (msg.session as SessionState | null) ?? null;
      store.set({
        selfId: you?.id ?? "",
        room: String(msg.room ?? this.room),
        players,
        playerCount: players.length,
        builds,
        plots,
        session,
        connected: true,
        connecting: false,
        solo: false,
        serverNote: null,
      });
      if (you && typeof you.plot === "number") {
        store.setIdentity({ plot: you.plot });
      }
      const others = players.filter((p) => p.id !== you?.id).length;
      if (others > 0) {
        toast(
          `${others} ${others === 1 ? "member is" : "members are"} here`,
          "Press Tab for the Atlas, or walk to the Axis.",
          "gold",
        );
      }
      return;
    }

    if (t === "players") {
      const players = (msg.players as RemotePlayer[]) ?? [];
      store.set({ players, playerCount: Math.max(1, players.length) });
      return;
    }

    if (t === "chat") {
      pushChat({
        kind: "chat",
        from: String(msg.from ?? "Someone"),
        color: String(msg.color ?? "#d4ff3f"),
        text: String(msg.text ?? ""),
        at: Number(msg.at) || Date.now(),
        where: typeof msg.where === "string" ? msg.where : "world",
      });
      return;
    }

    if (t === "system") {
      pushChat({
        kind: "system",
        from: "The Cipher",
        text: String(msg.text ?? ""),
        at: Date.now(),
        where: typeof msg.where === "string" ? msg.where : "world",
      });
      return;
    }

    if (t === "world") {
      const builds = (msg.builds as BuildPiece[]) ?? store.get().builds;
      store.set({
        builds,
        plots: (msg.plots as PlotState[]) ?? store.get().plots,
        session: (msg.session as SessionState | null) ?? store.get().session,
      });
      return;
    }

    if (t === "build:add") {
      const piece = msg.piece as BuildPiece;
      if (!piece) return;
      store.update((s) => {
        if (s.builds.some((b) => b.id === piece.id)) return {};
        return { builds: [...s.builds, piece] };
      });
      if (piece.owner !== store.get().selfId) {
        pushChat({
          kind: "action",
          from: piece.ownerName || "Someone",
          text: `set a ${piece.material} ${piece.type} in the world.`,
          at: Date.now(),
          where: "world",
        });
      }
      return;
    }

    if (t === "build:remove") {
      const id = String(msg.id ?? "");
      store.update((s) => ({ builds: s.builds.filter((b) => b.id !== id) }));
      return;
    }

    if (t === "plot:claim") {
      const plot = msg.plot as PlotState;
      if (!plot) return;
      store.update((state) => {
        const plots = [...state.plots.filter((p) => p.index !== plot.index), plot];
        const isMine = plot.owner === state.selfId || plot.ownerName === state.identity.name;
        return {
          plots,
          identity: isMine ? { ...state.identity, plot: plot.index } : state.identity,
        };
      });
      if (plot.ownerName !== store.get().identity.name) {
        pushSystem(`${plot.ownerName} claimed Terrace ${plot.index + 1}.`, "world");
      }
      return;
    }

    if (t === "plot:release") {
      const index = Number(msg.index);
      store.update((state) => ({
        plots: state.plots.filter((p) => p.index !== index),
        identity: state.identity.plot === index ? { ...state.identity, plot: null } : state.identity,
      }));
      return;
    }

    if (t === "session") {
      const session = (msg.session as SessionState | null) ?? null;
      store.set({ session });
      if (session) {
        pushSystem(`${session.host} took the floor: “${session.title}”.`, "world");
        toast("A session is live", `${session.title} — ${session.host}. Press Tab → Join.`, "gold");
      } else {
        pushSystem("The floor is clear.", "world");
      }
      return;
    }

    if (t === "signal") {
      window.dispatchEvent(new CustomEvent("cipher-signal", { detail: msg }));
      return;
    }

    if (t === "emote") {
      window.dispatchEvent(new CustomEvent("cipher-emote", { detail: msg }));
      return;
    }

    if (t === "pong") {
      store.set({ ping: Math.max(0, Math.round(performance.now() - this.pingAt)) });
      return;
    }

    if (t === "error") {
      toast("The world could not do that", String(msg.message ?? ""), "danger");
    }
  }

  private send(msg: Json) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private startPing() {
    this.stopPing();
    const tick = () => {
      this.pingAt = performance.now();
      this.send({ t: "ping" });
      this.pingTimer = window.setTimeout(tick, 4000);
    };
    this.pingTimer = window.setTimeout(tick, 1400);
  }

  private stopPing() {
    if (this.pingTimer) window.clearTimeout(this.pingTimer);
    this.pingTimer = null;
  }

  move(x: number, y: number, z: number, yaw: number, pitch: number, mode: "walk" | "fly", region: string) {
    this.pendingMove = { t: "move", x, y, z, yaw, pitch, m: mode, region };
    const now = performance.now();
    if (now - this.lastMove >= 1000 / MOVE_HZ) this.flushMove();
    else if (this.moveTimer === null) {
      this.moveTimer = window.setTimeout(() => this.flushMove(), 1000 / MOVE_HZ);
    }
  }

  private flushMove() {
    if (this.moveTimer) window.clearTimeout(this.moveTimer);
    this.moveTimer = null;
    if (!this.pendingMove) return;
    this.lastMove = performance.now();
    this.send(this.pendingMove);
    this.pendingMove = null;
  }

  buildAdd(piece: BuildPiece) {
    this.send({ t: "build:add", piece });
  }

  buildRemove(id: string) {
    this.send({ t: "build:remove", id });
  }

  chat(text: string, where: string) {
    this.send({ t: "chat", text, where });
  }

  signal(from: [number, number, number], to: [number, number, number]) {
    this.send({ t: "signal", from, to });
  }

  emote(kind: string) {
    this.send({ t: "emote", kind });
  }

  claimPlot(index: number, title: string, color: string, glyph: string, motto: string) {
    this.send({ t: "plot:claim", index, title, color, glyph, motto });
  }

  updatePlot(index: number, title: string, color: string, glyph: string, motto: string) {
    this.send({ t: "plot:update", index, title, color, glyph, motto });
  }

  releasePlot(index: number) {
    this.send({ t: "plot:release", index });
  }

  startSession(title: string) {
    this.send({ t: "session:start", title });
  }

  endSession() {
    this.send({ t: "session:end" });
  }

  setIdentity(name: string, color: string, form: AvatarForm, crest: string) {
    this.send({ t: "hello", name, color, form, crest });
  }

  close() {
    this.closedByUs = true;
    this.stopPing();
    this.ws?.close();
  }
}

let net: RoomTransport | null = null;

/**
 * Pick a transport.
 *
 * A long-lived WebSocket is preferred when one is available: it is local, or an
 * explicit `NEXT_PUBLIC_WORLD_WS_URL` points at a hosted room server. On a
 * serverless deployment such as Vercel the HTTP/Postgres room is the default,
 * and `?transport=http` forces it locally for testing.
 */
function chooseTransport(): "ws" | "http" {
  try {
    const forced = new URLSearchParams(location.search).get("transport");
    if (forced === "http" || forced === "ws") return forced;
  } catch {
    /* no location in a non-browser context */
  }
  if (process.env.NEXT_PUBLIC_WORLD_WS_URL) return "ws";
  if (
    typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ) {
    return "ws";
  }
  return "http";
}

export function connectNet(room: string): RoomTransport {
  net?.close();
  net = chooseTransport() === "http" ? new HttpRoomNet(room) : new WorldNet(room);
  net.connect();
  return net;
}

export function getNet(): RoomTransport | null {
  return net;
}

export function disconnectNet() {
  net?.close();
  net = null;
}
