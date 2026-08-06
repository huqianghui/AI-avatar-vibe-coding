import { describe, expect, it } from "vitest";
import { getFluentTheme, __TEST_ONLY__, type FluentAccentColor, type FluentThemeMode } from "./fluent-theme";

const ACCENTS: FluentAccentColor[] = ["blue", "teal", "purple", "rose", "amber"];
const MODES: FluentThemeMode[] = ["light", "dark"];

describe("getFluentTheme", () => {
  it("returns a non-null Theme with colorBrandBackground for all 5 accents x 2 modes", () => {
    for (const mode of MODES) {
      for (const accent of ACCENTS) {
        const theme = getFluentTheme(mode, accent);
        expect(theme).not.toBeNull();
        expect(typeof theme.colorBrandBackground).toBe("string");
        expect(theme.colorBrandBackground.length).toBeGreaterThan(0);
      }
    }
  });

  it("caches themes -- same (mode, accent) returns the exact same object reference", () => {
    const first = getFluentTheme("light", "blue");
    const second = getFluentTheme("light", "blue");
    expect(first).toBe(second);

    const firstDark = getFluentTheme("dark", "amber");
    const secondDark = getFluentTheme("dark", "amber");
    expect(firstDark).toBe(secondDark);
  });

  it("each accent's generated ramp round-trips to the anchor hex at stop 80 (case-insensitive)", () => {
    for (const accent of ACCENTS) {
      const ramp = __TEST_ONLY__.RAMPS[accent];
      const anchorHex = __TEST_ONLY__.ACCENT_ANCHOR_HEX[accent];
      expect(ramp[__TEST_ONLY__.ANCHOR_STOP as keyof typeof ramp].toLowerCase()).toBe(
        anchorHex.toLowerCase()
      );
    }
  });
});
