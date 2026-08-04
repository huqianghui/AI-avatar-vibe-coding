import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tab structure validation tests for HCP Editor Agent Config Center (Phase 15).
 *
 * These tests verify:
 * 1. Exactly 2 tabs rendered (Profile, Voice & Avatar) -- Knowledge/Tools removed
 * 2. Legacy tab IDs fall back gracefully
 * 3. i18n key parity between en-US and zh-CN
 * 4. PlaygroundPreviewPanel lifecycle safeguards
 * 5. InstructionsSection race condition guard
 *
 * Uses source file analysis (reading .tsx files as text) rather than full
 * component rendering. This is intentional -- full component rendering would
 * require mocking 15+ hooks, React Router, i18n, and QueryClient. Source
 * analysis catches the critical structural regressions with minimal setup.
 */

// Helper: read JSON locale files via fs to avoid Vite transform issues with Chinese quotes
function readLocaleJson(locale: string, ns: string): Record<string, unknown> {
  const filePath = path.resolve(
    __dirname,
    `../../public/locales/${locale}/${ns}.json`,
  );
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
    string,
    unknown
  >;
}

// Test 1: i18n key parity (most critical -- runs without React rendering)
describe("i18n key parity", () => {
  it("en-US and zh-CN admin.json have matching Phase 15 keys", () => {
    const enAdmin = readLocaleJson("en-US", "admin") as Record<
      string,
      Record<string, string>
    >;
    const zhAdmin = readLocaleJson("zh-CN", "admin") as Record<
      string,
      Record<string, string>
    >;

    const phase15Keys = [
      "modelDeployment",
      "voiceModeToggle",
      "voiceModeDescription",
      "vlInstanceLabel",
      "vlInstanceNone",
      "instructionsHint",
      "knowledgeAndTools",
      "knowledgePlaceholder",
      "toolsPlaceholder",
      "playgroundTitle",
      "playgroundStart",
      "playgroundStop",
      "playgroundDisabledNew",
      "playgroundDisabledNoVl",
      "transcriptUser",
      "transcriptAgent",
      "instructionsError",
      "testConnectionError",
      "permissionDeniedMic",
      "playgroundChatPlaceholder",
      "playgroundChatSend",
      "playgroundChatReady",
      "playgroundChatNoAgent",
      "playgroundChatThinking",
      "playgroundVoiceHint",
      "voiceAvatarConfigTitle",
    ];

    const enHcpSection = enAdmin["hcp"] ?? {};
    const zhHcpSection = zhAdmin["hcp"] ?? {};

    for (const key of phase15Keys) {
      expect(
        enHcpSection,
        `en-US admin.json missing hcp.${key}`,
      ).toHaveProperty(key);
      expect(
        zhHcpSection,
        `zh-CN admin.json missing hcp.${key}`,
      ).toHaveProperty(key);
      expect(typeof enHcpSection[key]).toBe("string");
      expect(typeof zhHcpSection[key]).toBe("string");
    }
  });

  it("en-US and zh-CN common.json have generate/regenerate keys", () => {
    const enData = readLocaleJson("en-US", "common");
    const zhData = readLocaleJson("zh-CN", "common");

    expect(enData).toHaveProperty("generate");
    expect(enData).toHaveProperty("regenerate");
    expect(zhData).toHaveProperty("generate");
    expect(zhData).toHaveProperty("regenerate");
  });
});

// Test 2: Tab structure validation (static analysis -- no full render needed)
describe("HCP editor tab structure", () => {
  const editorPath = path.resolve(
    __dirname,
    "../pages/admin/hcp-profile-editor.tsx",
  );

  it("hcp-profile-editor.tsx contains exactly 2 TabsTrigger JSX elements", () => {
    const source = fs.readFileSync(editorPath, "utf-8");
    // Match JSX usage <TabsTrigger only, not import statements
    const tabsTriggerMatches = source.match(/<TabsTrigger/g) ?? [];
    expect(tabsTriggerMatches.length).toBe(2);

    const tabsContentMatches = source.match(/<TabsContent/g) ?? [];
    expect(tabsContentMatches.length).toBe(2);
  });

  it("hcp-profile-editor.tsx does NOT contain knowledge or tools tabs", () => {
    const source = fs.readFileSync(editorPath, "utf-8");
    expect(source).not.toContain('value="knowledge"');
    expect(source).not.toContain('value="tools"');
    expect(source).not.toContain("BookOpen");
    expect(source).not.toContain("Wrench");
  });

  it("hcp-profile-editor.tsx has VALID_TABS for legacy tab ID fallback", () => {
    const source = fs.readFileSync(editorPath, "utf-8");
    expect(source).toContain("VALID_TABS");
  });

  it("hcp-profile-editor.tsx preserves Form wrapping Tabs", () => {
    const source = fs.readFileSync(editorPath, "utf-8");
    // Form must appear before Tabs (Form wraps Tabs for state persistence)
    const formIndex = source.indexOf("<Form");
    const tabsIndex = source.indexOf("<Tabs");
    expect(formIndex).toBeGreaterThan(-1);
    expect(tabsIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeLessThan(tabsIndex);
  });

  // VMODE-01 regression guard: the removed "Voice Live Instance" card must
  // never silently reappear in agent-config-left-panel.tsx.
  it("agent-config-left-panel.tsx does not reintroduce the removed Voice Live Instance card (VMODE-01)", () => {
    const leftPanelPath = path.resolve(
      __dirname,
      "../components/admin/agent-config-left-panel.tsx",
    );
    const source = fs.readFileSync(leftPanelPath, "utf-8");
    expect(source).not.toContain("useVoiceLiveInstances");
    expect(source).not.toContain("vlInstanceEmptyTitle");
  });
});

// Test 3: VoiceTestPlayground has lifecycle safeguards
// (Voice logic was extracted from PlaygroundPreviewPanel to shared VoiceTestPlayground)
describe("VoiceTestPlayground lifecycle safeguards", () => {
  const voicePath = path.resolve(
    __dirname,
    "../components/voice/voice-test-playground.tsx",
  );

  it("voice-test-playground.tsx has session state machine", () => {
    const source = fs.readFileSync(voicePath, "utf-8");
    expect(source).toContain("idle");
    expect(source).toContain("connecting");
    expect(source).toContain("connected");
    expect(source).toContain("stopping");
  });

  it("voice-test-playground.tsx has unmount cleanup (via lifecycle hook)", () => {
    // Cleanup logic was extracted to use-voice-session-lifecycle.ts;
    // playground calls stopVoiceSession() on unmount which internally
    // invokes audioHandler.cleanup + audioPlayer.stopAudio.
    const source = fs.readFileSync(voicePath, "utf-8");
    expect(source).toContain("stopVoiceSession");
    // Verify the lifecycle hook itself has the direct cleanup calls
    const lifecyclePath = path.resolve(
      __dirname,
      "../hooks/use-voice-session-lifecycle.ts",
    );
    const lifecycleSource = fs.readFileSync(lifecyclePath, "utf-8");
    expect(lifecycleSource).toContain("audioHandler.cleanup");
    expect(lifecycleSource).toContain("audioPlayer.stopAudio");
  });

  it("voice-test-playground.tsx has transcript buffer cap", () => {
    const source = fs.readFileSync(voicePath, "utf-8");
    expect(source).toMatch(/MAX_TRANSCRIPTS|maxTranscripts|\.slice/);
  });

  it("voice-test-playground.tsx handles mic permission denied (via lifecycle hook)", () => {
    // NotAllowedError handling was extracted to use-voice-session-lifecycle.ts;
    // playground passes onMicDenied callback which shows permissionDeniedMic toast.
    const source = fs.readFileSync(voicePath, "utf-8");
    expect(source).toContain("permissionDeniedMic");
    expect(source).toContain("onMicDenied");
    // Verify the lifecycle hook handles the actual NotAllowedError
    const lifecyclePath = path.resolve(
      __dirname,
      "../hooks/use-voice-session-lifecycle.ts",
    );
    const lifecycleSource = fs.readFileSync(lifecyclePath, "utf-8");
    expect(lifecycleSource).toContain("NotAllowedError");
  });
});

// Test 4: Instructions section has race condition guard
describe("InstructionsSection race condition guard", () => {
  it("instructions-section.tsx has AbortController for request cancellation", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../components/admin/instructions-section.tsx",
      ),
      "utf-8",
    );
    expect(source).toMatch(/AbortController|abortController|abort/i);
  });
});
