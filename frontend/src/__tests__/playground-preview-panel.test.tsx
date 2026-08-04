import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * PlaygroundPreviewPanel structural and behavioral tests.
 *
 * Verifies:
 * 1. Text chat mode UI elements (input, send button, messages area)
 * 2. Voice mode delegates to VoiceTestPlayground (shared component)
 * 3. Mode switching (voiceModeEnabled prop drives UI branch)
 * 4. testChatWithAgent API integration (imported and called)
 * 5. Lifecycle cleanup (unmount, profile change effects)
 */

const panelPath = path.resolve(
  __dirname,
  "../components/admin/playground-preview-panel.tsx",
);
const source = fs.readFileSync(panelPath, "utf-8");

describe("PlaygroundPreviewPanel: Text Chat Mode (Voice OFF)", () => {
  it("imports testChatWithAgent for text chat API calls", () => {
    expect(source).toContain("testChatWithAgent");
    expect(source).toContain('from "@/api/hcp-profiles"');
  });

  it("renders chat messages area with ScrollArea", () => {
    expect(source).toContain("ScrollArea");
    expect(source).toContain("chatMessages");
  });

  it("renders text chat input with placeholder", () => {
    expect(source).toContain("playgroundChatPlaceholder");
    expect(source).toContain("<Input");
    expect(source).toContain("chatInput");
  });

  it("renders send button with Send icon", () => {
    expect(source).toContain("<Send");
    expect(source).toContain("sendChatMessage");
    expect(source).toContain("playgroundChatSend");
  });

  it("shows loading spinner while chat is processing", () => {
    expect(source).toContain("chatLoading");
    expect(source).toContain("Loader2");
    expect(source).toContain("playgroundChatThinking");
  });

  it("displays empty state with MessageSquare icon when no messages", () => {
    expect(source).toContain("chatMessages.length === 0");
    expect(source).toContain("MessageSquare");
    expect(source).toContain("playgroundChatReady");
    expect(source).toContain("playgroundChatNoAgent");
  });

  it("handles Enter key to send message", () => {
    expect(source).toContain("handleChatKeyDown");
    expect(source).toContain('e.key === "Enter"');
    expect(source).toContain("e.preventDefault");
  });

  it("supports multi-turn conversation with response_id", () => {
    expect(source).toContain("chatResponseId");
    expect(source).toContain("previous_response_id");
    expect(source).toContain("result.response_id");
  });

  it("displays error messages with distinct styling", () => {
    expect(source).toContain("[Error]");
    expect(source).toContain("bg-red-100");
  });

  it("disables chat when no agent is synced (hasAgent check)", () => {
    expect(source).toContain("const hasAgent = !!agentId");
    expect(source).toContain("!hasAgent");
  });
});

describe("PlaygroundPreviewPanel: Voice Mode (Voice ON) — VoiceTestPlayground delegation", () => {
  it("imports VoiceTestPlayground from shared component", () => {
    expect(source).toContain("VoiceTestPlayground");
    expect(source).toContain('from "@/components/voice/voice-test-playground"');
  });

  it("renders VoiceTestPlayground when voiceModeEnabled is true", () => {
    expect(source).toContain("<VoiceTestPlayground");
  });

  it("passes hcpProfileId and vlInstanceId to VoiceTestPlayground", () => {
    expect(source).toContain("hcpProfileId={hcpProfileId}");
    expect(source).toContain("vlInstanceId={vlInstanceId}");
  });

  it("passes systemPrompt to VoiceTestPlayground", () => {
    expect(source).toContain("systemPrompt={systemPrompt}");
  });

  it("passes avatarCharacter conditionally (only when avatarEnabled)", () => {
    expect(source).toContain("avatarEnabled ? avatarCharacter : undefined");
  });

  it("passes avatarStyle conditionally (only when avatarEnabled)", () => {
    expect(source).toContain("avatarEnabled ? avatarStyle : undefined");
  });

  it("passes hcpName from profileName", () => {
    expect(source).toContain("hcpName={profileName}");
  });

  // VMODE-01: vlInstanceId no longer gates the playground -- disabled is
  // driven solely by the `disabled` prop (e.g. new/unsaved profiles).
  it("disables VoiceTestPlayground only via the disabled prop (VMODE-01)", () => {
    expect(source).toContain("disabled={disabled}");
    expect(source).not.toContain("disabled={disabled || !vlInstanceId}");
  });

  it("no longer shows a no-VL-instance disabled hint (VMODE-01)", () => {
    expect(source).not.toContain("!vlInstanceId");
    expect(source).not.toContain("playgroundDisabledNoVl");
  });

  it("has min-h-[360px] for text chat area", () => {
    expect(source).toContain("min-h-[360px]");
  });
});

describe("PlaygroundPreviewPanel: Mode Switching", () => {
  it("accepts voiceModeEnabled prop to switch between modes", () => {
    expect(source).toContain("voiceModeEnabled");
    // The prop is in the interface
    expect(source).toMatch(/voiceModeEnabled:\s*boolean/);
  });

  it("uses if (voiceModeEnabled) for early return to voice mode", () => {
    expect(source).toContain("if (voiceModeEnabled)");
  });

  it("shows MessageSquare icon for text chat mode header", () => {
    // MessageSquare appears in header for text mode indicator
    const messageSquareCount = (source.match(/<MessageSquare/g) ?? []).length;
    expect(messageSquareCount).toBeGreaterThanOrEqual(2); // header + empty state
  });

  it("resets chat state when mode or profile changes", () => {
    expect(source).toContain("setChatMessages([])");
    expect(source).toContain("setChatInput");
    expect(source).toContain("setChatResponseId(null)");
    // useEffect dependency includes voiceModeEnabled
    expect(source).toContain("voiceModeEnabled]");
  });
});

describe("PlaygroundPreviewPanel: Props Interface", () => {
  it("accepts profileName for display", () => {
    expect(source).toMatch(/profileName\??:\s*string/);
  });

  it("accepts agentId for chat capability detection", () => {
    expect(source).toMatch(/agentId\??:\s*string/);
  });

  it("accepts avatarCharacter and avatarStyle for avatar rendering", () => {
    expect(source).toMatch(/avatarCharacter\??:\s*string/);
    expect(source).toMatch(/avatarStyle\??:\s*string/);
  });

  it("accepts disabled prop for new profile state", () => {
    expect(source).toMatch(/disabled\??:\s*boolean/);
  });

  it("accepts systemPrompt for voice playground", () => {
    expect(source).toMatch(/systemPrompt\??:\s*string/);
  });
});
