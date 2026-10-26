/**
 * Everything you hear is synthesised here. No recordings, no licensing, no
 * megabytes: wind is filtered noise, the forge is crackle and bellows, thunder
 * is a noise front with a low rumble, and the sounding stones are sung by a
 * small formant choir — a sawtooth glottal source pushed through three vowel
 * band-passes, with a long echo and a convolution hall behind it.
 *
 * The result is deliberately quiet. The world should sound like a place you
 * are standing in, not a trailer.
 */
import { ATTUNEMENTS } from '../content/world';
import type { Attunement } from '../content/world';

const VOWELS: Record<string, [number, number, number]> = {
  a: [780, 1150, 2800],
  i: [300, 2200, 3000],
  u: [350, 820, 2400],
  e: [500, 1800, 2500],
  o: [460, 840, 2600],
  m: [260, 620, 1200],
  n: [280, 1500, 2400],
  r: [420, 1100, 1600],
  l: [380, 1000, 2200],
  s: [900, 1900, 3200],
  h: [500, 1200, 2200],
  y: [320, 2100, 2900],
  v: [380, 900, 2100],
};

function vowelOf(syllable: string): [number, number, number] {
  const chars = syllable.toLowerCase().split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    if (VOWELS[chars[i]]) return VOWELS[chars[i]];
  }
  return VOWELS.a;
}

function makeNoise(ctx: AudioContext, seconds: number, brown = false): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function makeImpulse(ctx: AudioContext, seconds = 3.2, decay = 2.6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (c === 0 ? 0.9 : 1);
    }
  }
  return buffer;
}

export class RealmAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private reverb!: ConvolverNode;
  private reverbGain!: GainNode;
  private delay!: DelayNode;
  private delayGain!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private waterGain!: GainNode;
  private fireGain!: GainNode;
  private spaceGain!: GainNode;
  private flightGain!: GainNode;
  private flightFilter!: BiquadFilterNode;
  private droneGain!: GainNode;
  private started = false;
  private listener = { x: 0, y: 0, z: 0, fx: 0, fz: -1 };
  private chants: {
    mantra: Attunement;
    nextAt: number;
    step: number;
    level: number;
    pan: number;
  }[] = [];
  private lastFoot = 0;
  private lastWhisper = 0;
  private mutedFlag = false;
  volume = 0.8;
  ambience = 0.9;

  get ready() {
    return this.started;
  }

  async start(): Promise<void> {
    if (this.started) {
      await this.ctx?.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    await ctx.resume();

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.3;
    this.master.connect(compressor).connect(ctx.destination);

    this.music = ctx.createGain();
    this.music.gain.value = 0.9;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.5;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.46;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    this.delay.connect(feedback).connect(this.delay);
    this.delay.connect(this.delayGain).connect(this.master);
    this.delayGain.connect(this.reverb);

    this.noise = makeNoise(ctx, 4, false);
    const brown = makeNoise(ctx, 6, true);

    // Wind: brown noise through a low-pass, breathing slowly.
    const wind = ctx.createBufferSource();
    wind.buffer = brown;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 520;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.09;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.music);
    wind.start();
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.055;
    const gustAmt = ctx.createGain();
    gustAmt.gain.value = 0.045;
    gust.connect(gustAmt).connect(this.windGain.gain);
    gust.start();

    // Water: high-passed noise, gently panned, only near the lake.
    const water = ctx.createBufferSource();
    water.buffer = this.noise;
    water.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 620;
    wf.Q.value = 0.7;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    water.connect(wf).connect(this.waterGain).connect(this.music);
    water.start();

    // Forge: low crackle, only near the forge.
    const fire = ctx.createBufferSource();
    fire.buffer = brown;
    fire.loop = true;
    const ff = ctx.createBiquadFilter();
    ff.type = 'bandpass';
    ff.frequency.value = 240;
    ff.Q.value = 1.2;
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    fire.connect(ff).connect(this.fireGain).connect(this.music);
    fire.start();

    // Space: a very low, slow hum.
    const space = ctx.createOscillator();
    space.type = 'sine';
    space.frequency.value = 41.2;
    const space2 = ctx.createOscillator();
    space2.type = 'sine';
    space2.frequency.value = 61.8;
    const spaceMix = ctx.createGain();
    spaceMix.gain.value = 0.5;
    this.spaceGain = ctx.createGain();
    this.spaceGain.gain.value = 0;
    space.connect(spaceMix);
    space2.connect(spaceMix);
    spaceMix.connect(this.spaceGain).connect(this.music);
    space.start();
    space2.start();

    // Wind past the ears once you are actually moving fast.
    const flight = ctx.createBufferSource();
    flight.buffer = this.noise;
    flight.loop = true;
    this.flightFilter = ctx.createBiquadFilter();
    this.flightFilter.type = 'bandpass';
    this.flightFilter.frequency.value = 900;
    this.flightFilter.Q.value = 0.5;
    this.flightGain = ctx.createGain();
    this.flightGain.gain.value = 0;
    flight.connect(this.flightFilter).connect(this.flightGain).connect(this.sfx);
    flight.start();

    // A low drone for the Circle itself, tuned to the Om shrine.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.028;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 280;
    for (const [freq, detune] of [[55, -4], [110, 3], [164.81, 6]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(droneFilter);
      o.start();
    }
    droneFilter.connect(this.droneGain).connect(this.music);
    this.droneGain.connect(this.reverb);

    this.chants = ATTUNEMENTS.map((m) => ({ mantra: m, nextAt: ctx.currentTime + Math.random() * 6, step: 0, level: 0, pan: 0 }));
    this.started = true;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.mutedFlag ? 0 : v, this.ctx!.currentTime, 0.1);
  }

  setAmbience(v: number) {
    this.ambience = v;
  }

  setMuted(muted: boolean) {
    this.mutedFlag = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx!.currentTime, 0.15);
  }

  /** Update the listener and every distance-driven bed. Called each frame. */
  update(pos: { x: number; y: number; z: number }, forward: { x: number; z: number }, speed: number, opts: { nearWater: boolean; nearForge: boolean; space: number; onGround: boolean }) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.listener = { x: pos.x, y: pos.y, z: pos.z, fx: forward.x, fz: forward.z };

    this.windGain.gain.setTargetAtTime((0.055 + Math.min(0.09, speed * 0.0012)) * this.ambience, t, 0.8);
    this.flightFilter.frequency.setTargetAtTime(500 + Math.min(2400, speed * 24), t, 0.3);
    this.flightGain.gain.setTargetAtTime(opts.onGround ? 0 : Math.min(0.16, speed * 0.0017), t, 0.25);
    this.waterGain.gain.setTargetAtTime(opts.nearWater ? 0.055 * this.ambience : 0, t, 1.4);
    this.fireGain.gain.setTargetAtTime(opts.nearForge ? 0.07 * this.ambience : 0, t, 0.7);
    this.droneGain.gain.setTargetAtTime(0.02 + 0.035 * opts.space, t, 1.2);
    this.spaceGain.gain.setTargetAtTime(opts.space * 0.09 * this.ambience, t, 1.5);
    this.reverbGain.gain.setTargetAtTime(0.32 + 0.4 * opts.space, t, 1.0);

    // Chants: level from distance, and a slow syllable scheduler that only runs
    // for shrines close enough to hear.
    for (const c of this.chants) {
      const m = c.mantra;
      const z = m.space ? (m.z ?? 0) : m.z;
      const dx = m.x - pos.x;
      const dz = z - pos.z;
      const dy = (m.space ? (m.y ?? 1800) : pos.y) - pos.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const reach = m.space ? 140 : 78;
      const raw = Math.max(0, 1 - d / reach);
      c.level = raw * raw;
      c.pan = Math.max(-1, Math.min(1, (dx * this.listener.fx + dz * this.listener.fz) * 0.0006 + (dx / (d + 1)) * 0.7));
      if (c.level < 0.008) {
        c.nextAt = Math.max(c.nextAt, t + 1.5);
        continue;
      }
      if (t >= c.nextAt) {
        const syllable = m.syllables[c.step % m.syllables.length];
        c.step++;
        const dur = 0.42 + Math.min(0.5, syllable.length * 0.075);
        this.sing(m, syllable, c.level * 0.12, c.pan, t + 0.03, dur);
        c.nextAt = t + dur * 0.78 + 0.35 + (c.step % 4 === 0 ? 0.9 : 0.12);
      }
    }
  }

  /** One sung syllable of a mantra, built fresh and discarded. */
  private sing(m: Attunement, syllable: string, gainValue: number, pan: number, at: number, dur: number) {
    const ctx = this.ctx!;
    const formants = vowelOf(syllable);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0003, gainValue), at + 0.1);
    out.gain.setValueAtTime(Math.max(0.0003, gainValue), at + dur * 0.62);
    out.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(this.music);
    panner.connect(this.delay);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    panner.connect(send).connect(this.reverb);

    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.value = m.root * (syllable === 'm' || syllable === 'hum' ? 1 : 1.5);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.2 + Math.random() * 1.2;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = 2.4;
    vib.connect(vibAmt).connect(src.detune);
    vib.start(at);
    vib.stop(at + dur + 0.1);

    const glottal = ctx.createGain();
    glottal.gain.value = 0.5;
    src.connect(glottal);

    for (let i = 0; i < 3; i++) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = formants[i];
      bp.Q.value = 9 + i * 2;
      const g = ctx.createGain();
      g.gain.value = [1, 0.52, 0.24][i];
      glottal.connect(bp).connect(g).connect(out);
    }

    // A little breath at the front of the syllable, so it reads as a voice.
    if (Math.random() < 0.65) {
      const breath = ctx.createBufferSource();
      breath.buffer = this.noise;
      breath.playbackRate.value = 0.9 + Math.random() * 0.4;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 1600;
      bp.Q.value = 1.4;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.018 * (gainValue / 0.02), at);
      bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      breath.connect(bp).connect(bg).connect(out);
      breath.start(at, Math.random() * 2, 0.25);
    }

    src.start(at);
    src.stop(at + dur + 0.05);
    window.setTimeout(() => {
      try { out.disconnect(); panner.disconnect(); } catch { /* already gone */ }
    }, (dur + 1) * 1000);
  }

  /** The nearest shrine's level, for subtitles and the HUD. */
  mantraLevel(x: number, y: number, z: number): { mantra: Attunement; level: number; distance: number } | null {
    let best: { mantra: Attunement; level: number; distance: number } | null = null;
    for (const m of ATTUNEMENTS) {
      const my = m.space ? (m.y ?? 1800) : y;
      const myz = m.space ? m.z : m.z;
      const d = Math.hypot(m.x - x, myz - z, my - y);
      const reach = m.space ? 120 : 70;
      const level = Math.max(0, 1 - d / reach);
      if (level > 0.03 && (!best || level > best.level)) best = { mantra: m, level, distance: d };
    }
    return best;
  }

  /** The words, spoken plainly, only when asked for. */
  speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.72;
      u.pitch = 0.72;
      u.volume = 0.75;
      const voices = speechSynthesis.getVoices();
      const pick = voices.find((v) => /en-IN|hi-IN|en-GB/i.test(v.lang)) || voices.find((v) => v.lang.startsWith('en'));
      if (pick) u.voice = pick;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* speech is a courtesy, not a requirement */
    }
  }

  footstep(speed: number, inWater: boolean) {
    if (!this.started || !this.ctx) return;
    const now = performance.now();
    const interval = inWater ? 360 : Math.max(230, 560 - speed * 12);
    if (now - this.lastFoot < interval) return;
    this.lastFoot = now;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (inWater) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900 + Math.random() * 500;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t, Math.random() * 2, 0.25);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.5 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260 + speed * 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 2, 0.18);
  }

  jump() {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.22);
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, 0, 0.35);
  }

  land(hard = false) {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(hard ? 92 : 70, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(hard ? 0.12 : 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.3);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(hard ? 0.06 : 0.025, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(f).connect(ng).connect(this.sfx);
    n.start(t, 0, 0.22);
  }

  /** Lightning: a crack now, a rumble arriving at the speed of sound. */
  lightning(distance: number, charged = 1) {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const crack = ctx.createBufferSource();
    crack.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    dist.curve = curve;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28 * charged, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    crack.connect(hp).connect(dist).connect(g).connect(this.sfx);
    g.connect(this.reverb);
    crack.start(t, Math.random(), 0.4);

    const delay = Math.min(4.5, distance / 343);
    window.setTimeout(() => this.rumble(charged), delay * 1000);
  }

  private rumble(charged: number) {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx, 3.2, true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(70, t + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 * charged, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    src.connect(f).connect(g).connect(this.sfx);
    g.connect(this.reverb);
    src.start(t, 0, 3.2);
  }

  charge(level: number) {
    // A rising electrical whine while the hand is held closed.
    if (!this.started || !this.ctx) return;
    if (!this.chargeOsc) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 70;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 5;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f).connect(g).connect(this.sfx);
      o.start();
      this.chargeOsc = { o, f, g };
    }
    const c = this.chargeOsc;
    const t = this.ctx.currentTime;
    c.o.frequency.setTargetAtTime(70 + level * 260, t, 0.05);
    c.f.frequency.setTargetAtTime(600 + level * 2600, t, 0.05);
    c.g.gain.setTargetAtTime(level > 0.02 ? 0.012 * level : 0, t, 0.04);
  }

  private chargeOsc: { o: OscillatorNode; f: BiquadFilterNode; g: GainNode } | null = null;

  build() {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.24);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.018, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(f).connect(ng).connect(this.reverb);
    n.start(t, 0, 0.5);
  }

  /** A quiet bell for interfaces and discoveries. */
  chime(freq = 660, gain = 0.03) {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g);
    o2.connect(g);
    g.connect(this.master);
    g.connect(this.reverb);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.5);
    o2.stop(t + 1.5);
  }

  /** A hammer on the anvil. */
  hammer(power = 0.5) {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1180, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12 * power, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g);
    g.connect(this.sfx);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + 0.55);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * power, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f).connect(ng).connect(this.sfx);
    n.start(t, 0, 0.14);
  }

  /** A servo moving in the Robotics Bay. */
  servo() {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(420, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.014, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.26);
  }

  splash() {
    if (!this.started) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1600, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    n.connect(f).connect(g).connect(this.sfx);
    n.start(t, 0, 0.75);
  }

  /** Distance to the nearest sounding stone, exposed for the subtitle layer. */
  nearestAttunement(x: number, y: number, z: number) {
    return this.mantraLevel(x, y, z);
  }

  /** Stops all sound, for a clean shutdown. */
  dispose() {
    try {
      this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.started = false;
  }
}

export const audio = new RealmAudio();
