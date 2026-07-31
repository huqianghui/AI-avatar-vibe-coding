import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";
type AccentColor = "blue" | "teal" | "purple" | "rose" | "amber";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
}

const THEME_STORAGE_KEY = "ai-avatar-theme";
const ACCENT_STORAGE_KEY = "ai-avatar-accent";

export const ACCENT_COLORS = [
  { name: "blue" as const, color: "#1E40AF", label: "BeiGene Blue" },
  { name: "teal" as const, color: "#0D9488", label: "Teal" },
  { name: "purple" as const, color: "#7C3AED", label: "Purple" },
  { name: "rose" as const, color: "#BE185D", label: "Rose" },
  { name: "amber" as const, color: "#B45309", label: "Amber" },
] as const;

function isValidMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function isValidAccent(value: string | null): value is AccentColor {
  return (
    value === "blue" ||
    value === "teal" ||
    value === "purple" ||
    value === "rose" ||
    value === "amber"
  );
}

function applyTheme(mode: ThemeMode, accent: AccentColor) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  // Remove all theme-* classes, then add the current one
  root.className = root.className.replace(/theme-\w+/g, "").trim();
  if (accent !== "blue") {
    root.classList.add(`theme-${accent}`);
  }
}

// Initialize from localStorage
const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);

let themeState: ThemeState = {
  mode: isValidMode(storedMode) ? storedMode : "light",
  accent: isValidAccent(storedAccent) ? storedAccent : "blue",
};

// Apply theme on module load
applyTheme(themeState.mode, themeState.accent);

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeState {
  return themeState;
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  themeState = { ...themeState, mode };
  applyTheme(themeState.mode, themeState.accent);
  emitChange();
}

export function setAccentColor(accent: AccentColor) {
  localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  themeState = { ...themeState, accent };
  applyTheme(themeState.mode, themeState.accent);
  emitChange();
}

export function useThemeStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return {
    mode: state.mode,
    accent: state.accent,
    setThemeMode,
    setAccentColor,
  };
}

export type { ThemeMode, AccentColor };
