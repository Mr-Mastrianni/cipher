/**
 * The Cipher — sound engine.
 *
 * Every cue is synthesised with the Web Audio API rather than loaded from a
 * file. That keeps the bundle free of audio assets, makes the palette trivially
 * themeable (each cue is a small set of oscillator partials), and means there
 * is nothing to preload before the first interaction.
 *
 * Accessibility rules this module enforces:
 *  - Nothing is ever played without a prior user gesture. `AudioContext` is
 *    created lazily on the first `unlock()` call, which every interactive
 *    component triggers on pointer-down or key-down.
 *  - The global mute state is persisted, and defaults to muted for anyone who
 *    has asked their OS for reduced motion (a strong proxy for sensory
 *    sensitivity). Users can still turn sound on explicitly.
 *  - `setEnabled(false)` tears the context down so a muted app costs nothing.
 */

export type Cue =
  | "hover"
  | "tick"
  | "select"
  | "confirm"
  | "advance"
  | "reveal"
  | "threshold"
  | "success"
  | "error"
  | "message"
  | "join"
  | "listen"
  | "speak";

interface Partial {
  /** Frequency in Hz. */
  f: number;
  /** Relative gain. */
  g: number;
  /** Waveform. */
  type: OscillatorType;
}

interface CueSpec {
  partials: Partial[];
  /** Seconds. */
  duration: number;
  /** Peak gain 0–1. */
  gain: number;
  /** Optional glide target in Hz for the fundamental. */
  glide?: number;
  /** Attack time in seconds. */
  attack?: number;
}

const CUES: Record<Cue, CueSpec> = {
  // Barely-there navigation texture.
  hover: {
    partials: [{ f: 1180, g: 1, type: "sine" }],
    duration: 0.05,
    gain: 0.022,
    attack: 0.004,
  },
  tick: {
    partials: [{ f: 2200, g: 1, type: "triangle" }],
    duration: 0.03,
    gain: 0.03,
    attack: 0.002,
  },
  select: {
    partials: [
      { f: 520, g: 1, type: "sine" },
      { f: 1040, g: 0.32, type: "sine" },
    ],
    duration: 0.11,
    gain: 0.06,
    glide: 660,
    attack: 0.004,
  },
  confirm: {
    partials: [
      { f: 660, g: 1, type: "sine" },
      { f: 990, g: 0.4, type: "sine" },
      { f: 1320, g: 0.16, type: "sine" },
    ],
    duration: 0.24,
    gain: 0.075,
    attack: 0.006,
  },
  advance: {
    partials: [
      { f: 440, g: 1, type: "sine" },
      { f: 880, g: 0.3, type: "sine" },
    ],
    duration: 0.16,
    gain: 0.06,
    glide: 587.33,
    attack: 0.005,
  },
  // The bodygraph lighting up.
  reveal: {
    partials: [
      { f: 220, g: 1, type: "sine" },
      { f: 330, g: 0.44, type: "sine" },
      { f: 550, g: 0.22, type: "triangle" },
      { f: 880, g: 0.1, type: "sine" },
    ],
    duration: 1.05,
    gain: 0.085,
    glide: 329.63,
    attack: 0.06,
  },
  // Crossing the threshold — the signature moment.
  threshold: {
    partials: [
      { f: 110, g: 1, type: "sine" },
      { f: 164.81, g: 0.5, type: "sine" },
      { f: 246.94, g: 0.3, type: "sine" },
      { f: 493.88, g: 0.14, type: "triangle" },
      { f: 987.77, g: 0.05, type: "sine" },
    ],
    duration: 1.9,
    gain: 0.1,
    glide: 82.41,
    attack: 0.05,
  },
  success: {
    partials: [
      { f: 523.25, g: 1, type: "sine" },
      { f: 783.99, g: 0.42, type: "sine" },
      { f: 1046.5, g: 0.2, type: "sine" },
    ],
    duration: 0.42,
    gain: 0.085,
    glide: 659.25,
    attack: 0.008,
  },
  error: {
    partials: [
      { f: 196, g: 1, type: "triangle" },
      { f: 185, g: 0.6, type: "sine" },
    ],
    duration: 0.3,
    gain: 0.07,
    glide: 146.83,
    attack: 0.005,
  },
  message: {
    partials: [
      { f: 880, g: 1, type: "sine" },
      { f: 1174.66, g: 0.3, type: "sine" },
    ],
    duration: 0.16,
    gain: 0.05,
    glide: 1046.5,
    attack: 0.004,
  },
  join: {
    partials: [
      { f: 392, g: 1, type: "sine" },
      { f: 587.33, g: 0.36, type: "sine" },
    ],
    duration: 0.3,
    gain: 0.06,
    glide: 493.88,
    attack: 0.008,
  },
  // Voice agent: microphone opens.
  listen: {
    partials: [
      { f: 740, g: 1, type: "sine" },
      { f: 1108.73, g: 0.3, type: "sine" },
    ],
    duration: 0.14,
    gain: 0.05,
    glide: 880,
    attack: 0.004,
  },
  // Voice agent: microphone closes.
  speak: {
    partials: [
      { f: 660, g: 1, type: "sine" },
      { f: 440, g: 0.3, type: "sine" },
    ],
    duration: 0.18,
    gain: 0.05,
    glide: 523.25,
    attack: 0.005,
  },
};

const STORAGE_KEY = "cipher:sound";
const THEME_KEY = "cipher:theme";

type Listener = (enabled: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;
  private unlocked = false;
  private listeners = new Set<Listener>();
  /** Throttle map so a fast pointer cannot machine-gun the same cue. */
  private lastPlayed = new Map<Cue, number>();
  private initialized = false;

  /** Read the persisted preference. Safe on the server (returns a default). */
  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === "on") {
      this.enabled = true;
    } else if (stored === "off") {
      this.enabled = false;
    } else {
      // No explicit choice yet: default to quiet for reduced-motion users.
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      )?.matches;
      this.enabled = !reduced;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  isUnlocked() {
    return this.unlocked;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.enabled);
  }

  setEnabled(next: boolean) {
    this.init();
    this.enabled = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* storage unavailable — preference is session-only */
    }
    if (!next && this.ctx) {
      // Release the audio hardware while muted.
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.master = null;
      this.unlocked = false;
    }
    if (next) this.unlock();
    this.emit();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Create the AudioContext inside a user gesture. Browsers refuse to start
   * audio otherwise, so every interactive surface calls this on first input.
   */
  unlock() {
    this.init();
    if (!this.enabled || typeof window === "undefined") return;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.unlocked = true;
      return;
    }
    type WithWebkit = typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor =
      window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      // A gentle limiter keeps layered cues from clipping.
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.unlocked = true;
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  play(cue: Cue) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    const now = this.ctx.currentTime;
    const throttle = cue === "hover" || cue === "tick" ? 0.045 : 0.02;
    const last = this.lastPlayed.get(cue) ?? -Infinity;
    if (now - last < throttle) return;
    this.lastPlayed.set(cue, now);

    const spec = CUES[cue];
    const t0 = now + 0.001;
    const t1 = t0 + spec.duration;
    const attack = spec.attack ?? 0.005;

    for (const partial of spec.partials) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = partial.type;
      osc.frequency.setValueAtTime(partial.f, t0);
      if (spec.glide !== undefined) {
        // Exponential ramps cannot cross zero; both values are audible here.
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(spec.glide * (partial.f / spec.partials[0].f), 20),
          t1,
        );
      }
      const peak = spec.gain * partial.g;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }
}

export const sound = new SoundEngine();

/** Convenience wrapper used by components. Safe to call anywhere. */
export function cue(name: Cue) {
  sound.play(name);
}

export function readStoredTheme(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export { STORAGE_KEY as SOUND_STORAGE_KEY, THEME_KEY as THEME_STORAGE_KEY };
