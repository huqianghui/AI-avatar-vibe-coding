import { describe, it, expect } from "vitest";
import {
  VOICE_NAME_OPTIONS,
  TURN_DETECTION_TYPES,
  RECOGNITION_LANGUAGES,
  CDN_BASE,
  createDefaultVlInstanceForm,
  voiceOptionsForLanguage,
} from "../voice-constants";

describe("voice-constants", () => {
  it("VOICE_NAME_OPTIONS has entries with value and labelKey", () => {
    expect(VOICE_NAME_OPTIONS.length).toBeGreaterThan(0);
    for (const opt of VOICE_NAME_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("VOICE_NAME_OPTIONS contains expected English and Chinese voices", () => {
    const values = VOICE_NAME_OPTIONS.map((o) => o.value);
    expect(values).toContain("en-US-AvaNeural");
    expect(values).toContain("zh-CN-XiaoxiaoNeural");
  });

  it("VOICE_NAME_OPTIONS contains the six new Spanish voices across all three variants", () => {
    const values = VOICE_NAME_OPTIONS.map((o) => o.value);
    expect(values).toContain("es-ES-ElviraNeural");
    expect(values).toContain("es-ES-AlvaroNeural");
    expect(values).toContain("es-MX-DaliaNeural");
    expect(values).toContain("es-MX-JorgeNeural");
    expect(values).toContain("es-US-PalomaNeural");
    expect(values).toContain("es-US-AlonsoNeural");
  });

  it("every option has a locale field", () => {
    for (const opt of VOICE_NAME_OPTIONS) {
      expect(opt.locale).toBeTruthy();
    }
  });

  it("zh-CN-XiaoxiaoMultilingualNeural is flagged multilingual, others are not", () => {
    const multilingual = VOICE_NAME_OPTIONS.filter(
      (opt) => "multilingual" in opt && opt.multilingual,
    ).map((opt) => opt.value);
    expect(multilingual).toEqual(["zh-CN-XiaoxiaoMultilingualNeural"]);
  });

  it("TURN_DETECTION_TYPES has entries with value and labelKey", () => {
    expect(TURN_DETECTION_TYPES.length).toBeGreaterThan(0);
    for (const opt of TURN_DETECTION_TYPES) {
      expect(opt.value).toBeTruthy();
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("TURN_DETECTION_TYPES includes server_vad and semantic_vad", () => {
    const values = TURN_DETECTION_TYPES.map((t) => t.value);
    expect(values).toContain("server_vad");
    expect(values).toContain("semantic_vad");
  });

  it("RECOGNITION_LANGUAGES includes auto, zh-CN, en-US, and all three Spanish variants", () => {
    const values = RECOGNITION_LANGUAGES.map((l) => l.value);
    expect(values).toEqual(["auto", "zh-CN", "en-US", "es-ES", "es-MX", "es-US"]);
  });

  it("RECOGNITION_LANGUAGES no longer includes ja-JP or ko-KR", () => {
    const values = RECOGNITION_LANGUAGES.map((l) => l.value);
    expect(values).not.toContain("ja-JP");
    expect(values).not.toContain("ko-KR");
  });

  it("RECOGNITION_LANGUAGES has entries with value and labelKey", () => {
    expect(RECOGNITION_LANGUAGES.length).toBeGreaterThan(0);
    for (const lang of RECOGNITION_LANGUAGES) {
      expect(lang.value).toBeTruthy();
      expect(lang.labelKey).toBeTruthy();
    }
  });

  it("CDN_BASE is a valid Azure URL string", () => {
    expect(CDN_BASE).toContain("https://");
    expect(CDN_BASE).toContain("azure");
  });
});

describe("voiceOptionsForLanguage", () => {
  it("returns only es-ES voices plus multilingual voices for es-ES", () => {
    const values = voiceOptionsForLanguage("es-ES").map((o) => o.value);
    expect(values).toEqual([
      "zh-CN-XiaoxiaoMultilingualNeural",
      "es-ES-ElviraNeural",
      "es-ES-AlvaroNeural",
    ]);
  });

  it("returns only es-MX voices plus multilingual voices for es-MX", () => {
    const values = voiceOptionsForLanguage("es-MX").map((o) => o.value);
    expect(values).toEqual([
      "zh-CN-XiaoxiaoMultilingualNeural",
      "es-MX-DaliaNeural",
      "es-MX-JorgeNeural",
    ]);
  });

  it("returns only en-US voices plus multilingual voices for en-US", () => {
    const values = voiceOptionsForLanguage("en-US").map((o) => o.value);
    expect(values).toContain("en-US-AvaNeural");
    expect(values).toContain("en-US-JennyNeural");
    expect(values).toContain("zh-CN-XiaoxiaoMultilingualNeural");
    expect(values).not.toContain("zh-CN-XiaoxiaoNeural");
    expect(values).not.toContain("es-ES-ElviraNeural");
  });

  it("returns all options for auto", () => {
    expect(voiceOptionsForLanguage("auto")).toEqual(VOICE_NAME_OPTIONS);
  });

  it("returns all options for an unrecognized locale", () => {
    expect(voiceOptionsForLanguage("fr-FR")).toEqual(VOICE_NAME_OPTIONS);
  });
});

describe("createDefaultVlInstanceForm", () => {
  it("returns a fresh object each call", () => {
    const a = createDefaultVlInstanceForm();
    const b = createDefaultVlInstanceForm();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("returns expected default values", () => {
    const form = createDefaultVlInstanceForm();
    expect(form.name).toBe("");
    expect(form.voice_live_model).toBe("gpt-4o");
    expect(form.enabled).toBe(true);
    expect(form.voice_name).toBe("en-US-AvaNeural");
    expect(form.avatar_character).toBe("lori");
    expect(form.turn_detection_type).toBe("server_vad");
    expect(form.recognition_language).toBe("auto");
  });

  it("returns expected numeric defaults", () => {
    const form = createDefaultVlInstanceForm();
    expect(form.voice_temperature).toBe(0.9);
    expect(form.response_temperature).toBe(0.8);
    expect(form.playback_speed).toBe(1.0);
  });

  it("returns expected boolean defaults", () => {
    const form = createDefaultVlInstanceForm();
    expect(form.avatar_enabled).toBe(true);
    expect(form.proactive_engagement).toBe(true);
    expect(form.auto_detect_language).toBe(true);
    expect(form.noise_suppression).toBe(false);
    expect(form.echo_cancellation).toBe(false);
    expect(form.eou_detection).toBe(false);
    expect(form.voice_custom).toBe(false);
    expect(form.avatar_customized).toBe(false);
    expect(form.custom_lexicon_enabled).toBe(false);
  });

  it("mutation of one instance does not affect another", () => {
    const a = createDefaultVlInstanceForm();
    a.name = "mutated";
    const b = createDefaultVlInstanceForm();
    expect(b.name).toBe("");
  });
});
