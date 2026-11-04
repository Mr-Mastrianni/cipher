"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Sparkles, Volume2, VolumeX, X } from "lucide-react";

import type { SkyView } from "@/components/cipher/sky/layout";
import { cn } from "@/lib/utils";

import { GREETING, GUIDE_NAME, TOPICS, type GuideAction, type GuideTopic } from "./guide-script";

/**
 * The site's guide: a figure you can ask where things are and how they work.
 *
 * She is scripted, not generated: each topic is a short, checked answer with
 * the way to get there. The 3D model loads only when the panel is first
 * opened, so a visitor who never asks pays nothing for her.
 */

const GuideScene = dynamic(() => import("./guide-scene").then((module) => module.GuideScene), { ssr: false });

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** If the model cannot load, the guide still answers; she just has no body. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const pill =
  "inline-flex items-center gap-2 rounded-full bg-bone px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";

export function Guide({ go }: { go: (to: SkyView | null) => void }) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);
  const [topic, setTopic] = useState<GuideTopic | null>(null);
  const [voice, setVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const close = useCallback(() => {
    stopSpeaking();
    setOpen(false);
    launcher.current?.focus();
  }, [stopSpeaking]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    // Decided on the click, not in an effect: the server cannot know.
    setWebgl(detectWebgl());
    setReady(false);
    setOpen(true);
  };

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => stopSpeaking, [stopSpeaking]);

  const choose = (next: GuideTopic) => {
    setTopic(next);
    scroller.current?.scrollTo({ top: 0 });
    if (voice) speak(next.lines.join(" "));
  };

  const toggleVoice = () => {
    if (voice) {
      stopSpeaking();
      setVoice(false);
      return;
    }
    setVoice(true);
    speak(topic ? topic.lines.join(" ") : GREETING);
  };

  const act = (action: GuideAction) => {
    close();
    if (action.href) router.push(action.href);
    else go(action.to ?? null);
  };

  const lines = topic ? topic.lines : [GREETING];
  const bodyless = (
    <div className="flex h-full items-center justify-center text-gold/60">
      <Sparkles aria-hidden="true" className="h-12 w-12" strokeWidth={1} />
    </div>
  );

  return (
    <>
      {open ? (
        <div
          id="site-guide"
          ref={panel}
          role="dialog"
          aria-label="Site guide"
          tabIndex={-1}
          className="pointer-events-auto fixed inset-x-3 bottom-24 z-50 flex max-h-[min(40rem,calc(100dvh-11rem))] flex-col overflow-hidden rounded-2xl border border-hairline bg-void/95 shadow-2xl outline-none backdrop-blur-md sm:inset-x-auto sm:right-5 sm:w-[25rem]"
        >
          <div className="relative h-60 shrink-0 sm:h-72">
            {webgl && !ready ? <div className="absolute inset-0 animate-pulse">{bodyless}</div> : null}
            {webgl ? (
              <SceneBoundary fallback={bodyless}>
                <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
                  <GuideScene speaking={speaking} reduced={reduced} onReady={() => setReady(true)} />
                </div>
              </SceneBoundary>
            ) : (
              bodyless
            )}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-void/95 to-transparent" />
            <p className="caption absolute left-5 top-4">{GUIDE_NAME}</p>
            <div className="absolute right-3 top-3 flex items-center gap-1">
              {canSpeak ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-pressed={voice}
                  aria-label={voice ? "Stop reading aloud" : "Read answers aloud"}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {voice ? <Volume2 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <VolumeX aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={close}
                aria-label="Close the guide"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <X aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <div key={topic?.id ?? "greeting"} aria-live="polite" className="space-y-3 text-[15px] leading-relaxed text-bone">
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {topic && topic.actions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2.5">
                {topic.actions.map((action) => (
                  <button key={action.label} type="button" onClick={() => act(action)} className={pill}>
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="caption mt-6 text-[15px]">{topic ? "Ask about something else" : "Ask about"}</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {TOPICS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    aria-current={topic?.id === item.id ? "true" : undefined}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                      topic?.id === item.id
                        ? "border-gold text-gold"
                        : "border-hairline text-bone hover:border-gold hover:text-gold",
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <button
        ref={launcher}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="site-guide"
        aria-label={open ? "Close the guide" : "Ask the guide"}
        className="pointer-events-auto fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 bg-void/90 text-gold shadow-lg backdrop-blur transition-colors hover:border-gold hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} /> : <Sparkles aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
      </button>
    </>
  );
}
