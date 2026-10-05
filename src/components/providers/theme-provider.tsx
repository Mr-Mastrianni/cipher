"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

export function ThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Adopt whatever the inline head script already applied, so there is no
  // flash and no mismatch between SSR markup and the live document.
  useEffect(() => {
    const stored = readStoredTheme();
    if (isTheme(stored)) {
      setThemeState(stored);
      return;
    }
    const attr = document.documentElement.getAttribute("data-theme");
    if (isTheme(attr)) setThemeState(attr);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
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
