"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

const STORAGE_KEY = "devstack-theme";
const COLOR_SCHEME = "(prefers-color-scheme: light)";

function readPreference(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // The preference remains available in memory when storage is unavailable.
  }
  return "dark";
}

function subscribeToPreference(onChange: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function subscribeToColorScheme(onChange: () => void): () => void {
  const media = window.matchMedia(COLOR_SCHEME);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function prefersLight(): boolean {
  return window.matchMedia(COLOR_SCHEME).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const storedTheme = useSyncExternalStore<Theme>(subscribeToPreference, readPreference, () => "dark");
  const systemLight = useSyncExternalStore(subscribeToColorScheme, prefersLight, () => false);
  const [temporaryTheme, setTemporaryTheme] = useState<Theme | null>(null);
  const theme = temporaryTheme ?? storedTheme;
  const resolvedTheme = theme === "system" ? (systemLight ? "light" : "dark") : theme;

  useEffect(() => {
    // Read the current browser preferences on the first commit to preserve the
    // colors already applied by the root layout's pre-hydration script.
    const preference = temporaryTheme ?? readPreference();
    const light = preference === "light" || (preference === "system" && prefersLight());
    const root = document.documentElement;
    root.dataset.theme = preference;
    root.classList.toggle("light", light);
    root.classList.toggle("dark", !light);
  }, [theme, resolvedTheme, temporaryTheme]);

  function setTheme(newTheme: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      setTemporaryTheme(null);
    } catch {
      setTemporaryTheme(newTheme);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
