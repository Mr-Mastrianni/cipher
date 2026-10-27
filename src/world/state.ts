/**
 * The bridge between the world (imperative, 60 fps) and the interface (React).
 *
 * The engine writes a throttled snapshot here — never per frame — and the UI
 * reads it through `useSyncExternalStore`. Anything that must be live at frame
 * rate (the crosshair, the speed lines, the interaction ring) is drawn by the
 * engine itself, not through React.
 *
 * It is deliberately a single store rather than a context: the engine is not a
 * React tree, it mounts once, and a store survives hot reloads without tearing
 * down a WebGL context and an AudioContext.
 */

import { useSyncExternalStore } from "react";
import type { Attunement } from "./content/world";
import type { SkyPosition } from "./engine/space";

export type Phase = "landing" | "entering" | "playing" | "paused";

export type Panel =
  | "atlas"
  | "chat"
  | "codex"
  | "build"
  | "chart"
  | "learn"
  | "avatar"
  | "plots"
  | "settings"
  | null;

export type AvatarForm = "cloak" | "orb" | "wanderer";

export interface Identity {
  name: string;
  color: string;
  form: AvatarForm;
  crest: string;
  /** The plot this member owns, if any. */
  plot: number | null;
}

export interface RemotePlayer {
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
  region?: string;
  plot?: number | null;
  at: number;
}

export interface BuildPiece {
  id: string;
  type: string;
  material: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  scale: number;
  owner: string;
  ownerName: string;
  /** Set when the piece stands inside a member's terrace plot. */
  plot?: number | null;
  at: number;
}

export interface PlotState {
  index: number;
  owner: string;
  ownerName: string;
  title: string;
  color: string;
  glyph: string;
  motto: string;
  at: number;
}

export type SessionStatus = "scheduled" | "live";

/** One page of the host's notes, shown on the Amphitheatre screen. */
export interface TeachingSlide {
  id: string;
  title: string;
  body: string;
}

export interface SessionState {
  id: string;
  title: string;
  hostId: string;
  host: string;
  /** When the session was created, or when it last went live. */
  at: number;
  /** Older rooms have no status; they are live sessions. */
  status?: SessionStatus;
  /** Scheduled start, in epoch milliseconds. */
  startsAt?: number;
  agenda?: string;
  slides?: TeachingSlide[];
  /** The slide currently on the Amphitheatre screen. */
  slide?: number;
  /** The 2D call this teaching session belongs to. */
  callId?: string;
  callTitle?: string;
}

/** The editable part of a teaching session, sent by the host. */
export interface SessionInput {
  title: string;
  agenda: string;
  startsAt: number;
  slides: TeachingSlide[];
  callId?: string;
  callTitle?: string;
}

/** A 2D call the host can attach a teaching session to. */
export interface TeachingCall {
  id: string;
  title: string;
  startsAt: number;
  durationMinutes: number;
  description: string;
  tierRequired: string | null;
  canJoin: boolean;
  callHref: string;
}

export interface ChatMessage {
  id: string;
  kind: "chat" | "system" | "action";
  from: string;
  color?: string;
  text: string;
  at: number;
  /** The channel: "world" or a Collective room slug. */
  where?: string;
}

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone?: "info" | "gold" | "danger";
}

export interface Settings {
  quality: "auto" | "high" | "balanced" | "low";
  timeOfDay: "dusk" | "void" | "golden";
  sensitivity: number;
  fov: number;
  volume: number;
  ambience: number;
  invertY: boolean;
  reduceMotion: boolean;
  photoMode: boolean;
  subtitles: boolean;
  thirdPerson: boolean;
}

export interface InteractTarget {
  kind: string;
  id: string;
  title: string;
  hint: string;
  action?: string;
}

/** The member's chart, as the server computed it. */
export interface MemberChart {
  label: string;
  place: string;
  grahas: SkyPosition[];
  lagna: number | null;
  lagnaName: string | null;
  definedCentres: string[];
  bodygraphType: string | null;
  bodygraphAuthority: string | null;
  bodygraphProfile: string | null;
  bodygraphChannels: number;
  dasha: string | null;
}

export interface WorldState {
  phase: Phase;
  ready: boolean;
  error: string | null;
  assetsProgress: number;

  connected: boolean;
  connecting: boolean;
  solo: boolean;
  serverNote: string | null;
  room: string;
  selfId: string;
  ping: number;

  identity: Identity;
  settings: Settings;

  players: RemotePlayer[];
  playerCount: number;

  builds: BuildPiece[];
  buildMode: boolean;
  buildPiece: string;
  buildMaterial: string;
  buildRotate: number;
  buildScale: number;
  hoverBuild: string | null;
  insidePlot: number | null;

  plots: PlotState[];
  session: SessionState | null;

  mode: "walk" | "fly";
  position: [number, number, number];
  speed: number;
  altitude: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  pointerLocked: boolean;
  touch: boolean;
  region: string;
  regionTitle: string;
  regionSub: string;
  fps: number;
  jumps: number;
  inSpace: boolean;
  inWater: boolean;

  target: InteractTarget | null;
  attunement: (Attunement & { level: number }) | null;

  panel: Panel;
  chatOpen: boolean;
  chatRoom: string;
  chat: ChatMessage[];
  feed: ChatMessage[];
  unread: number;
  toast: Toast | null;

  sky: { positions: SkyPosition[]; updatedAt: number };
  chart: MemberChart | null;
  chartFocus: string | null;
  codexTab: "grahas" | "nakshatras" | "centres" | "places" | "controls";
  learnTrack: string | null;

  signalCharge: number;
  signalReady: boolean;
  inBuildZone: "studio" | "plot" | null;
  plotDraft: number | null;
}

const STORAGE_KEY = "cipher:world:identity";
const SETTINGS_KEY = "cipher:world:settings";

function readIdentity(seed: { name?: string; color?: string }): Identity {
  const fallback: Identity = {
    name: seed.name || "A traveller",
    color: seed.color || "#d4ff3f",
    form: "cloak",
    crest: "\u2726",
    plot: null,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    return {
      name: parsed.name || fallback.name,
      color: parsed.color || fallback.color,
      form:
        parsed.form === "orb" || parsed.form === "wanderer" || parsed.form === "cloak"
          ? parsed.form
          : "cloak",
      crest: parsed.crest || fallback.crest,
      plot: typeof parsed.plot === "number" ? parsed.plot : null,
    };
  } catch {
    return fallback;
  }
}

function readSettings(): Settings {
  const fallback: Settings = {
    quality: "auto",
    timeOfDay: "dusk",
    sensitivity: 1,
    fov: 76,
    volume: 0.7,
    ambience: 0.6,
    invertY: false,
    reduceMotion: false,
    photoMode: false,
    subtitles: true,
    thirdPerson: false,
  };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { ...fallback, reduceMotion: reduced };
    }
    return { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return fallback;
  }
}

function createState(seed: { name?: string; color?: string }): WorldState {
  const identity = readIdentity(seed);
  const settings = readSettings();
  return {
    phase: "landing",
    ready: false,
    error: null,
    assetsProgress: 0,

    connected: false,
    connecting: false,
    solo: false,
    serverNote: null,
    room: "the-cipher",
    selfId: "",
    ping: 0,

    identity,
    settings,

    players: [],
    playerCount: 1,

    builds: [],
    buildMode: false,
    buildPiece: "plinth",
    buildMaterial: "cipher",
    buildRotate: 0,
    buildScale: 1,
    hoverBuild: null,
    insidePlot: null,

    plots: [],
    session: null,

    mode: "walk",
    position: [0, 24, 48],
    speed: 0,
    altitude: 0,
    yaw: 0,
    pitch: 0,
    grounded: true,
    pointerLocked: false,
    touch: false,
    region: "Arrivals",
    regionTitle: "The Cipher",
    regionSub: "a world for the Collective",
    fps: 60,
    jumps: 0,
    inSpace: false,
    inWater: false,

    target: null,
    attunement: null,

    panel: null,
    chatOpen: false,
    chatRoom: "commons",
    chat: [],
    feed: [],
    unread: 0,
    toast: null,

    sky: { positions: [], updatedAt: 0 },
    chart: null,
    chartFocus: null,
    codexTab: "grahas",
    learnTrack: null,

    signalCharge: 0,
    signalReady: true,
    inBuildZone: null,
    plotDraft: null,
  };
}

type Listener = () => void;

class WorldStore {
  private state: WorldState;
  private listeners = new Set<Listener>();

  constructor(seed: { name?: string; color?: string }) {
    this.state = createState(seed);
  }

  get = (): WorldState => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set = (patch: Partial<WorldState>) => {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof WorldState)[]) {
      if (!Object.is(this.state[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  };

  update = (fn: (state: WorldState) => Partial<WorldState>) => {
    const patch = fn(this.state);
    if (patch && Object.keys(patch).length > 0) this.set(patch);
  };

  setIdentity = (patch: Partial<Identity>) => {
    const identity = { ...this.state.identity, ...patch };
    this.set({ identity });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } catch {
      /* storage may be blocked; the session still works */
    }
  };

  setSettings = (patch: Partial<Settings>) => {
    const settings = { ...this.state.settings, ...patch };
    this.set({ settings });
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be blocked */
    }
  };
}

let storeSingleton: WorldStore | null = null;

export function getStore(seed?: { name?: string; color?: string }): WorldStore {
  if (!storeSingleton) storeSingleton = new WorldStore(seed ?? {});
  return storeSingleton;
}

export function useRealm(): WorldState {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ── small side-effect helpers used by the engine and the UI ─────────────── */

let toastId = 0;

export function toast(title: string, detail?: string, tone: Toast["tone"] = "info") {
  const store = getStore();
  const id = ++toastId;
  store.set({ toast: { id, title, detail, tone } });
  window.setTimeout(() => {
    if (store.get().toast?.id === id) store.set({ toast: null });
  }, 6200);
}

let messageId = 0;

export function pushChat(message: Omit<ChatMessage, "id"> & { id?: string }) {
  const store = getStore();
  const id = message.id ?? `m${++messageId}`;
  if (store.get().chat.some((existing) => existing.id === id)) return;
  const item: ChatMessage = { ...message, id };
  const chat = [...store.get().chat, item].slice(-160);
  const feed = [...store.get().feed, item].slice(-40);
  store.update((state) => ({
    chat,
    feed,
    unread: state.chatOpen ? 0 : Math.min(99, state.unread + (message.kind === "chat" ? 1 : 0)),
  }));
}

export function pushSystem(text: string, where = "world") {
  pushChat({ kind: "system", from: "The Cipher", text, at: Date.now(), where });
}

export function openPanel(panel: Panel) {
  const store = getStore();
  const state = store.get();
  store.set({
    panel,
    chatOpen: panel === "chat",
    unread: panel === "chat" ? 0 : state.unread,
  });
}

export function closePanel() {
  getStore().set({ panel: null, chatOpen: false });
}

/**
 * One-time migration of the old seeded identity: if the site passes a display
 * name, prefer it over the generic "A traveller" the very first visit stores.
 */
export function seedIdentity(seed: { name?: string; color?: string }) {
  const store = getStore();
  const current = store.get().identity;
  if (current.name === "A traveller" && seed.name) {
    store.setIdentity({ name: seed.name });
  }
  if (seed.color) store.setIdentity({ color: seed.color });
}
