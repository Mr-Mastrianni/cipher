"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { readStoredTheme, writeStoredTheme } from "@/lib/audio/sound-engine";
import {
  DEFAULT_THEME,
  isTheme,
  THEMES,
  THEME_COOKIE,
  THEME_MAX_AGE,
  type Theme,
} from "@/lib/theme";

export { THEMES };
export type { Theme };

export const THEME_LABEL: Record<Theme, string> = {
  dark: "Noir",
  light: "Ivory",
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

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
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
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
    // The cookie is what the server reads on the next request, so the correct
    // theme is in the HTML before any script could run.
    try {
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_MAX_AGE}; samesite=lax`;
    } catch {
      /* A cookie-less browser still gets the choice for this page view. */
    }
    document.documentElement.setAttribute("data-theme", next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        next === "light" ? "#faf8f4" : "#0a0a0c",
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
