"use client";

/**
 * The agent's voice layer: push-to-talk, hands-free listening, and spoken
 * replies.
 *
 * Consent and safety rules baked into this component:
 *
 *  - The microphone is **never** opened implicitly. Every `getUserMedia` and
 *    `SpeechRecognition.start()` call happens inside an explicit pointer or
 *    keyboard handler.
 *  - The mic is released on unmount, when the tab becomes hidden, and when the
 *    operator stops listening.
 *  - A hard mute cancels synthesis immediately and blocks future utterances.
 *  - State changes are announced through an `aria-live` region, and a denied
 *    permission produces actionable instructions rather than a silent failure.
 *
 * Speech-to-text prefers `window.SpeechRecognition`/`webkitSpeechRecognition`
 * and falls back to `MediaRecorder` plus `POST /api/agent/voice/transcribe`.
 * Text-to-speech uses `speechSynthesis` with a voice picker and a rate control.
 * The waveform is driven by a Web Audio `AnalyserNode`; the bars combine the
 * `animate-voice-bar` token with a live height from the frequency data.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertTriangle,
  AudioLines,
  Hand,
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Badge, Button, Select, Switch } from "@/components/ui";
import { useSound } from "@/components/providers/sound-provider";
import { cn } from "@/lib/utils";
import { useBrowserValue } from "@/lib/hooks/use-browser-value";

/* ────────────────────────────────────────────────────────────────────────────
 * Web Speech API types
 *
 * `SpeechRecognition` is still absent from TypeScript's DOM library, so the
 * minimum surface is declared locally instead of reaching for `any`.
 * ──────────────────────────────────────────────────────────────────────────── */

/** One recognition hypothesis. */
interface SpeechAlternativeLike {
  /** Recognised text. */
  transcript: string;
  /** Provider confidence, 0-1. */
  confidence: number;
}

/** A recognition result group. */
interface SpeechResultLike {
  /** Whether this group is final. */
  isFinal: boolean;
  /** Number of alternatives. */
  length: number;
  /** Alternative at `index`. */
  [index: number]: SpeechAlternativeLike;
}

/** The full result list for one event. */
interface SpeechResultListLike {
  /** Number of result groups. */
  length: number;
  /** Result group at `index`. */
  [index: number]: SpeechResultLike;
}

/** A `result` event. */
interface SpeechResultEventLike extends Event {
  /** Index of the first changed result. */
  resultIndex: number;
  /** All results for the utterance. */
  results: SpeechResultListLike;
}

/** An `error` event. */
interface SpeechErrorEventLike extends Event {
  /** Machine-readable error code, e.g. `not-allowed`. */
  error: string;
}

/** A recogniser instance. */
interface SpeechRecogniserLike extends EventTarget {
  /** Keep listening across pauses. */
  continuous: boolean;
  /** Emit partial results. */
  interimResults: boolean;
  /** BCP-47 language tag. */
  lang: string;
  /** Number of alternative hypotheses. */
  maxAlternatives: number;
  /** Begin listening. */
  start: () => void;
  /** Stop after the current utterance. */
  stop: () => void;
  /** Stop immediately. */
  abort: () => void;
  /** Result handler. */
  onresult: ((event: SpeechResultEventLike) => void) | null;
  /** Error handler. */
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  /** Fired when listening stops. */
  onend: (() => void) | null;
  /** Fired when listening starts. */
  onstart: (() => void) | null;
}

/** Constructor for a recogniser. */
interface SpeechRecogniserConstructor {
  /** Create a recogniser. */
  new (): SpeechRecogniserLike;
}

/** The vendor-prefixed globals a browser may expose. */
interface SpeechCapableWindow {
  /** Standard constructor. */
  SpeechRecognition?: SpeechRecogniserConstructor;
  /** WebKit-prefixed constructor. */
  webkitSpeechRecognition?: SpeechRecogniserConstructor;
  /** Safari's prefixed audio context. */
  webkitAudioContext?: typeof AudioContext;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Props
 * ──────────────────────────────────────────────────────────────────────────── */

/** How the microphone is engaged. */
export type AgentVoiceMode = "push" | "handsfree";

/** Props for {@link AgentVoice}. */
export interface AgentVoiceProps {
  /** Current listening mode. */
  mode: AgentVoiceMode;
  /** Called when the operator changes the listening mode. */
  onModeChange: (mode: AgentVoiceMode) => void;
  /** Receives recognised speech; `final` marks an utterance boundary. */
  onTranscript: (text: string, final: boolean) => void;
  /** Text to read aloud when it changes. */
  speakText?: string | null;
  /** Disable every control, e.g. while a reply is streaming. */
  disabled?: boolean;
  /** Extra classes for the root element. */
  className?: string;
}

/** Languages offered for recognition. */
const LANGUAGES: readonly { value: string; label: string }[] = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "pt-BR", label: "Português (BR)" },
  { value: "ja-JP", label: "日本語" },
];

/** Number of waveform bars. */
const BAR_COUNT = 24;

/** How long to wait before restarting hands-free recognition. */
const RESTART_DELAY_MS = 400;

/** The actionable message shown when the microphone is blocked. */
const PERMISSION_HELP =
  "Microphone access was blocked. Allow the microphone for this site in your browser's site settings and try again. On macOS, also check System Settings → Privacy & Security → Microphone.";

/**
 * The voice control surface: push-to-talk, hands-free listening, a live
 * waveform, and text-to-speech settings. Renders nothing that opens the
 * microphone until the operator acts.
 */
interface VoiceCapabilities {
  recognition: boolean;
  synthesis: boolean;
  recorder: boolean;
}

/* Capability detection is client-only, so SSR output stays stable. */
const NO_VOICE_CAPABILITIES: VoiceCapabilities = {
  recognition: false,
  synthesis: false,
  recorder: false,
};

let cachedCapabilities: VoiceCapabilities | null = null;

function readVoiceCapabilities(): VoiceCapabilities {
  if (cachedCapabilities) return cachedCapabilities;
  const speechWindow = window as unknown as SpeechCapableWindow;
  cachedCapabilities = {
    recognition: Boolean(
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition,
    ),
    synthesis: typeof window.speechSynthesis !== "undefined",
    recorder: typeof window.MediaRecorder !== "undefined",
  };
  return cachedCapabilities;
}

function readBrowserLanguage(): string | null {
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : null;
}

export function AgentVoice({
  mode,
  onModeChange,
  onTranscript,
  speakText,
  disabled = false,
  className,
}: AgentVoiceProps) {
  const { play } = useSound();

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("Voice is idle.");
  const [permissionDenied, setPermissionDenied] = useState(false);
  // `null` until the admin picks a language; then it overrides the browser default.
  const [languageOverride, setLanguage] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState("");
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecogniserLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const wantListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  /* ── Capability detection (client only, so SSR output stays stable) ── */

  const capabilities = useBrowserValue(readVoiceCapabilities, NO_VOICE_CAPABILITIES);
  const browserLanguage = useBrowserValue(readBrowserLanguage, null);
  const language = languageOverride ?? browserLanguage ?? "en-US";

  /* ── TTS voice catalogue ── */

  useEffect(() => {
    if (typeof window.speechSynthesis === "undefined") return;
    const synth = window.speechSynthesis;
    const load = () => {
      const available = synth.getVoices();
      setVoices(available);
      setVoiceUri((current) => {
        if (current !== "") return current;
        const preferred = available.find((voice) => voice.default) ?? available[0];
        return preferred ? preferred.voiceURI : "";
      });
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
    };
  }, []);

  /* ── Waveform ── */

  const stopWaveform = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(() => undefined);
    for (const bar of barRefs.current) {
      if (bar) bar.style.height = "";
    }
  }, []);

  const startWaveform = useCallback(
    (stream: MediaStream) => {
      const speechWindow = window as unknown as SpeechCapableWindow;
      const AudioContextCtor = window.AudioContext ?? speechWindow.webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = new AudioContextCtor();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      audioContextRef.current = context;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = barRefs.current;
        for (let index = 0; index < bars.length; index += 1) {
          const bar = bars[index];
          if (!bar) continue;
          const bin = Math.min(
            data.length - 1,
            Math.floor((index / bars.length) * data.length),
          );
          const value = data[bin] ?? 0;
          bar.style.height = `${6 + (value / 255) * 30}px`;
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    },
    [],
  );

  /* ── Microphone lifecycle ── */

  const releaseMicrophone = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopWaveform();
  }, [stopWaveform]);

  const uploadClip = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0 || !mountedRef.current) return;
      setTranscribing(true);
      setAnnouncement("Transcribing on the server.");
      try {
        const form = new FormData();
        form.append("audio", blob, "clip.webm");
        if (language) form.append("language", language);
        const response = await fetch("/api/agent/voice/transcribe", {
          method: "POST",
          body: form,
        });
        const payload: unknown = await response.json().catch(() => null);
        const message =
          payload !== null &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "The clip could not be transcribed.";
        if (!response.ok) {
          setError(message);
          setAnnouncement("Transcription failed.");
          return;
        }
        const text =
          payload !== null &&
          typeof payload === "object" &&
          "text" in payload &&
          typeof (payload as { text?: unknown }).text === "string"
            ? (payload as { text: string }).text.trim()
            : "";
        if (text !== "") onTranscript(text, true);
        setAnnouncement(text === "" ? "No speech detected." : "Transcribed.");
      } catch {
        setError("The recording could not be uploaded.");
        setAnnouncement("Transcription failed.");
      } finally {
        setTranscribing(false);
      }
    },
    [language, onTranscript],
  );

  const startListening = useCallback(async () => {
    if (disabled || recording) return;
    setError(null);
    setInterim("");
    const speechWindow = window as unknown as SpeechCapableWindow;
    const Recogniser =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    play("listen");
    wantListeningRef.current = true;
    setRecording(true);
    setAnnouncement(
      mode === "handsfree" ? "Listening continuously." : "Listening — release to send.",
    );

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setPermissionDenied(false);
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermissionDenied(true);
        setError(PERMISSION_HELP);
      } else {
        setError("The microphone could not be opened on this device.");
      }
    }

    if (stream) {
      streamRef.current = stream;
      startWaveform(stream);
    }

    if (Recogniser) {
      const recogniser = new Recogniser();
      recogniser.continuous = mode === "handsfree";
      recogniser.interimResults = true;
      recogniser.maxAlternatives = 1;
      recogniser.lang = language;

      recogniser.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const alternative = result?.[0];
          if (!result || !alternative) continue;
          if (result.isFinal) finalText += alternative.transcript;
          else interimText += alternative.transcript;
        }
        if (interimText !== "") setInterim(interimText);
        if (finalText.trim() !== "") {
          setInterim("");
          onTranscript(finalText.trim(), true);
        }
      };

      recogniser.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setPermissionDenied(true);
          setError(PERMISSION_HELP);
        } else if (event.error === "no-speech") {
          setAnnouncement("No speech detected.");
        } else if (event.error !== "aborted") {
          setError(`Speech recognition reported: ${event.error}.`);
        }
      };

      recogniser.onend = () => {
        if (wantListeningRef.current && mode === "handsfree") {
          restartTimerRef.current = window.setTimeout(() => {
            try {
              recogniser.start();
            } catch {
              // A restart can race with teardown; the next press will recover.
            }
          }, RESTART_DELAY_MS);
          return;
        }
        if (!wantListeningRef.current) {
          setRecording(false);
          setAnnouncement("Stopped listening.");
        }
      };

      recognitionRef.current = recogniser;
      try {
        recogniser.start();
      } catch {
        setError("Speech recognition could not be started in this browser.");
      }
      return;
    }

    // No browser recogniser: record and upload instead.
    if (stream && typeof window.MediaRecorder !== "undefined") {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        void uploadClip(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      return;
    }

    if (!stream) {
      setRecording(false);
      wantListeningRef.current = false;
      return;
    }

    setError(
      "This browser has neither speech recognition nor MediaRecorder, so voice input is unavailable.",
    );
    releaseMicrophone();
    setRecording(false);
    wantListeningRef.current = false;
  }, [
    disabled,
    language,
    mode,
    onTranscript,
    play,
    recording,
    releaseMicrophone,
    startWaveform,
    uploadClip,
  ]);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recogniser = recognitionRef.current;
    recognitionRef.current = null;
    if (recogniser) {
      recogniser.onend = null;
      try {
        recogniser.stop();
      } catch {
        // Already stopped.
      }
    }
    releaseMicrophone();
    setRecording(false);
    setInterim("");
    setAnnouncement("Stopped listening.");
  }, [releaseMicrophone]);

  /* ── TTS ── */

  const speak = useCallback(
    (text: string) => {
      if (muted || typeof window.speechSynthesis === "undefined") return;
      const trimmed = text.trim();
      if (trimmed === "") return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.rate = rate;
      const chosen = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.voiceURI === voiceUri);
      if (chosen) utterance.voice = chosen;
      utterance.onstart = () => {
        setSpeaking(true);
        setAnnouncement("Speaking the reply.");
      };
      utterance.onend = () => {
        setSpeaking(false);
        setAnnouncement("Finished speaking.");
      };
      utterance.onerror = () => {
        setSpeaking(false);
      };
      play("speak");
      window.speechSynthesis.speak(utterance);
    },
    [muted, play, rate, voiceUri],
  );

  useEffect(() => {
    if (!speakText) return;
    const text = speakText.trim();
    if (text === "" || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;
    speak(text);
  }, [speak, speakText]);

  /* ── Teardown on unmount and when the tab is hidden ── */

  useEffect(() => {
    const handleHidden = () => {
      if (document.hidden) {
        stopListening();
        if (typeof window.speechSynthesis !== "undefined") {
          window.speechSynthesis.cancel();
        }
      }
    };
    document.addEventListener("visibilitychange", handleHidden);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleHidden);
      wantListeningRef.current = false;
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      const recogniser = recognitionRef.current;
      recognitionRef.current = null;
      if (recogniser) {
        recogniser.onend = null;
        try {
          recogniser.abort();
        } catch {
          // Already stopped.
        }
      }
      releaseMicrophone();
      if (typeof window.speechSynthesis !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, [releaseMicrophone, stopListening]);

  /* ── Handlers ── */

  const handlePushStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.focus();
      void startListening();
    },
    [startListening],
  );

  const handlePushStop = useCallback(() => {
    if (recognitionRef.current || streamRef.current || recorderRef.current) {
      stopListening();
    }
  }, [stopListening]);

  const handlePushKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.repeat) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        void startListening();
      }
    },
    [startListening],
  );

  const handlePushKeyUp = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        handlePushStop();
      }
    },
    [handlePushStop],
  );

  const handleHandsfreeToggle = useCallback(
    (next: boolean) => {
      onModeChange(next ? "handsfree" : "push");
      if (!next) stopListening();
    },
    [onModeChange, stopListening],
  );

  const handleMuteToggle = useCallback(
    (next: boolean) => {
      setMuted(next);
      if (next && typeof window.speechSynthesis !== "undefined") {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
    },
    [],
  );

  const voiceOptions = useMemo(
    () =>
      voices.map((voice) => (
        <option key={voice.voiceURI} value={voice.voiceURI}>
          {voice.name} ({voice.lang})
        </option>
      )),
    [voices],
  );

  const statusLabel = recording
    ? mode === "handsfree"
      ? "Listening continuously"
      : "Listening"
    : speaking
      ? "Speaking"
      : transcribing
        ? "Transcribing"
        : "Idle";

  return (
    <section
      aria-label="Voice controls"
      className={cn("surface flex flex-col gap-4 p-4", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <AudioLines aria-hidden="true" className="h-4 w-4 text-gold" />
          Voice
        </h3>
        <div className="flex items-center gap-2">
          <Badge tone={recording ? "danger" : speaking ? "purple" : "neutral"} size="sm">
            {statusLabel}
          </Badge>
          {permissionDenied ? (
            <Badge tone="warn" size="sm">
              Mic blocked
            </Badge>
          ) : null}
        </div>
      </header>

      {/* Waveform: live heights from the analyser, pulsing via animate-voice-bar. */}
      <div
        aria-hidden="true"
        className="flex h-10 items-end justify-center gap-1 rounded-md border border-hairline bg-abyss/60 px-3 py-1"
      >
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <span
            key={index}
            ref={(element) => {
              barRefs.current[index] = element;
            }}
            className={cn(
              "w-1 rounded-full bg-gold/70 motion-safe:animate-voice-bar",
              recording ? "bg-gold" : "opacity-40",
            )}
            style={{ height: "6px", animationDelay: `${index * 45}ms` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={recording && mode === "push" ? "danger" : "secondary"}
          size="sm"
          iconLeft={recording ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
          disabled={disabled || mode !== "push"}
          aria-pressed={recording && mode === "push"}
          onPointerDown={handlePushStart}
          onPointerUp={handlePushStop}
          onPointerLeave={handlePushStop}
          onPointerCancel={handlePushStop}
          onKeyDown={handlePushKeyDown}
          onKeyUp={handlePushKeyUp}
        >
          {recording && mode === "push" ? "Release to send" : "Hold to talk"}
        </Button>

        <Button
          variant={recording && mode === "handsfree" ? "danger" : "outline"}
          size="sm"
          iconLeft={
            mode === "handsfree" ? (
              <Radio aria-hidden="true" />
            ) : (
              <Hand aria-hidden="true" />
            )
          }
          disabled={disabled}
          aria-pressed={mode === "handsfree"}
          onClick={() => {
            handleHandsfreeToggle(mode !== "handsfree");
          }}
        >
          {mode === "handsfree" ? "Hands-free on" : "Hands-free off"}
        </Button>

        {recording ? (
          <Button variant="ghost" size="sm" onClick={stopListening}>
            Stop
          </Button>
        ) : null}

        {transcribing ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Transcribing…
          </span>
        ) : null}
      </div>

      {mode === "handsfree" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={recording ? "danger" : "primary"}
            size="sm"
            disabled={disabled}
            onClick={() => {
              if (recording) stopListening();
              else void startListening();
            }}
          >
            {recording ? "Stop listening" : "Start listening"}
          </Button>
          <p className="text-xs leading-relaxed text-faint">
            Hands-free keeps the microphone open between utterances. It never
            starts on its own — use the button, and it stops when this tab is
            hidden.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Spoken reply voice
          </span>
          <Select
            value={voiceUri}
            disabled={voices.length === 0}
            onChange={(event) => setVoiceUri(event.target.value)}
            aria-label="Text-to-speech voice"
          >
            {voices.length === 0 ? <option value="">System default</option> : null}
            {voiceOptions}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Speech rate · {rate.toFixed(2)}×
          </span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            aria-label="Speech rate"
            className="h-8 w-full accent-[var(--c-gold)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Recognition language
          </span>
          <Select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label="Recognition language"
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex items-end">
          <Switch
            checked={muted}
            onCheckedChange={handleMuteToggle}
            label="Mute spoken replies"
            description="Cancels any reply being read and blocks new ones."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          disabled={disabled || typeof window === "undefined" || !capabilities.synthesis}
          onClick={() => speak("Voice check. The Cipher agent is ready.")}
        >
          Test voice
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          STT:{" "}
          {capabilities.recognition
            ? "browser"
            : capabilities.recorder
              ? "server fallback"
              : "unavailable"}{" "}
          · TTS: {capabilities.synthesis ? "browser" : "unavailable"}
        </span>
      </div>

      {interim !== "" ? (
        <p className="text-xs leading-relaxed text-muted">“{interim}”</p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs leading-relaxed text-danger"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
