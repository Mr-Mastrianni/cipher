"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cue, sound, type Cue } from "@/lib/audio/sound-engine";

interface SoundContextValue {
  enabled: boolean;
  unlocked: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  play: (cue: Cue) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    sound.init();
    setEnabledState(sound.isEnabled());
    const unsubscribe = sound.subscribe(setEnabledState);
    return () => {
      unsubscribe();
    };
  }, []);

  // The first gesture anywhere unlocks audio for the rest of the session.
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
      setUnlocked(sound.isUnlocked());
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
    ];
    for (const event of events) {
      window.addEventListener(event, unlock, { once: true, passive: true });
    }
    return () => {
      for (const event of events) window.removeEventListener(event, unlock);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = sound.toggle();
    setEnabledState(next);
    setUnlocked(sound.isUnlocked());
    if (next) cue("select");
  }, []);

  const setEnabled = useCallback(
    (value: boolean) => {
      sound.setEnabled(value);
      setEnabledState(value);
    },
    [],
  );

  const play = useCallback((name: Cue) => sound.play(name), []);

  const value = useMemo(
    () => ({ enabled, unlocked, toggle, setEnabled, play }),
    [enabled, unlocked, toggle, setEnabled, play],
  );

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used inside <SoundProvider>");
  }
  return context;
}
