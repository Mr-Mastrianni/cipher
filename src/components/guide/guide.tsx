"use client";

import { Component, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Sparkles, Volume2, VolumeX, X } from "lucide-react";

import type { SkyView } from "@/components/cipher/sky/layout";
import {
  boxFor,
  clampBox,
  dock,
  earthWindow,
  facing,
  isVisible,
  placeBeside,
  scrollToShow,
  springStep,
  viewportFor,
  type Rect,
  type Side,
  type Viewport,
} from "@/lib/guide/motion";
import { cn } from "@/lib/utils";

import type { GuideMotion } from "./guide-scene";
import { GREETING, GUIDE_NAME, TOPICS, type GuideAction, type GuideTopic } from "./guide-script";

/**
 * The site's guide: a figure that lives on the page, not in a window.
 *
 * She rests in the bottom-right corner, glides to the button or link she is
 * explaining (and outlines it), and can be picked up and put anywhere. What
 * she says appears in a small bubble beside her. She is scripted, not
 * generated: each topic is a short, checked answer with the way to get there.
 *
 * The 3D model loads a moment after the page settles, never on a slow or
 * data-saving connection, and the round launcher stands in until she is ready
 * or if she cannot be drawn at all.
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
class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Found {
  el: Element | null;
  rect: Rect;
}

const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

/**
 * The first of these targets that is on screen: a tagged element on the page,
 * or the Earth drawn in the scene (only where the home page's headline is).
 */
function findTarget(ids: readonly string[], view: Viewport, anywhere = false): Found | null {
  for (const id of ids) {
    if (id === "earth-view") {
      if (document.querySelector('[data-guide="hero"]')) return { el: null, rect: earthWindow(view) };
      continue;
    }
    for (const el of document.querySelectorAll(`[data-guide="${id}"]`)) {
      const rect = toRect(el.getBoundingClientRect());
      const sized = rect.right - rect.left > 0 && rect.bottom - rect.top > 0;
      if (anywhere ? sized : isVisible(rect, view)) return { el, rect };
    }
  }
  return null;
}

const pill =
  "inline-flex items-center gap-2 rounded-full bg-bone px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";

export function Guide({ go }: { go: (to: SkyView | null) => void }) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;

  const [body, setBody] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<GuideTopic | null>(null);
  const [voice, setVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const avatar = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // What the loop reads each frame; none of it needs a render.
  const motion = useRef<GuideMotion>({ vx: 0, vy: 0, face: 0 });
  const sim = useRef({ x: 0, y: 0, vx: 0, vy: 0, placed: false });
  const targets = useRef<readonly string[] | null>(null);
  const parked = useRef<{ x: number; y: number } | null>(null);
  const openNow = useRef(false);
  const drag = useRef({ down: false, active: false, startX: 0, startY: 0, dx: 0, dy: 0, x: 0, y: 0 });
  const suppressClick = useRef(false);

  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  // ── The body arrives a moment after the page settles.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const timer = window.setTimeout(() => {
      if (detectWebgl()) setBody(true);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    openNow.current = open;
  }, [open]);

  // ── The loop: where she should be, and the spring that takes her there.
  useEffect(() => {
    if (!body) return;
    const element = avatar.current;
    if (!element) return;
    const state = sim.current;
    let raf = 0;
    let last = performance.now();
    let outlined: Element | null = null;

    const outline = (next: Element | null) => {
      if (outlined === next) return;
      outlined?.removeAttribute("data-guide-active");
      next?.setAttribute("data-guide-active", "");
      outlined = next;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const view = viewportFor(window.innerWidth, window.innerHeight);
      const box = boxFor(view.w);
      const home = dock(box, view);
      const held = drag.current;

      let goal = home;
      let side: Side = "over";
      let found: Found | null = null;
      if (held.active) {
        goal = clampBox(held.x - held.dx, held.y - held.dy, box, view);
      } else {
        found = targets.current ? findTarget(targets.current, view) : null;
        if (found) {
          const spot = placeBeside(found.rect, box, view);
          goal = { x: spot.x, y: spot.y };
          side = spot.side;
        } else if (!openNow.current && parked.current) {
          goal = clampBox(parked.current.x, parked.current.y, box, view);
        }
      }

      if (!state.placed || reduced || held.active) {
        state.vx = state.placed ? (goal.x - state.x) / dt : 0;
        state.vy = state.placed ? (goal.y - state.y) / dt : 0;
        state.x = goal.x;
        state.y = goal.y;
        state.placed = true;
      } else {
        [state.x, state.vx] = springStep(state.x, state.vx, goal.x, dt);
        [state.y, state.vy] = springStep(state.y, state.vy, goal.y, dt);
      }

      element.style.transform = `translate3d(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px, 0)`;
      motion.current = { vx: state.vx, vy: state.vy, face: found ? facing(side) : 0 };
      // The target is outlined once she has arrived beside it.
      const arrived = found?.el && Math.hypot(goal.x - state.x, goal.y - state.y) < 28;
      outline(arrived ? found!.el : null);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      outline(null);
    };
  }, [body, reduced]);

  // ── Speech.
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

  useEffect(() => stopSpeaking, [stopSpeaking]);

  // ── Opening, closing, choosing.
  const close = useCallback(() => {
    stopSpeaking();
    targets.current = null;
    setOpen(false);
    setTopic(null);
    (avatar.current?.querySelector("button") ?? launcher.current)?.focus();
  }, [stopSpeaking]);

  const toggle = () => {
    if (open) close();
    else setOpen(true);
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

  const choose = (next: GuideTopic) => {
    setTopic(next);
    scroller.current?.scrollTo({ top: 0 });
    targets.current = next.targets ?? null;
    // Bring what she is pointing at into the part of the screen the bubble leaves free.
    if (next.targets) {
      const view = viewportFor(window.innerWidth, window.innerHeight);
      const found = findTarget(next.targets, view, true);
      const behavior = reduced ? "auto" : "smooth";
      if (found?.el === null) window.scrollTo({ top: 0, behavior });
      else if (found?.el && !found.el.closest("header")) {
        const by = scrollToShow(found.rect, view);
        if (by !== 0) window.scrollBy({ top: by, behavior });
      }
    }
    if (voice) speak(next.lines.join(" "));
  };

  const askAgain = () => {
    targets.current = null;
    setTopic(null);
    scroller.current?.scrollTo({ top: 0 });
    if (voice) speak(GREETING);
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

  // ── Picking her up: a drag moves her, a tap opens her.
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const state = sim.current;
    drag.current = {
      down: true,
      active: false,
      startX: event.clientX,
      startY: event.clientY,
      dx: event.clientX - state.x,
      dy: event.clientY - state.y,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const held = drag.current;
    if (!held.down) return;
    held.x = event.clientX;
    held.y = event.clientY;
    if (!held.active && !openNow.current && Math.hypot(held.x - held.startX, held.y - held.startY) > 8) {
      held.active = true;
    }
  };

  const onPointerUp = () => {
    const held = drag.current;
    if (held.active) {
      // Put down where she is; near her corner she settles back into it.
      const view = viewportFor(window.innerWidth, window.innerHeight);
      const home = dock(boxFor(view.w), view);
      const state = sim.current;
      parked.current = Math.hypot(state.x - home.x, state.y - home.y) < 72 ? null : { x: state.x, y: state.y };
      suppressClick.current = true;
    }
    drag.current = { ...held, down: false, active: false };
  };

  const onAvatarClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    toggle();
  };

  const lines = topic ? topic.lines : [GREETING];
  const showLauncher = !body || !ready;

  return (
    <>
      {body ? (
        <div
          ref={avatar}
          className={cn(
            "pointer-events-none fixed left-0 top-0 z-50 h-[132px] w-[124px] will-change-transform sm:h-[184px] sm:w-[176px]",
            "transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <SceneBoundary onFail={() => setBody(false)}>
            <GuideScene motion={motion} speaking={speaking} reduced={reduced} onReady={() => setReady(true)} />
          </SceneBoundary>
          <button
            type="button"
            onClick={onAvatarClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-expanded={open}
            aria-controls="site-guide"
            aria-label={open ? "Close the guide" : "Ask the guide"}
            className="pointer-events-auto absolute inset-x-[12%] inset-y-[6%] cursor-grab touch-none rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:cursor-grabbing"
          />
        </div>
      ) : null}

      {open ? (
        <div
          id="site-guide"
          ref={panel}
          role="dialog"
          aria-label="Site guide"
          tabIndex={-1}
          className={cn(
            "pointer-events-auto fixed inset-x-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-hairline bg-void/95 shadow-2xl outline-none backdrop-blur-md",
            "bottom-[152px] sm:inset-x-auto sm:bottom-[204px] sm:right-5 sm:w-[25rem]",
            topic
              ? "max-h-[44dvh] sm:max-h-[min(30rem,calc(100dvh-17.75rem))]"
              : "max-h-[calc(100dvh-14.5rem)] sm:max-h-[min(34rem,calc(100dvh-17.75rem))]",
          )}
        >
          <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3">
            <p className="caption">{GUIDE_NAME}</p>
            <div className="-mr-2 flex items-center gap-1">
              {canSpeak ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-pressed={voice}
                  aria-label={voice ? "Stop reading aloud" : "Read answers aloud"}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {voice ? (
                    <Volume2 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  ) : (
                    <VolumeX aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  )}
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

            {topic ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                {topic.actions.map((action) => (
                  <button key={action.label} type="button" onClick={() => act(action)} className={pill}>
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={askAgain}
                  className="text-[14px] text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-bone hover:decoration-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Ask about something else
                </button>
              </div>
            ) : (
              <>
                <p className="caption mt-6 text-[15px]">Ask about</p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {TOPICS.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => choose(item)}
                        className="rounded-full border border-hairline px-3.5 py-2 text-left text-[14px] text-bone transition-colors hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}

      {showLauncher ? (
        <button
          ref={launcher}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="site-guide"
          aria-label={open ? "Close the guide" : "Ask the guide"}
          className="pointer-events-auto fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 bg-void/90 text-gold shadow-lg backdrop-blur transition-colors hover:border-gold hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          {open ? (
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Sparkles aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
          )}
        </button>
      ) : null}
    </>
  );
}
