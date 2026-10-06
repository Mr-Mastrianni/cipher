"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { readStoredTheme, writeStoredTheme } from "@/lib/audio/sound-engine";

export const THEMES = ["dark", "light", "plum", "moss"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABEL: Record<Theme, string> = {
  dark: "Void",
  light: "Bone",
  plum: "Plum",
  moss: "Moss",
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Re-render when anything changes the root element's `data-theme`. */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

/** The applied theme: the stored choice, else the attribute, else the default. */
function readDocumentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (isTheme(attr)) return attr;
  const stored = readStoredTheme();
  return isTheme(stored) ? stored : "dark";
}

export function ThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  // The document's `data-theme` attribute is the source of truth: the inline
  // head script sets it before paint, and `setTheme` updates it. Reading it as
  // an external store avoids a flash and needs no state mirrored by an effect.
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readDocumentTheme,
    () => initialTheme,
  );

  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        next === "light" ? "#fbfaf7" : next === "plum" ? "#2c2733" : next === "moss" ? "#131a16" : "#0b0b11",
      );
    }
  }, []);

  const cycle = useCallback(() => {
    const index = THEMES.indexOf(theme);
    setTheme(THEMES[(index + 1) % THEMES.length]);
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, cycle }),
    [theme, setTheme, cycle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
