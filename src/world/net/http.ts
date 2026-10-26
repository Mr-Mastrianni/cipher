/**
 * The HTTP room transport.
 *
 * For deployments that cannot hold a WebSocket open (Vercel Functions), the
 * world still needs a room. This transport keeps presence in a small Postgres
 * row per member, the shared world in one document per room, and chat in an
 * append-only table. It polls a little over once a second and interpolates
 * bodies; builds, terraces, sessions and signals appear on the next poll.
 *
 * The lower-latency WebSocket transport remains in `client.ts` and is preferred
 * whenever `NEXT_PUBLIC_WORLD_WS_URL` is set or the app runs locally.
 */

import {
  getStore,
  pushChat,
  toast,
  type AvatarForm,
  type BuildPiece,
  type PlotState,
  type RemotePlayer,
  type SessionState,
} from "../state";
import type { RoomTransport } from "./types";

const PLAYER_KEY = "cipher:world:player";
const POLL_MS = 1150;
const MOVE_MS = 500;

interface HttpChat {
  id: number;
  from: string;
  color: string;
  text: string;
  where: string;
  at: number;
}

interface HttpWorld {
  builds: BuildPiece[];
  plots: Record<string, PlotState> | PlotState[];
  session: SessionState | null;
  signals: Array<{ id: string; from: [number, number, number]; to: [number, number, number]; at: number }>;
  version: number;
}

interface Snapshot {
  ok: boolean;
  room: string;
  now: number;
  you: { id: string; plot: number | null };
  players: Array<RemotePlayer & { at: number }>;
  world?: HttpWorld;
  version: number;
  chat: HttpChat[];
}

interface PlayerPayload {
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
}

function readPlayerId(): string {
  try {
    const stored = window.localStorage.getItem(PLAYER_KEY);
    if (stored && /^[mw]-[a-z0-9-]{6,40}$/.test(stored)) return stored;
  } catch {
    /* storage may be blocked */
  }
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const id = `w-${random.slice(0, 20)}`;
  try {
    window.localStorage.setItem(PLAYER_KEY, id);
  } catch {
    /* storage may be blocked; the id survives for this session */
  }
  return id;
}

export class HttpRoomNet implements RoomTransport {
  private room: string;
  private playerId: string;
  private version = 0;
  private chatSince = 0;
  private seenSignals = new Set<string>();
  private closedByUs = false;
  private connecting = false;
  private helloAttempts = 0;
  private pollFailures = 0;
  private polling = false;
  private pollTimer: number | null = null;
  private moveTimer: number | null = null;
  private pendingMove: PlayerPayload | null = null;
  private moving = false;
  private started = false;

  constructor(room: string) {
    this.room = room;
    this.playerId = readPlayerId();
  }

  connect() {
    if (this.connecting) return;
    this.closedByUs = false;
    this.connecting = true;
    getStore().set({ connecting: true, solo: false, serverNote: null });
    void this.hello();
  }

  reconnect() {
    this.helloAttempts = 0;
    this.pollFailures = 0;
    this.connecting = false;
    this.startLoops();
    this.connect();
  }

  private playerPayload(): PlayerPayload {
    const state = getStore().get();
    const [x, y, z] = state.position;
    return {
      id: this.playerId,
      name: state.identity.name,
      color: state.identity.color,
      form: state.identity.form,
      crest: state.identity.crest,
      x,
      y,
      z,
      yaw: state.yaw,
      pitch: state.pitch,
      mode: state.mode,
      region: state.region,
    };
  }

  private async hello() {
    if (this.closedByUs) return;
    try {
      const data = await this.post("hello", { player: this.playerPayload() });
      if (!data || !data.ok) {
        throw new Error("The room did not answer.");
      }
      if (data.you?.id) {
        this.playerId = data.you.id;
        try {
          window.localStorage.setItem(PLAYER_KEY, this.playerId);
        } catch {
          /* storage may be blocked */
        }
      }
      this.apply(data as Snapshot, true);
      this.connecting = false;
      this.helloAttempts = 0;
      getStore().set({ connected: true, connecting: false, solo: false });
      this.startLoops();
    } catch (error) {
      this.connecting = false;
      this.helloAttempts += 1;
      const message = error instanceof Error ? error.message : "The room is unreachable.";
      if (this.helloAttempts >= 3) {
        this.fail(
          `${message} You are exploring alone; the room did not answer.`,
        );
        return;
      }
      getStore().set({
        connecting: true,
        serverNote: "Looking for the room…",
      });
      window.setTimeout(() => void this.hello(), 1400 * this.helloAttempts);
    }
  }

  private startLoops() {
    if (this.started) return;
    this.started = true;
    this.schedulePoll(900);
    this.moveTimer = window.setInterval(() => this.flushMove(), MOVE_MS);
  }

  private stopLoops() {
    this.started = false;
    if (this.pollTimer !== null) window.clearTimeout(this.pollTimer);
    if (this.moveTimer !== null) window.clearInterval(this.moveTimer);
    this.pollTimer = null;
    this.moveTimer = null;
  }

  private schedulePoll(delay = POLL_MS) {
    if (this.closedByUs) return;
    if (this.pollTimer !== null) window.clearTimeout(this.pollTimer);
    this.pollTimer = window.setTimeout(() => void this.poll(), delay);
  }

  private async poll() {
    if (this.closedByUs || this.polling) return;
    this.polling = true;
    try {
      const params = new URLSearchParams({
        room: this.room,
        playerId: this.playerId,
        version: String(this.version),
        chatSince: String(this.chatSince),
      });
      const response = await fetch(`/api/world/room?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => null)) as Snapshot | null;
      if (!response.ok || !data || !data.ok) {
        throw new Error(
          (data as unknown as { error?: string } | null)?.error ??
            `The room returned ${response.status}.`,
        );
      }
      this.pollFailures = 0;
      this.apply(data, false);
      this.schedulePoll();
    } catch (error) {
      this.pollFailures += 1;
      if (this.pollFailures >= 4) {
        this.fail(
          error instanceof Error && error.message
            ? error.message
            : "The room stopped answering. You are exploring alone.",
        );
        return;
      }
      getStore().set({ serverNote: "Reconnecting to the room…" });
      this.schedulePoll(1800);
    } finally {
      this.polling = false;
    }
  }

  private apply(data: Snapshot, initial: boolean) {
    const store = getStore();
    const players = (data.players ?? []).map((player) => ({
      ...player,
      plot: player.plot ?? null,
    }));
    store.set({
      selfId: data.you?.id || this.playerId,
      room: data.room ?? this.room,
      players,
      playerCount: Math.max(1, players.length),
      connected: true,
      connecting: false,
      solo: false,
      serverNote: null,
    });

    if (data.you && data.you.plot !== store.get().identity.plot) {
      store.setIdentity({ plot: data.you.plot });
    }

    if (data.world) {
      const world = data.world;
      const plots = Array.isArray(world.plots)
        ? world.plots
        : Object.values(world.plots ?? {});
      store.set({
        builds: world.builds ?? [],
        plots,
        session: world.session ?? null,
      });
      for (const signal of world.signals ?? []) {
        if (this.seenSignals.has(signal.id)) continue;
        this.seenSignals.add(signal.id);
        if (initial) continue;
        window.dispatchEvent(
          new CustomEvent("cipher-signal", {
            detail: { from: signal.from, to: signal.to },
          }),
        );
      }
      this.version = world.version ?? data.version ?? this.version;
    } else {
      this.version = data.version ?? this.version;
    }

    for (const message of data.chat ?? []) {
      const id = `c-${message.id}`;
      pushChat({
        id,
        kind: "chat",
        from: message.from,
        color: message.color,
        text: message.text,
        where: message.where,
        at: message.at,
      });
      this.chatSince = Math.max(this.chatSince, message.id);
    }

    if (initial) {
      const others = players.filter((player) => player.id !== data.you?.id).length;
      if (others > 0) {
        toast(
          `${others} ${others === 1 ? "member is" : "members are"} here`,
          "Press Tab for the Atlas, or walk to the Axis.",
          "gold",
        );
      }
    }
  }

  private async post(action: string, extra: Record<string, unknown>, chatSince = this.chatSince) {
    const body = {
      room: this.room,
      action,
      player: this.playerPayload(),
      chatSince,
      ...extra,
    };
    const response = await fetch("/api/world/room", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as
      | (Partial<Snapshot> & { ok?: boolean; error?: string; id?: string; chat?: HttpChat[] })
      | null;
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? `The room returned ${response.status}.`);
    }
    return data as unknown as Snapshot;
  }

  private async worldAction(action: string, extra: Record<string, unknown>) {
    if (this.closedByUs) return;
    try {
      const data = await this.post(action, extra);
      this.apply(data, false);
    } catch (error) {
      toast(
        "The room could not do that",
        error instanceof Error ? error.message : "Try again in a moment.",
        "danger",
      );
    }
  }

  private flushMove() {
    if (this.closedByUs || this.moving) return;
    const payload = this.pendingMove;
    if (!payload) return;
    this.pendingMove = null;
    this.moving = true;
    void fetch("/api/world/room", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        room: this.room,
        action: "move",
        player: payload,
      }),
    })
      .catch(() => {
        /* presence is best-effort; the poll will report the room state */
      })
      .finally(() => {
        this.moving = false;
      });
  }

  move(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    mode: "walk" | "fly",
    region: string,
  ) {
    if (this.closedByUs || !this.started) return;
    this.pendingMove = {
      ...this.playerPayload(),
      x,
      y,
      z,
      yaw,
      pitch,
      mode,
      region,
    };
  }

  buildAdd(piece: BuildPiece) {
    void this.worldAction("build:add", { piece });
  }

  buildRemove(id: string) {
    void this.worldAction("build:remove", { id });
  }

  async chat(text: string, where: string) {
    if (this.closedByUs) return;
    try {
      const before = this.chatSince;
      const data = await this.post("chat", { text, where });
      for (const message of data.chat ?? []) {
        pushChat({
          id: `c-${message.id}`,
          kind: "chat",
          from: message.from,
          color: message.color,
          text: message.text,
          where: message.where,
          at: message.at,
        });
        this.chatSince = Math.max(this.chatSince, message.id);
      }
      if (this.chatSince === before) this.schedulePoll(200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again in a moment.";
      if (!message.toLowerCase().includes("one message")) {
        toast("The room could not send that", message, "danger");
      }
    }
  }

  signal(from: [number, number, number], to: [number, number, number]) {
    if (this.closedByUs) return;
    void fetch("/api/world/room", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        room: this.room,
        action: "signal",
        player: this.playerPayload(),
        from,
        to,
      }),
    }).catch(() => {
      /* a signal is a moment, not a queued message */
    });
  }

  emote() {
    /* emotes are not part of the HTTP room protocol yet */
  }

  claimPlot(index: number, title: string, color: string, glyph: string, motto: string) {
    void this.worldAction("plot:claim", { index, title, color, glyph, motto });
  }

  updatePlot(index: number, title: string, color: string, glyph: string, motto: string) {
    void this.worldAction("plot:update", { index, title, color, glyph, motto });
  }

  releasePlot(index: number) {
    void this.worldAction("plot:release", { index });
  }

  startSession(title: string) {
    void this.worldAction("session:start", { title });
  }

  endSession() {
    void this.worldAction("session:end", {});
  }

  setIdentity(name: string, color: string, form: AvatarForm, crest: string) {
    if (this.closedByUs) return;
    getStore().setIdentity({ name, color, form, crest });
    void this.post("hello", {
      player: {
        ...this.playerPayload(),
        name,
        color,
        form,
        crest,
      },
    })
      .then((data) => this.apply(data, false))
      .catch((error) => {
        toast(
          "The room did not see the change",
          error instanceof Error ? error.message : "Your local appearance is unchanged.",
          "danger",
        );
      });
  }

  close() {
    this.closedByUs = true;
    this.stopLoops();
    try {
      void fetch("/api/world/room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({
          room: this.room,
          action: "leave",
          player: this.playerPayload(),
        }),
      });
    } catch {
      /* best effort */
    }
    getStore().set({ connected: false, connecting: false });
  }

  private fail(note: string) {
    this.stopLoops();
    getStore().set({
      connected: false,
      connecting: false,
      solo: true,
      serverNote: note,
    });
  }
}
