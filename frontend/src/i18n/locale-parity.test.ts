import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { UNTRANSLATED_WHITELIST } from "./untranslated-whitelist";

const LOCALES_DIR = path.resolve(__dirname, "../../public/locales");
const LOCALES = ["zh-CN", "en-US", "es-ES", "es-MX", "es-US"] as const;
const ES_LOCALES = ["es-ES", "es-MX", "es-US"] as const;

const NAMESPACES = fs
  .readdirSync(path.join(LOCALES_DIR, "en-US"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

function readNs(locale: string, ns: string): Record<string, unknown> {
  const filePath = path.join(LOCALES_DIR, locale, `${ns}.json`);
  expect(fs.existsSync(filePath), `missing ${filePath}`).toBe(true);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function collectLeaves(obj: Record<string, unknown>, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else if (v && typeof v === "object") {
      for (const [ck, cv] of collectLeaves(v as Record<string, unknown>, key)) out.set(ck, cv);
    }
  }
  return out;
}

const INTERPOLATION_RE = /\{\{(\w+)\}\}/g;
function tokens(s: string): Set<string> {
  return new Set(Array.from(s.matchAll(INTERPOLATION_RE)).map((m) => m[1] as string));
}

describe.each(NAMESPACES)("locale parity: %s", (ns) => {
  it(`all locales have the same key set as en-US for ${ns}`, () => {
    const enUS = collectLeaves(readNs("en-US", ns));
    for (const locale of LOCALES) {
      if (locale === "en-US") continue;
      const other = collectLeaves(readNs(locale, ns));
      expect(new Set(other.keys()), `${locale}/${ns}.json key mismatch`).toEqual(new Set(enUS.keys()));
    }
  });

  it(`no empty/whitespace-only values for ${ns}`, () => {
    for (const locale of LOCALES) {
      const leaves = collectLeaves(readNs(locale, ns));
      for (const [key, value] of leaves) {
        expect(value.trim().length, `${locale}/${ns}.json#${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it(`interpolation tokens match en-US for ${ns}`, () => {
    const enUS = collectLeaves(readNs("en-US", ns));
    for (const locale of LOCALES) {
      if (locale === "en-US") continue;
      const other = collectLeaves(readNs(locale, ns));
      for (const [key, value] of enUS) {
        expect(tokens(other.get(key) ?? ""), `${locale}/${ns}.json#${key} interpolation mismatch`).toEqual(tokens(value));
      }
    }
  });

  it(`es-* values differ from en-US unless whitelisted for ${ns}`, () => {
    const enUS = collectLeaves(readNs("en-US", ns));
    for (const locale of ES_LOCALES) {
      const other = collectLeaves(readNs(locale, ns));
      for (const [key, value] of enUS) {
        const fullKey = `${ns}.${key}`;
        if (UNTRANSLATED_WHITELIST.includes(fullKey)) continue;
        expect(other.get(key), `${locale}/${ns}.json#${key} looks untranslated`).not.toBe(value);
      }
    }
  });
});

describe("untranslated-whitelist guardrail", () => {
  it("stays small (Pitfall 6)", () => {
    expect(UNTRANSLATED_WHITELIST.length).toBeLessThanOrEqual(15);
  });
});
