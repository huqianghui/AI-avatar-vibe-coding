import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  setThemeMode,
  setAccentColor,
  useThemeStore,
  ACCENT_COLORS,
} from "@/stores/theme-store";

describe("theme-store", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to defaults
    act(() => {
      setThemeMode("light");
      setAccentColor("blue");
    });
  });

  it("should start with light mode and blue accent by default", () => {
    const { result } = renderHook(() => useThemeStore());
    expect(result.current.mode).toBe("light");
    expect(result.current.accent).toBe("blue");
  });

  it("should expose setThemeMode and setAccentColor on hook return", () => {
    const { result } = renderHook(() => useThemeStore());
    expect(typeof result.current.setThemeMode).toBe("function");
    expect(typeof result.current.setAccentColor).toBe("function");
  });

  it("ACCENT_COLORS contains all five named accents", () => {
    expect(ACCENT_COLORS).toHaveLength(5);
    const names = ACCENT_COLORS.map((a) => a.name);
    expect(names).toContain("blue");
    expect(names).toContain("teal");
    expect(names).toContain("purple");
    expect(names).toContain("rose");
    expect(names).toContain("amber");
  });

  it("setThemeMode('dark') updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      setThemeMode("dark");
    });

    expect(result.current.mode).toBe("dark");
    expect(localStorage.getItem("ai-avatar-theme")).toBe("dark");
  });

  it("setThemeMode('dark') adds dark class to documentElement", () => {
    act(() => {
      setThemeMode("dark");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setThemeMode('light') removes dark class from documentElement", () => {
    act(() => {
      setThemeMode("dark");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      setThemeMode("light");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setAccentColor('teal') updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      setAccentColor("teal");
    });

    expect(result.current.accent).toBe("teal");
    expect(localStorage.getItem("ai-avatar-accent")).toBe("teal");
  });

  it("setAccentColor('purple') adds theme-purple class to documentElement", () => {
    act(() => {
      setAccentColor("purple");
    });
    expect(document.documentElement.classList.contains("theme-purple")).toBe(true);
  });

  it("setAccentColor('blue') does NOT add theme-blue class (blue is the default)", () => {
    act(() => {
      setAccentColor("rose");
    });
    expect(document.documentElement.classList.contains("theme-rose")).toBe(true);

    act(() => {
      setAccentColor("blue");
    });
    // Blue is the default — no theme-* class should be present
    expect(document.documentElement.className).not.toMatch(/theme-\w+/);
  });

  it("setAccentColor removes previous theme class when switching", () => {
    act(() => {
      setAccentColor("amber");
    });
    expect(document.documentElement.classList.contains("theme-amber")).toBe(true);

    act(() => {
      setAccentColor("rose");
    });
    expect(document.documentElement.classList.contains("theme-rose")).toBe(true);
    expect(document.documentElement.classList.contains("theme-amber")).toBe(false);
  });

  it("notifies all subscribers when theme mode changes", () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      setThemeMode("dark");
    });
    expect(result.current.mode).toBe("dark");

    act(() => {
      setThemeMode("light");
    });
    expect(result.current.mode).toBe("light");
  });

  it("notifies all subscribers when accent color changes", () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      setAccentColor("amber");
    });
    expect(result.current.accent).toBe("amber");

    act(() => {
      setAccentColor("teal");
    });
    expect(result.current.accent).toBe("teal");
  });
});
