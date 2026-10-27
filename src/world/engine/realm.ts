/**
 * The world, running.
 *
 * This is the only place where the pieces meet: the body, the camera, the light,
 * the hand that sends a signal, the shared bench, the other members, and the
 * interface on the other side of a small, throttled store. The physics is
 * deliberately legible — a capsule against one height function, with flight as a
 * second mode rather than a second body — because the point of the place is to
 * move through it, not to fight it.
 *
 *   walk      10.5 m/s, sprint 28 m/s, four air jumps, 20 m/s launch
 *   fly       62 m/s, sprint 132 m/s, no gravity, Space/Ctrl for altitude
 *   space     the same body; at 1,800 m the Sky Wheel is flown, not walked
 */

import * as THREE from "three";
import { loadAssets } from "./textures";
import { createWorld } from "./world";
import type { Interactable, World } from "./world";
import { PostFX } from "./post";
import type { PostQuality } from "./post";
import { LightningSystem } from "./lightning";
import { BuildSystem } from "./build";
import { AvatarField } from "./avatars";
import { audio } from "./audio";
import { connectNet } from "../net/client";
import type { RoomTransport } from "../net/types";
import {
  getStore,
  toast,
  pushSystem,
  type Settings,
} from "../state";
import { onCommand } from "./bus";
import type { RealmCommand } from "./bus";
import { LAKE, SPAWN, SUN_DIR, WORLD, heightAt } from "./terrain";
import {
  ATTUNEMENTS,
  BUILD_MATERIALS,
  BUILD_PIECES,
  PLACES,
  PLOTS,
  REGIONS,
} from "../content/world";
import type { MemberChart, PlotState, SessionState } from "../state";
import { SPACE_Y, type SkyPosition } from "./space";

const EYE = 1.72;
const RADIUS = 0.42;
const GRAVITY = 28;
const WALK = 10.5;
const RUN = 28;
const JUMP = 20;
const AIR_JUMP = 18;
const MAX_JUMPS = 4;
const FLY = 62;
const FLY_FAST = 132;

type Quality = "high" | "balanced" | "low";

interface PlayerState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  mode: "walk" | "fly";
  onGround: boolean;
  jumpsUsed: number;
  coyote: number;
  jumpBuffer: number;
  charging: boolean;
  charge: number;
  cooldown: number;
  bob: number;
  landing: number;
  shake: number;
  roll: number;
  wasWater: boolean;
  inWater: boolean;
  spaceWarned: boolean;
}

function resolveQuality(q: Settings["quality"]): Quality {
  const forced = new URLSearchParams(location.search).get("quality");
  if (forced === "high" || forced === "balanced" || forced === "low") return forced;
  if (q !== "auto") return q;
  try {
    if (matchMedia("(pointer: coarse)").matches) return innerWidth < 900 ? "low" : "balanced";
  } catch {
    /* no matchMedia */
  }
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  return cores >= 6 && mem >= 4 ? "high" : "balanced";
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

function touchDevice() {
  try {
    return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  } catch {
    return false;
  }
}

function roomName() {
  const params = new URLSearchParams(location.search);
  return (
    params.get("room") ??
    process.env.NEXT_PUBLIC_WORLD_ROOM ??
    "the-cipher"
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 40) || "the-cipher";
}

export class Realm {
  canvas: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  post!: PostFX;
  world!: World;
  lightning!: LightningSystem;
  build!: BuildSystem;
  avatars!: AvatarField;
  net: RoomTransport | null = null;
  ready = false;

  private sky: SkyPosition[];
  private chart: MemberChart | null;

  private player: PlayerState = {
    pos: new THREE.Vector3(SPAWN.x, 24, SPAWN.z),
    vel: new THREE.Vector3(),
    yaw: SPAWN.yaw,
    pitch: -0.04,
    mode: "walk",
    onGround: true,
    jumpsUsed: 0,
    coyote: 0,
    jumpBuffer: 0,
    charging: false,
    charge: 0,
    cooldown: 0,
    bob: 0,
    landing: 0,
    shake: 0,
    roll: 0,
    wasWater: false,
    inWater: false,
    spaceWarned: false,
  };

  private keys = new Set<string>();
  private time = 0;
  private last = performance.now() / 1000;
  private fps = 60;
  private hudAt = 0;
  private targetAt = 0;
  private regionId = "";
  private lastPublish = 0;
  private started = false;
  private lastPanel: string | null = null;
  private currentTarget: Interactable | null = null;
  private cameraForward = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private centre = new THREE.Vector2(0, 0);
  private lastSettings: Settings;
  private quality: Quality;
  private flashEl: HTMLDivElement;
  private waterEl: HTMLDivElement;
  private speedEl: HTMLDivElement;
  private lastQuality: Settings["quality"];
  private lastTimeOfDay: Settings["timeOfDay"];
  private lastVolume = -1;
  private lastFov = 0;
  private onCommandOff: (() => void) | null = null;
  private dragging = false;
  private lastMouse = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;
  private touch = false;
  private touchMove = { x: 0, y: 0 };
  private touchSprint = false;
  private touchAscend = false;
  private noPost = false;
  private wantsStart = false;
  private lastPlotsKey = "";
  private lastSessionKey = "";
  private lastAttunementKey = "";
  private frameId = 0;

  constructor(
    canvas: HTMLCanvasElement,
    options: { sky: SkyPosition[]; chart: MemberChart | null },
  ) {
    this.canvas = canvas;
    this.sky = options.sky;
    this.chart = options.chart;
    this.lastSettings = getStore().get().settings;
    this.quality = resolveQuality(this.lastSettings.quality);
    this.lastQuality = this.lastSettings.quality;
    this.lastTimeOfDay = this.lastSettings.timeOfDay;
    this.flashEl = document.createElement("div");
    this.flashEl.className = "world-flash";
    this.waterEl = document.createElement("div");
    this.waterEl.className = "world-water";
    this.speedEl = document.createElement("div");
    this.speedEl.className = "world-speed";
    document.body.append(this.flashEl, this.waterEl, this.speedEl);
  }

  async init() {
    const forcedTime = new URLSearchParams(location.search).get("time");
    if (forcedTime === "dusk" || forcedTime === "void" || forcedTime === "golden") {
      getStore().setSettings({ timeOfDay: forcedTime });
    }
    const s = getStore().get().settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x05020c, 1);
    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      console.warn("[world] WebGL context lost");
    });
    this.canvas.addEventListener("webglcontextrestored", () =>
      console.warn("[world] WebGL context restored"),
    );

    this.camera = new THREE.PerspectiveCamera(
      s.fov,
      window.innerWidth / window.innerHeight,
      0.08,
      30000,
    );
    this.camera.rotation.order = "YXZ";
    this.onResize();

    const assets = await loadAssets(this.renderer, (p) =>
      getStore().set({ assetsProgress: p }),
    );
    if (this.destroyed) return;
    this.world = createWorld(this.scene, assets, this.quality, this.sky, this.chart);
    this.world.setTimeOfDay(s.timeOfDay);
    this.noPost =
      this.quality === "low" ||
      new URLSearchParams(location.search).get("post") === "0";
    this.ensurePost();
    this.lightning = new LightningSystem(this.scene, this.camera);
    this.build = new BuildSystem(this.scene, null);
    this.avatars = new AvatarField(this.scene);

    this.placeLandingCamera();
    this.bind();
    this.ready = true;
    this.touch = touchDevice();
    getStore().set({ touch: this.touch, pointerLocked: false });
    (globalThis as unknown as { cipherRealm: Realm }).cipherRealm = this;
    (globalThis as unknown as { THREE: typeof THREE }).THREE = THREE;
    getStore().set({ ready: true, assetsProgress: 1 });

    this.last = performance.now() / 1000;
    // Diagnostic: create the whole world but do not start the frame loop.
    if (new URLSearchParams(location.search).get("freeze") !== "1") this.loop();
    if (this.wantsStart) this.start();
  }

  /* ── lifecycle ──────────────────────────────────────────────────────────── */

  start() {
    if (this.started) return;
    if (!this.ready) {
      // The landing screen is alive before the valley is. A click here is an
      // intention, not a no-op: remember it and enter as soon as the world opens.
      this.wantsStart = true;
      toast("Opening the world", "The valley is still loading. You will enter as soon as it is ready.", "info");
      return;
    }
    this.started = true;
    const store = getStore();
    store.set({ phase: "playing" });
    this.touch = touchDevice();
    store.set({ touch: this.touch });

    const side = (Math.random() - 0.5) * 4;
    const x = SPAWN.x + side;
    const z = SPAWN.z + 2;
    this.player.pos.set(x, this.world.surfaceAt(x, z, 40) + 0.05, z);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = SPAWN.yaw;
    this.player.pitch = -0.03;
    this.player.mode = "walk";
    this.player.jumpsUsed = 0;
    this.player.spaceWarned = false;
    this.regionId = "";
    this.canvas.tabIndex = 0;
    this.canvas.focus();

    // Do not capture the mouse on entry. The HUD is meant to be clicked, and a
    // page that hides the cursor before the member has chosen to look is
    // hostile. The first click on the view captures it; Esc releases it.
    if (!this.touch) {
      toast("Click the view to look", "The interface stays clickable until you do. Esc releases the mouse again.", "info");
    }

    this.net = connectNet(roomName());
    this.build.setNet(this.net);

    void audio
      .start()
      .then(() => {
        audio.setVolume(store.get().settings.volume);
        audio.setAmbience(store.get().settings.ambience);
        audio.chime(392, 0.04);
      })
      .catch((error) => {
        console.warn("[world] audio could not start", error);
        toast("Sound is unavailable", "The world still moves; check the browser's audio permission.", "info");
      });

    toast(
      "You are in the Cipher",
      this.touch
        ? "Left stick to move · drag the view to look · the buttons on the right are jump, fly, signal, build and use."
        : "WASD to move · Space to jump · F to fly · E to use · Tab for the Atlas. If the mouse does not capture, click the view or use the arrow keys.",
      "gold",
    );
    this.updateAimTarget(true);
  }

  resume() {
    getStore().set({ phase: "playing" });
    if (!touchDevice()) {
      toast("Back in the world", "Click the view to capture the mouse; Esc releases it for the interface.", "info");
    }
  }

  private lockPointer() {
    if (this.touch || document.pointerLockElement === this.canvas) return;
    try {
      this.canvas.requestPointerLock?.();
    } catch {
      /* the HUD offers click / drag / arrow-key fallbacks */
    }
  }

  /* ── input ──────────────────────────────────────────────────────────────── */

  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", () =>
      toast("Pointer lock was blocked", "Click the view to look around, or use the arrow keys.", "danger"),
    );
    this.onCommandOff = onCommand((cmd) => this.handleCommand(cmd));
    window.addEventListener("cipher-signal", this.onRemoteSignal);

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.canvas);
    }
  }

  private isModal() {
    return Boolean(getStore().get().panel);
  }

  private inputBlocked(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    return (
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable === true
    );
  }

  private onRemoteSignal = (event: Event) => {
    const detail = (event as CustomEvent<{ from: number[]; to: number[] }>).detail;
    if (!detail?.from || !detail?.to) return;
    const from = new THREE.Vector3(detail.from[0], detail.from[1], detail.from[2]);
    const to = new THREE.Vector3(detail.to[0], detail.to[1], detail.to[2]);
    this.lightning.strike(from, to, { remote: true, power: 0.8 });
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.started) return;
    if (event.code === "Escape") {
      if (this.isModal()) {
        getStore().set({ panel: null, chatOpen: false });
        event.preventDefault();
      } else if (document.pointerLockElement) {
        document.exitPointerLock();
      } else {
        getStore().set({ phase: "paused" });
      }
      return;
    }
    if (this.inputBlocked(event)) return;
    if (event.code === "Tab") event.preventDefault();
    if (event.code === "Space") event.preventDefault();
    if (event.code.startsWith("Arrow")) event.preventDefault();

    if (event.code === "KeyF" && !event.repeat) {
      this.toggleFly();
      return;
    }
    if (event.code === "KeyB" && !event.repeat) {
      getStore().set({ buildMode: !getStore().get().buildMode });
      return;
    }
    if (event.code === "KeyE" && !event.repeat) {
      this.interact();
      return;
    }
    if (event.code === "KeyQ" && !event.repeat) {
      this.fire(0.72);
      return;
    }
    if (event.code === "KeyV" && !event.repeat) {
      this.toggleThirdPerson();
      return;
    }
    if (event.code === "KeyT" && !event.repeat) {
      if (!this.isModal()) {
        getStore().set({ panel: "chat", chatOpen: true, unread: 0 });
        document.exitPointerLock();
      }
      return;
    }
    if (event.code === "KeyJ" && !event.repeat) {
      getStore().set({
        panel: getStore().get().panel === "codex" ? null : "codex",
        chatOpen: false,
      });
      document.exitPointerLock();
      return;
    }
    if (event.code === "KeyL" && !event.repeat) {
      getStore().set({
        panel: getStore().get().panel === "learn" ? null : "learn",
        chatOpen: false,
      });
      document.exitPointerLock();
      return;
    }
    if (event.code === "KeyC" && !event.repeat) {
      getStore().set({
        panel: getStore().get().panel === "chart" ? null : "chart",
        chatOpen: false,
      });
      document.exitPointerLock();
      return;
    }
    if (event.code === "Tab" && !event.repeat) {
      getStore().set({
        panel: getStore().get().panel === "atlas" ? null : "atlas",
        chatOpen: false,
      });
      document.exitPointerLock();
      return;
    }
    if (event.code === "KeyP" && !event.repeat) {
      this.togglePhoto();
      return;
    }
    if (event.code === "KeyR" && !event.repeat && getStore().get().buildMode) {
      getStore().set({ buildRotate: getStore().get().buildRotate + Math.PI / 12 });
      return;
    }
    if ((event.code === "BracketLeft" || event.code === "BracketRight") && getStore().get().buildMode) {
      const current = BUILD_MATERIALS.findIndex((m) => m.id === getStore().get().buildMaterial);
      const next =
        (current + (event.code === "BracketRight" ? 1 : -1) + BUILD_MATERIALS.length) %
        BUILD_MATERIALS.length;
      getStore().set({ buildMaterial: BUILD_MATERIALS[next].id });
      return;
    }
    if ((event.code === "Minus" || event.code === "Equal") && getStore().get().buildMode) {
      getStore().set({
        buildScale: clamp(getStore().get().buildScale + (event.code === "Equal" ? 0.1 : -0.1), 0.4, 4),
      });
      return;
    }
    if (event.code.startsWith("Digit") && getStore().get().buildMode) {
      const n = Number(event.code.slice(5));
      const index = n === 0 ? 9 : n - 1;
      if (BUILD_PIECES[index]) getStore().set({ buildPiece: BUILD_PIECES[index].id });
      return;
    }
    if (event.code === "KeyX" && getStore().get().buildMode) {
      const hover = getStore().get().hoverBuild;
      if (hover) this.build.remove(hover);
      return;
    }
    if (event.code === "Space" && !event.repeat) this.player.jumpBuffer = 0.16;
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.player.charging = false;
    audio.charge(0);
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.started) return;
    const settings = getStore().get().settings;
    const sens = 0.0021 * settings.sensitivity;
    if (document.pointerLockElement === this.canvas) {
      this.player.yaw -= event.movementX * sens;
      this.player.pitch -= event.movementY * sens * (settings.invertY ? -1 : 1);
      this.player.pitch = clamp(this.player.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    } else if (this.dragging && !this.isModal() && getStore().get().phase === "playing") {
      this.player.yaw -= (event.clientX - this.lastMouse.x) * sens;
      this.player.pitch -= (event.clientY - this.lastMouse.y) * sens * (settings.invertY ? -1 : 1);
      this.player.pitch = clamp(this.player.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
      this.lastMouse = { x: event.clientX, y: event.clientY };
    }
  };

  private onMouseDown = (event: MouseEvent) => {
    if (!this.started || getStore().get().phase !== "playing") return;
    if (this.touch) {
      if (getStore().get().buildMode && event.button === 0) this.placeBuild();
      return;
    }
    if (document.pointerLockElement !== this.canvas) {
      this.dragging = true;
      this.lastMouse = { x: event.clientX, y: event.clientY };
      if (!this.isModal()) this.lockPointer();
      return;
    }
    if (this.isModal()) return;
    if (event.button === 0) {
      if (getStore().get().buildMode) this.placeBuild();
      else {
        this.player.charging = true;
        this.player.charge = 0;
      }
    } else if (event.button === 2 && getStore().get().buildMode) {
      const aim = this.aimBuildPoint();
      if (aim?.buildId) this.build.remove(aim.buildId);
    }
  };

  private onMouseUp = (event: MouseEvent) => {
    this.dragging = false;
    if (event.button !== 0) return;
    if (this.player.charging) {
      const power = 0.45 + this.player.charge * 0.55;
      this.player.charging = false;
      if (this.player.cooldown <= 0) this.fire(power);
      this.player.charge = 0;
      this.player.cooldown = 0.32;
    }
  };

  private onWheel = (event: WheelEvent) => {
    if (!getStore().get().buildMode) return;
    event.preventDefault();
    getStore().set({
      buildScale: clamp(getStore().get().buildScale - Math.sign(event.deltaY) * 0.1, 0.4, 4),
    });
  };

  private onPointerLockChange = () => {
    if (!this.started) return;
    const locked = document.pointerLockElement === this.canvas;
    getStore().set({ pointerLocked: locked });
    if (locked) return;
    // Losing the pointer is not the same as pausing. Panels, browser permission
    // prompts and a deliberate Esc all release it; the world should keep running
    // behind them. Pausing is explicit (Esc, or the Atlas).
    this.player.charging = false;
    audio.charge(0);
  };

  /** Build the post chain on demand; low quality and `?post=0` render direct. */
  private ensurePost() {
    if (this.noPost) {
      this.post?.dispose();
      this.post = undefined as unknown as PostFX;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      return;
    }
    if (!this.post) {
      this.post = new PostFX(this.renderer, this.scene, this.camera, this.quality as PostQuality);
      this.post.setSize(window.innerWidth, window.innerHeight);
    } else {
      this.post.setQuality(this.quality as PostQuality);
    }
  }

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.post) this.post.setSize(w, h);
  };

  /* ── commands from the interface ────────────────────────────────────────── */

  private handleCommand(cmd: RealmCommand) {
    switch (cmd.type) {
      case "enter":
        void this.start();
        break;
      case "resume":
        this.resume();
        break;
      case "travel":
        this.travel(cmd.id);
        break;
      case "teleport":
        this.player.pos.set(
          cmd.x,
          cmd.y ?? this.world.surfaceAt(cmd.x, cmd.z, 400) + 0.05,
          cmd.z,
        );
        this.player.vel.set(0, 0, 0);
        if (cmd.fly) this.player.mode = "fly";
        this.player.onGround = false;
        this.regionId = "";
        this.lastAttunementKey = "";
        getStore().set({ attunement: null, regionTitle: cmd.label ?? "The Cipher", regionSub: "a world for the Collective" });
        if (cmd.label) toast(cmd.label, "The Cipher is still here.", "gold");
        break;
      case "build-toggle":
        getStore().set({ buildMode: cmd.on ?? !getStore().get().buildMode });
        break;
      case "select-piece":
        getStore().set({ buildPiece: cmd.id });
        break;
      case "select-material":
        getStore().set({ buildMaterial: cmd.id });
        break;
      case "rotate":
        getStore().set({ buildRotate: getStore().get().buildRotate + Math.PI / 12 });
        break;
      case "scale":
        getStore().set({
          buildScale: clamp(getStore().get().buildScale + cmd.delta, 0.4, 4),
        });
        break;
      case "time":
        getStore().setSettings({ timeOfDay: cmd.value });
        break;
      case "quality":
        getStore().setSettings({ quality: cmd.value });
        break;
      case "photo":
        this.togglePhoto();
        break;
      case "fire":
        this.fire(0.8);
        break;
      case "fly-toggle":
        if (typeof cmd.on === "boolean") {
          this.player.mode = cmd.on ? "fly" : "walk";
          getStore().set({ mode: this.player.mode });
        } else this.toggleFly();
        break;
      case "use":
        this.interact();
        break;
      case "third-person":
        getStore().setSettings({
          thirdPerson:
            typeof cmd.on === "boolean"
              ? cmd.on
              : !getStore().get().settings.thirdPerson,
        });
        break;
      case "session-start":
        this.net?.startSession(
          cmd.session ??
            (cmd.title
              ? {
                  title: cmd.title.trim().slice(0, 80) || "An open session",
                  agenda: "",
                  startsAt: Date.now(),
                  slides: [],
                }
              : undefined),
        );
        break;
      case "session-schedule":
        this.net?.scheduleSession(cmd.session);
        break;
      case "session-update":
        this.net?.updateSession(cmd.session);
        break;
      case "session-slide":
        this.net?.setSessionSlide(cmd.index);
        break;
      case "session-end":
        this.net?.endSession();
        break;
      case "reconnect":
        this.net?.reconnect();
        break;
      case "touch-move":
        this.touchMove = { x: cmd.x, y: cmd.y };
        break;
      case "touch-sprint":
        this.touchSprint = cmd.on;
        break;
      case "touch-look":
        this.player.yaw -= cmd.dx;
        this.player.pitch = clamp(this.player.pitch - cmd.dy, -1.5, 1.5);
        break;
      case "touch-jump":
        this.player.jumpBuffer = 0.16;
        break;
      case "touch-ascend":
        this.touchAscend = cmd.on;
        break;
      case "touch-fire":
        this.fire(0.8);
        break;
      case "touch-use":
        this.interact();
        break;
      case "touch-place":
        this.placeBuild();
        break;
      case "touch-remove":
        this.removeLookedAtBuild();
        break;
      case "resize":
        this.onResize();
        break;
      case "chat": {
        this.net?.chat(cmd.text, cmd.where);
        break;
      }
      case "identity": {
        const store = getStore();
        store.setIdentity({
          name: cmd.name,
          color: cmd.color,
          form: cmd.form,
          crest: cmd.crest,
        });
        this.net?.setIdentity(cmd.name, cmd.color, cmd.form, cmd.crest);
        break;
      }
      case "plot-claim": {
        const store = getStore();
        store.setIdentity({ plot: cmd.index });
        this.net?.claimPlot(
          cmd.index,
          cmd.title,
          cmd.color,
          cmd.glyph,
          cmd.motto,
        );
        break;
      }
      case "plot-update":
        this.net?.updatePlot(cmd.index, cmd.title, cmd.color, cmd.glyph, cmd.motto);
        break;
      case "plot-release":
        this.net?.releasePlot(cmd.index);
        break;
      default:
        break;
    }
  }

  private travel(id: string) {
    const store = getStore();
    if (id === "space") {
      this.player.pos.set(0, SPACE_Y + 520, 0);
      this.player.vel.set(0, 0, 0);
      this.player.mode = "fly";
      this.player.pitch = -0.44;
      this.player.spaceWarned = true;
      getStore().set({ attunement: null });
      this.lastAttunementKey = "";
      toast("The Sky Wheel", "There is no floor here. Fly with WASD, Space and Ctrl.", "gold");
      return;
    }
    const spot: Record<string, [number, number, number?]> = {
      axis: [0, 30],
      observatory: [0, -140],
      amphitheatre: [-140, 22],
      studio: [140, 30],
      sanctuary: [112, -160],
      terraces: [-188, -36],
      commons: [0, 126],
      lake: [-236, 126],
      skygate: [0, -250],
    };
    const target = spot[id];
    if (!target) return;
    const [x, z] = target;
    const y = this.world.surfaceAt(x, z, 400) + 0.05;
    this.player.pos.set(x, y, z);
    this.player.vel.set(0, 0, 0);
    this.player.mode = "walk";
    this.player.onGround = true;
    this.regionId = "";
    const place = PLACES.find((p) => p.id === id);
    if (place) {
      this.player.yaw = Math.atan2(-(place.x - x), -(place.z - z));
      this.player.pitch = -0.03;
      toast(place.name, place.kicker, "gold");
      store.set({
        region: place.id,
        regionTitle: place.name,
        regionSub: place.kicker,
      });
    }
    store.set({ panel: null, chatOpen: false, attunement: null });
    this.lastAttunementKey = "";
  }

  private toggleFly() {
    const next = this.player.mode === "walk" ? "fly" : "walk";
    this.player.mode = next;
    if (next === "fly") {
      this.player.vel.y = Math.max(this.player.vel.y, 6);
      toast("Flight", "Space and Ctrl for altitude · Shift to race · F to land.", "info");
    }
    getStore().set({ mode: next });
  }

  private toggleThirdPerson() {
    const next = !getStore().get().settings.thirdPerson;
    getStore().setSettings({ thirdPerson: next });
    toast(next ? "Third person" : "First person", next ? "You can see your avatar. V to switch back." : "Back behind your own eyes.", "info");
  }

  private togglePhoto() {
    const next = !getStore().get().settings.photoMode;
    getStore().setSettings({ photoMode: next });
    if (next) toast("Photo mode", "The interface is hidden. Press P to bring it back.", "info");
  }

  /* ── interaction ────────────────────────────────────────────────────────── */

  private updateAimTarget(force = false) {
    const now = performance.now();
    if (!force && now - this.targetAt < 110) return;
    this.targetAt = now;
    const store = getStore();
    const player = this.player.pos;
    this.camera.getWorldDirection(this.cameraForward);
    let best: Interactable | null = null;
    let bestScore = Infinity;
    for (const item of this.world.interactables) {
      const dx = item.position.x - player.x;
      const dy = item.position.y - (player.y + 1.4);
      const dz = item.position.z - player.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > item.radius) continue;
      const dot = (dx * this.cameraForward.x + dz * this.cameraForward.z) / Math.max(1, Math.hypot(dx, dz));
      // Large places are useable from anywhere inside them; a graha or a stone
      // still has to be looked at.
      if (dist > 4 && dot < 0.1 && item.radius < 14) continue;
      const score = dist + (1 - Math.max(0, dot)) * 8;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    this.currentTarget = best;
    if (best) {
      store.set({
        target: {
          kind: best.kind,
          id: best.id,
          title: best.title,
          hint: best.hint,
          action: best.action,
        },
      });
    } else if (store.get().target) {
      store.set({ target: null });
    }
  }

  private interact() {
    const target = this.currentTarget;
    if (!target) {
      toast("Nothing to use here", "Look for a place, a stone, a graha or a banner.", "info");
      return;
    }
    const store = getStore();
    document.exitPointerLock();
    switch (target.kind) {
      case "axis":
        store.set({ panel: "codex", codexTab: "grahas", chatOpen: false });
        break;
      case "observatory":
        store.set({ panel: "chart", chatOpen: false });
        break;
      case "amphitheatre":
        store.set({ panel: "learn", chatOpen: false });
        toast("The floor", store.get().session ? "A session is live. Join it from the panel." : "Press Take the floor to teach the room.", "info");
        break;
      case "studio":
        store.set({ panel: "build", buildMode: true, chatOpen: false });
        break;
      case "sanctuary": {
        const nearest = audio.nearestAttunement(this.player.pos.x, this.player.pos.y, this.player.pos.z);
        if (nearest && nearest.level > 0.02) {
          audio.chime(nearest.mantra.root, 0.05);
          toast(nearest.mantra.title, nearest.mantra.meaning, "gold");
        } else {
          store.set({ panel: "codex", codexTab: "grahas", chatOpen: false });
        }
        break;
      }
      case "terraces":
        store.set({ panel: "plots", plotDraft: null, chatOpen: false });
        break;
      case "plot":
        store.set({ panel: "plots", plotDraft: Number(target.id), chatOpen: false });
        break;
      case "commons":
        store.set({ panel: "chat", chatOpen: true, chatRoom: target.id, unread: 0 });
        break;
      case "lake":
        toast("The Lake of Mirrors", "The far shore keeps one stone. The water doubles the sky at dusk.", "info");
        store.set({ panel: "codex", codexTab: "places", chatOpen: false });
        break;
      case "skygate":
        this.player.mode = "fly";
        this.player.pos.y += 140;
        this.player.vel.set(0, 30, 0);
        store.set({ mode: "fly" });
        toast("The gate opens", "Fly north and up. The Sky Wheel is at 1,800 metres.", "gold");
        break;
      case "graha":
        store.set({ panel: "codex", codexTab: "grahas", chartFocus: target.id, chatOpen: false });
        break;
      case "nakshatra":
        store.set({ panel: "codex", codexTab: "nakshatras", chartFocus: target.id, chatOpen: false });
        break;
      case "centre":
        store.set({ panel: "codex", codexTab: "centres", chartFocus: target.id, chatOpen: false });
        break;
      default:
        break;
    }
  }

  /* ── build ──────────────────────────────────────────────────────────────── */

  private aimBuildPoint(): { point: THREE.Vector3; buildId?: string } | null {
    if (this.world.spaceBlend > 0.4) return null;
    this.raycaster.setFromCamera(this.centre, this.camera);
    this.raycaster.far = 40;
    const picked = this.build.pick(this.raycaster);
    if (picked) return { point: picked.point.clone(), buildId: picked.id };
    const hits = this.raycaster.intersectObject(this.world.terrain, false);
    if (hits.length > 0) {
      const point = hits[0].point.clone();
      if (this.camera.position.distanceTo(point) > 18) return null;
      point.y = this.world.surfaceAt(point.x, point.z, point.y);
      return { point };
    }
    // Fall back to a ground march along the view ray, for glancing angles.
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    for (let t = 1; t < 18; t += 0.5) {
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const y = origin.y + dir.y * t;
      const ground = this.world.surfaceAt(x, z, y);
      if (y <= ground + 0.15) {
        return { point: new THREE.Vector3(x, ground, z) };
      }
    }
    return null;
  }

  private updateBuild() {
    const store = getStore();
    if (!store.get().buildMode) {
      this.build.hideGhost();
      if (store.get().hoverBuild) store.set({ hoverBuild: null });
      return;
    }
    const aim = this.aimBuildPoint();
    if (!aim) {
      this.build.hideGhost();
      return;
    }
    const point = aim.point;
    const plot = this.build.plotAt(point.x, point.z);
    const studio = Math.hypot(point.x - 150, point.z - 36) < 16.5;
    const mine = plot !== null && store.get().identity.plot === plot;
    const valid = studio || mine;
    const inZone = studio ? "studio" : mine ? "plot" : null;
    if (store.get().inBuildZone !== inZone) store.set({ inBuildZone: inZone });
    const snap = new THREE.Vector3(
      Math.round(point.x * 2) / 2,
      this.world.surfaceAt(point.x, point.z, point.y),
      Math.round(point.z * 2) / 2,
    );
    this.build.setGhost(
      store.get().buildPiece,
      store.get().buildMaterial,
      snap,
      store.get().buildRotate,
      store.get().buildScale,
      valid,
    );
    const hover = aim.buildId ?? null;
    if (hover !== store.get().hoverBuild) {
      store.set({ hoverBuild: hover });
      this.build.highlight(hover);
    }
  }

  private placeBuild() {
    const store = getStore();
    if (!store.get().buildMode) return;
    const aim = this.aimBuildPoint();
    if (!aim) {
      toast("No ground in reach", "Aim at the Studio floor or your own terrace.", "info");
      return;
    }
    const plot = this.build.plotAt(aim.point.x, aim.point.z);
    const studio = Math.hypot(aim.point.x - 150, aim.point.z - 36) < 16.5;
    if (!studio && (plot === null || store.get().identity.plot !== plot)) {
      toast(
        "Build inside a zone",
        "The Studio is open to everyone. A terrace is yours only once you have claimed it.",
        "danger",
      );
      return;
    }
    const snap = new THREE.Vector3(
      Math.round(aim.point.x * 2) / 2,
      this.world.surfaceAt(aim.point.x, aim.point.z, aim.point.y),
      Math.round(aim.point.z * 2) / 2,
    );
    this.build.place(
      snap,
      store.get().buildPiece,
      store.get().buildMaterial,
      store.get().buildRotate,
      store.get().buildScale,
      plot,
    );
  }

  private removeLookedAtBuild() {
    const hover = getStore().get().hoverBuild;
    if (hover) this.build.remove(hover);
  }

  /* ── signal ─────────────────────────────────────────────────────────────── */

  private fire(power: number) {
    if (this.player.cooldown > 0) return;
    if (this.world.spaceBlend > 0.5 && this.player.pos.y > 1400 && this.player.pos.y < 2100) {
      /* Still allowed in space; it reads as a signal across the wheel. */
    }
    const from = this.camera.position
      .clone()
      .addScaledVector(this.cameraForward, 0.6)
      .add(new THREE.Vector3(0, -0.12, 0));
    const to = this.aimSignalPoint();
    this.lightning.strike(from, to, { power });
    this.player.cooldown = 0.34;
    const distance = from.distanceTo(to);
    audio.lightning(distance, power);
    this.net?.signal([from.x, from.y, from.z], [to.x, to.y, to.z]);
    this.flashEl.classList.remove("is-on");
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add("is-on");
    this.player.shake = Math.max(this.player.shake, 0.12 * power);
  }

  private aimSignalPoint(): THREE.Vector3 {
    this.raycaster.setFromCamera(this.centre, this.camera);
    this.raycaster.far = 900;
    const hits = this.raycaster.intersectObject(this.world.terrain, false);
    if (hits.length > 0) return hits[0].point.clone();
    const buildHit = this.build.pick(this.raycaster);
    if (buildHit) return buildHit.point.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.camera.position.clone().addScaledVector(dir, 500);
  }

  /* ── the frame ──────────────────────────────────────────────────────────── */

  private placeLandingCamera() {
    const t = this.time * 0.04;
    const r = 92;
    this.camera.position.set(Math.cos(t) * r, heightAt(0, 0) + 46, Math.sin(t) * r);
    this.camera.lookAt(0, 30, -20);
  }

  private loop = () => {
    if (this.destroyed) return;
    this.frameId = requestAnimationFrame(this.loop);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0.0001, now - this.last));
    this.last = now;
    this.time += dt;
    this.fps += (1 / dt - this.fps) * 0.06;

    if (!this.ready) return;

    const settings = getStore().get().settings;
    if (settings !== this.lastSettings) {
      this.lastSettings = settings;
      if (settings.quality !== this.lastQuality) {
        this.lastQuality = settings.quality;
        this.quality = resolveQuality(settings.quality);
        this.noPost =
          this.quality === "low" ||
          new URLSearchParams(location.search).get("post") === "0";
        this.ensurePost();
        this.renderer.shadowMap.enabled = this.quality !== "low";
      }
      if (settings.timeOfDay !== this.lastTimeOfDay) {
        this.lastTimeOfDay = settings.timeOfDay;
        this.world.setTimeOfDay(settings.timeOfDay);
      }
      if (settings.volume !== this.lastVolume) {
        this.lastVolume = settings.volume;
        audio.setVolume(settings.volume);
        audio.setAmbience(settings.ambience);
      }
      if (settings.fov !== this.lastFov) {
        this.lastFov = settings.fov;
        this.camera.fov = settings.fov;
        this.camera.updateProjectionMatrix();
      }
    }

    const panel = getStore().get().panel;
    if (panel !== this.lastPanel) {
      this.lastPanel = panel;
      if (panel) {
        this.keys.clear();
        this.player.charging = false;
        audio.charge(0);
      }
    }

    if (!this.started || getStore().get().phase === "landing") {
      this.placeLandingCamera();
      this.render(dt);
      return;
    }

    if (getStore().get().phase === "paused") {
      this.world.update(this.time, dt, this.player.pos);
      this.render(dt);
      return;
    }

    this.step(dt);
    this.world.update(this.time, dt, this.player.pos);
    this.updateBuild();
    this.syncShared();
    this.publish(dt);
    this.render(dt);
  };

  private step(dt: number) {
    const store = getStore();
    const settings = store.get().settings;
    const player = this.player;
    const modal = this.isModal();

    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

    let inputX = 0;
    let inputY = 0;
    if (!modal) {
      if (this.keys.has("KeyW")) inputY += 1;
      if (this.keys.has("KeyS")) inputY -= 1;
      if (this.keys.has("KeyD")) inputX += 1;
      if (this.keys.has("KeyA")) inputX -= 1;
      inputX += this.touchMove.x;
      inputY += this.touchMove.y;
      if (this.keys.has("ArrowLeft")) player.yaw += dt * 1.5;
      if (this.keys.has("ArrowRight")) player.yaw -= dt * 1.5;
      if (this.keys.has("ArrowUp")) player.pitch = clamp(player.pitch + dt * 1.2, -1.5, 1.5);
      if (this.keys.has("ArrowDown")) player.pitch = clamp(player.pitch - dt * 1.2, -1.5, 1.5);
    }
    const wish = new THREE.Vector3()
      .addScaledVector(forward, clamp(inputY, -1, 1))
      .addScaledVector(right, clamp(inputX, -1, 1));
    if (wish.lengthSq() > 1) wish.normalize();
    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.touchSprint;

    // Water: a floaty, slower walk, and Space swims up.
    const groundHere = heightAt(player.pos.x, player.pos.z);
    player.inWater =
      player.pos.y < WORLD.waterLevel + 0.35 &&
      groundHere < WORLD.waterLevel - 0.1 &&
      player.mode === "walk";
    if (player.inWater && !player.wasWater) {
      audio.splash();
      this.waterEl.classList.add("is-on");
    }
    if (!player.inWater && player.wasWater) this.waterEl.classList.remove("is-on");
    player.wasWater = player.inWater;

    const eyeY = player.pos.y + EYE;
    this.flashEl.classList.toggle("is-water", player.inWater && eyeY < WORLD.waterLevel + 0.2);

    if (player.mode === "fly") {
      const speed = sprint ? FLY_FAST : FLY;
      const target = wish.clone().multiplyScalar(speed);
      const blend = 1 - Math.exp(-dt * 7);
      player.vel.x += (target.x - player.vel.x) * blend;
      player.vel.z += (target.z - player.vel.z) * blend;
      let vertical = 0;
      if (!modal) {
        if (this.keys.has("Space") || this.touchAscend) vertical += 1;
        if (this.keys.has("ControlLeft") || this.keys.has("ControlRight")) vertical -= 1;
      }
      player.vel.y += (vertical * speed * 0.9 - player.vel.y) * Math.min(1, dt * 7);
      player.jumpsUsed = 0;
      player.onGround = false;
    } else if (player.inWater) {
      const speed = (sprint ? RUN : WALK) * 0.6;
      const target = wish.clone().multiplyScalar(speed);
      const blend = 1 - Math.exp(-dt * 6);
      player.vel.x += (target.x - player.vel.x) * blend;
      player.vel.z += (target.z - player.vel.z) * blend;
      player.vel.y += 22 * dt;
      player.vel.y = Math.min(player.vel.y, 4);
      if (this.keys.has("Space")) player.vel.y = 7;
      player.jumpsUsed = 0;
    } else {
      const speed = sprint ? RUN : WALK;
      const target = wish.clone().multiplyScalar(speed);
      const blend = 1 - Math.exp(-dt * 12);
      player.vel.x += (target.x - player.vel.x) * blend;
      player.vel.z += (target.z - player.vel.z) * blend;
      player.vel.y -= GRAVITY * dt;

      if (!modal && player.jumpBuffer > 0) {
        if (player.onGround || player.coyote > 0) {
          player.vel.y = JUMP;
          player.onGround = false;
          player.coyote = 0;
          player.jumpsUsed = 1;
          player.jumpBuffer = 0;
          audio.jump();
        } else if (player.jumpsUsed < MAX_JUMPS) {
          player.vel.y = AIR_JUMP;
          player.jumpsUsed += 1;
          player.jumpBuffer = 0;
          audio.jump();
          this.player.shake = Math.max(this.player.shake, 0.03);
        }
      }
    }
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyote = Math.max(0, player.coyote - dt);
    player.cooldown = Math.max(0, player.cooldown - dt);

    if (!modal && player.charging) {
      player.charge = Math.min(1.6, player.charge + dt * 1.45);
      audio.charge(player.charge);
      store.set({ signalCharge: Math.min(1, player.charge / 1.6) });
    } else if (store.get().signalCharge !== 0) {
      store.set({ signalCharge: 0 });
    }

    const prev = player.pos.clone();
    player.pos.addScaledVector(player.vel, dt);

    // Keep a body inside the made valley.
    const radial = Math.hypot(player.pos.x, player.pos.z);
    if (radial > WORLD.radius - 30) {
      const s = (WORLD.radius - 30) / radial;
      player.pos.x *= s;
      player.pos.z *= s;
      player.vel.x *= 0.2;
      player.vel.z *= 0.2;
    }
    player.pos.y = Math.max(-60, Math.min(2600, player.pos.y));

    // Flight is not optional above the wheel; there is no floor.
    if (player.pos.y > 1360 && player.mode !== "fly") {
      player.mode = "fly";
      player.vel.y = Math.max(player.vel.y, 4);
      store.set({ mode: "fly" });
      if (!player.spaceWarned) {
        player.spaceWarned = true;
        toast("You are above the valley", "The Sky Wheel is flown, not walked. F lands you again.", "gold");
      }
    }

    // Ground and built surfaces.
    let ground = this.world.surfaceAt(player.pos.x, player.pos.z, player.pos.y);
    const collision = this.build.resolve(prev, player.pos, RADIUS, player.vel.y <= 0);
    if (collision.ground > ground && player.vel.y <= 0 && player.pos.y <= collision.ground + 0.08) {
      ground = collision.ground;
    }
    if (collision.pushX !== 0) player.pos.x += collision.pushX;
    if (collision.pushZ !== 0) player.pos.z += collision.pushZ;

    if (player.pos.y <= ground + 0.02 && player.vel.y <= 0 && player.mode === "walk") {
      const hard = player.vel.y < -18;
      player.pos.y = ground + 0.02;
      player.vel.y = 0;
      if (!player.onGround) {
        player.landing = Math.min(0.22, 0.06 + Math.abs(player.vel.y) * 0.006);
        player.shake = Math.max(player.shake, hard ? 0.16 : 0.05);
        audio.land(hard);
        if (player.inWater) audio.splash();
      }
      player.onGround = true;
      player.jumpsUsed = 0;
      player.coyote = 0.12;
    } else if (player.mode === "walk") {
      player.onGround = false;
    }

    // Head bob, landing recoil, signal shake.
    const horizontalSpeed = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && horizontalSpeed > 0.6) {
      player.bob += dt * (6 + horizontalSpeed * 0.42);
    } else {
      player.bob += dt * 1.2;
    }
    player.landing = Math.max(0, player.landing - dt * 1.8);
    player.shake = Math.max(0, player.shake - dt * 1.6);
    player.roll +=
      ((this.player.onGround ? -inputX * 0.018 : -inputX * 0.006) - player.roll) *
      Math.min(1, dt * 6);

    // The camera.
    const bob =
      player.onGround && !settings.reduceMotion
        ? Math.sin(player.bob) * 0.035 * Math.min(1, horizontalSpeed / 9)
        : 0;
    const shakeX = (Math.random() - 0.5) * player.shake;
    const shakeY = (Math.random() - 0.5) * player.shake;

    if (settings.thirdPerson) {
      const dir = new THREE.Vector3(
        Math.cos(player.pitch) * -Math.sin(player.yaw),
        Math.sin(player.pitch),
        Math.cos(player.pitch) * -Math.cos(player.yaw),
      );
      const target = new THREE.Vector3(
        player.pos.x,
        player.pos.y + 1.5,
        player.pos.z,
      );
      const camPos = target.clone().addScaledVector(dir, -7.2).add(new THREE.Vector3(0, 1.2, 0));
      const floor = this.world.surfaceAt(camPos.x, camPos.z, camPos.y) + 0.8;
      camPos.y = Math.max(camPos.y, floor);
      this.camera.position.copy(camPos);
      this.camera.lookAt(target);
      this.camera.rotation.z = player.roll + shakeX * 0.1;
      this.avatars.updateSelf(
        store.get().identity,
        player.pos,
        player.yaw,
        player.mode,
        dt,
        this.camera,
        true,
      );
    } else {
      this.camera.position.set(
        player.pos.x + shakeX,
        player.pos.y + EYE + bob + player.landing + shakeY,
        player.pos.z,
      );
      this.camera.rotation.set(
        player.pitch + shakeX * 0.15,
        player.yaw,
        player.roll,
      );
      this.avatars.updateSelf(
        store.get().identity,
        player.pos,
        player.yaw,
        player.mode,
        dt,
        this.camera,
        false,
      );
    }

    this.camera.getWorldDirection(this.cameraForward);
    this.avatars.update(store.get().players, store.get().selfId, this.camera, dt);
    this.lightning.update(dt);
    this.updateAimTarget();

    // Audio is updated at a low rate; it is scenery, not a frame budget.
    if (Math.floor(this.time * 6) !== Math.floor((this.time - dt) * 6)) {
      audio.update(
        { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        { x: this.cameraForward.x, z: this.cameraForward.z },
        horizontalSpeed,
        {
          nearWater: player.inWater,
          nearForge: false,
          space: this.world.spaceBlend,
          onGround: player.onGround,
        },
      );
      const near = audio.nearestAttunement(player.pos.x, player.pos.y, player.pos.z);
      const audible = settings.subtitles && near !== null && near.level > 0.2;
      const key = audible && near ? `${near.mantra.id}:${Math.round(near.level * 5)}` : "";
      if (key !== this.lastAttunementKey) {
        this.lastAttunementKey = key;
        store.set({
          attunement: audible && near ? { ...near.mantra, level: near.level } : null,
        });
      }
    }

    // The speed lines and the charge feedback are engine-drawn overlays.
    const speedNorm = clamp(horizontalSpeed / FLY_FAST, 0, 1);
    this.speedEl.classList.toggle("is-on", horizontalSpeed > 44);
    this.speedEl.style.setProperty("--speed", String(speedNorm));
  }

  private syncShared() {
    const store = getStore();
    const state = store.get();
    this.build.sync(state.builds);
    const plotsKey = state.plots
      .map((p) => `${p.index}:${p.owner}:${p.title}:${p.color}:${p.glyph}:${p.motto}`)
      .join("|");
    if (plotsKey !== this.lastPlotsKey) {
      this.lastPlotsKey = plotsKey;
      this.world.setPlots(state.plots as PlotState[]);
    }
    const session = state.session;
    const sessionKey = session
      ? `${session.id}:${session.status ?? "live"}:${session.title}:${session.host}:${
          session.slide ?? 0
        }:${session.startsAt ?? 0}:${(session.slides ?? [])
          .map((slide) => `${slide.title}\u0001${slide.body}`)
          .join("\u0002")}`
      : "";
    if (sessionKey !== this.lastSessionKey) {
      this.lastSessionKey = sessionKey;
      this.world.setSession(session as SessionState | null);
    }
    if (this.started && this.time - this.lastPublish > 0.1) {
      this.lastPublish = this.time;
      this.net?.move(
        this.player.pos.x,
        this.player.pos.y,
        this.player.pos.z,
        this.player.yaw,
        this.player.pitch,
        this.player.mode,
        this.regionId,
      );
    }
  }

  private publish(dt: number) {
    if (this.time - this.hudAt < 0.12) return;
    this.hudAt = this.time;
    const store = getStore();
    const player = this.player;
    const horizontalSpeed = Math.hypot(player.vel.x, player.vel.z);
    let region = REGIONS[0];
    for (const candidate of REGIONS) {
      if (candidate.id === "space") continue;
      if (Math.hypot(player.pos.x - candidate.x, player.pos.z - candidate.z) < candidate.radius) {
        region = candidate;
        break;
      }
    }
    if (player.pos.y > 500) region = REGIONS.find((r) => r.id === "space") ?? region;
    if (region.id !== this.regionId) {
      this.regionId = region.id;
      store.set({ region: region.id, regionTitle: region.title, regionSub: region.sub });
    }
    store.set({
      position: [player.pos.x, player.pos.y, player.pos.z],
      speed: horizontalSpeed,
      altitude: player.pos.y,
      yaw: player.yaw,
      pitch: player.pitch,
      mode: player.mode,
      grounded: player.onGround,
      jumps: player.jumpsUsed,
      inWater: player.inWater,
      inSpace: player.pos.y > 900,
      fps: Math.round(this.fps),
      signalReady: player.cooldown <= 0,
      insidePlot: this.build.plotAt(player.pos.x, player.pos.z),
    });
    void dt;
  }

  private render(dt: number) {
    const settings = getStore().get().settings;
    if (settings.photoMode) document.documentElement.dataset.photo = "true";
    else delete document.documentElement.dataset.photo;
    if (!this.post) {
      this.renderer.toneMappingExposure = this.world.exposure;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.post.update(
      this.time,
      new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z),
      this.world.spaceBlend,
      { fog: this.quality !== "low", rays: this.quality !== "low" },
    );
    this.post.setExposure(this.world.exposure);
    this.post.render(dt);
  }

  /* ── teardown ───────────────────────────────────────────────────────────── */

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    this.onCommandOff?.();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("cipher-signal", this.onRemoteSignal);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.resizeObserver?.disconnect();
    this.net?.close();
    this.build?.dispose();
    this.avatars?.dispose();
    this.lightning?.dispose();
    this.world?.dispose();
    this.post?.dispose();
    this.renderer?.dispose();
    this.flashEl.remove();
    this.waterEl.remove();
    this.speedEl.remove();
    if (documentElementPhoto()) delete document.documentElement.dataset.photo;
  }
}

function documentElementPhoto() {
  return document.documentElement.dataset.photo === "true";
}

/** Which place the member is nearest, for the Atlas. */
export function nearestPlace(x: number, z: number) {
  let best = PLACES[0];
  let distance = Infinity;
  for (const place of PLACES) {
    if (place.id === "space") continue;
    const d = Math.hypot(x - place.x, z - place.z);
    if (d < distance) {
      distance = d;
      best = place;
    }
  }
  return { place: best, distance };
}

/** The plots, re-exported so the UI can name a terrace without importing the engine. */
export const TERRACE_PLOTS = PLOTS;

/** The attunements, re-exported for the Sanctuary panel. */
export const WORLD_ATTUNEMENTS = ATTUNEMENTS;

/** The lake, for the flat map's cross-link. */
export const WORLD_LAKE = LAKE;

/**
 * A small helper the UI uses to ask whether the realtime room is likely to be
 * reachable. It does not open a socket; it just reports what the store knows.
 */
export function connectionLabel() {
  const store = getStore();
  const state = store.get();
  if (state.connected) return "in the room";
  if (state.connecting) return "finding the room…";
  if (state.solo) return "exploring alone";
  return "offline";
}

/** Push a system line into the shared feed from the UI side. */
export function announce(text: string) {
  pushSystem(text, "world");
}
