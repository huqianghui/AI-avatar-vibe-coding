import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

let capturedVoiceProps: Record<string, unknown> | null = null;
vi.mock("@/components/voice/voice-test-playground", () => ({
  VoiceTestPlayground: (props: Record<string, unknown>) => {
    capturedVoiceProps = props;
    return <div data-testid="voice-test-playground">VoiceTestPlayground</div>;
  },
}));

const mockTestChatWithAgent = vi.fn();
vi.mock("@/api/hcp-profiles", () => ({
  testChatWithAgent: (...args: unknown[]) => mockTestChatWithAgent(...args),
}));

// Import after mocks
import { PlaygroundPreviewPanel } from "./playground-preview-panel";

describe("PlaygroundPreviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedVoiceProps = null;
  });

  // ── Voice Mode ───────────────────────────────────────────────
  describe("voice mode", () => {
    it("renders VoiceTestPlayground when voiceModeEnabled is true", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          profileName="Dr. Test"
          agentId="agent-1"
          vlInstanceId="vl-1"
          voiceModeEnabled={true}
          avatarEnabled={true}
          avatarCharacter="lisa"
          avatarStyle="casual"
        />,
      );
      expect(screen.getByTestId("voice-test-playground")).toBeInTheDocument();
    });

    it("passes correct props to VoiceTestPlayground", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          profileName="Dr. Test"
          agentId="agent-1"
          vlInstanceId="vl-1"
          systemPrompt="Be a doctor"
          voiceModeEnabled={true}
          avatarEnabled={true}
          avatarCharacter="lisa"
          avatarStyle="casual"
        />,
      );
      expect(capturedVoiceProps).toBeTruthy();
      expect(capturedVoiceProps!.hcpProfileId).toBe("hcp-1");
      expect(capturedVoiceProps!.vlInstanceId).toBe("vl-1");
      expect(capturedVoiceProps!.systemPrompt).toBe("Be a doctor");
      expect(capturedVoiceProps!.avatarCharacter).toBe("lisa");
      expect(capturedVoiceProps!.avatarStyle).toBe("casual");
      expect(capturedVoiceProps!.avatarEnabled).toBe(true);
      expect(capturedVoiceProps!.hcpName).toBe("Dr. Test");
    });

    it("does not pass avatar data when avatarEnabled is false", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={true}
          avatarEnabled={false}
          avatarCharacter="lisa"
          avatarStyle="casual"
        />,
      );
      expect(capturedVoiceProps!.avatarCharacter).toBeUndefined();
      expect(capturedVoiceProps!.avatarStyle).toBeUndefined();
      expect(capturedVoiceProps!.avatarEnabled).toBe(false);
    });

    it("disables voice playground when disabled prop is true", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={true}
          avatarEnabled={false}
          disabled={true}
        />,
      );
      expect(capturedVoiceProps!.disabled).toBe(true);
    });

    // VMODE-01: vlInstanceId is vestigial/optional -- resolve_voice_config()
    // on the backend always returns a valid config, so the playground is no
    // longer gated on having a bound VL instance.
    it("does not disable voice playground when no vlInstanceId (VMODE-01)", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={true}
          avatarEnabled={false}
          vlInstanceId={undefined}
          disabled={false}
        />,
      );
      expect(capturedVoiceProps!.disabled).toBe(false);
    });

    it("shows disabled message for new profiles", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={true}
          avatarEnabled={false}
          disabled={true}
        />,
      );
      expect(capturedVoiceProps!.disabledMessage).toBe(
        "admin:hcp.playgroundDisabledNew",
      );
    });

    // VMODE-01: no-VL-instance disabled message no longer applies.
    it("shows no disabled message when vlInstanceId is missing and disabled is false (VMODE-01)", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={true}
          avatarEnabled={false}
          vlInstanceId={undefined}
          disabled={false}
        />,
      );
      expect(capturedVoiceProps!.disabledMessage).toBeUndefined();
    });
  });

  // ── Text Chat Mode ──────────────────────────────────────────
  describe("text chat mode", () => {
    it("renders text chat UI when voiceModeEnabled is false", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );
      expect(
        screen.getByText("admin:hcp.playgroundTitle"),
      ).toBeInTheDocument();
    });

    it("shows empty state message when no messages and agent exists", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );
      expect(
        screen.getByText("admin:hcp.playgroundChatReady"),
      ).toBeInTheDocument();
    });

    it("shows no-agent message when agentId is missing", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );
      expect(
        screen.getByText("admin:hcp.playgroundChatNoAgent"),
      ).toBeInTheDocument();
    });

    it("shows profile name when provided", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          profileName="Dr. Smith"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    });

    it("renders chat input and send button", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );
      expect(
        screen.getByPlaceholderText("admin:hcp.playgroundChatPlaceholder"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "admin:hcp.playgroundChatSend" }),
      ).toBeInTheDocument();
    });

    it("disables input when disabled prop is true", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
          disabled={true}
        />,
      );
      const input = screen.getByPlaceholderText(
        "admin:hcp.playgroundDisabledNew",
      );
      expect(input).toBeDisabled();
    });

    it("disables input and send button when no agentId", () => {
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );
      const sendBtn = screen.getByRole("button", {
        name: "admin:hcp.playgroundChatSend",
      });
      expect(sendBtn).toBeDisabled();
    });

    it("sends message and shows response on successful chat", async () => {
      const user = userEvent.setup();
      mockTestChatWithAgent.mockResolvedValue({
        response_text: "Hello, I am Dr. Test",
        response_id: "resp-1",
      });

      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );

      const input = screen.getByPlaceholderText(
        "admin:hcp.playgroundChatPlaceholder",
      );
      await user.type(input, "Hi doctor");
      await user.click(
        screen.getByRole("button", { name: "admin:hcp.playgroundChatSend" }),
      );

      await vi.waitFor(() => {
        expect(screen.getByText("Hi doctor")).toBeInTheDocument();
        expect(
          screen.getByText("Hello, I am Dr. Test"),
        ).toBeInTheDocument();
      });

      expect(mockTestChatWithAgent).toHaveBeenCalledWith("hcp-1", {
        message: "Hi doctor",
        previous_response_id: undefined,
      });
    });

    it("shows error message on failed chat", async () => {
      const user = userEvent.setup();
      mockTestChatWithAgent.mockRejectedValue(new Error("Network error"));

      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );

      const input = screen.getByPlaceholderText(
        "admin:hcp.playgroundChatPlaceholder",
      );
      await user.type(input, "Test message");
      await user.click(
        screen.getByRole("button", { name: "admin:hcp.playgroundChatSend" }),
      );

      await vi.waitFor(() => {
        expect(screen.getByText("[Error] Network error")).toBeInTheDocument();
      });
    });

    it("does not send empty messages", async () => {
      const user = userEvent.setup();
      render(
        <PlaygroundPreviewPanel
          hcpProfileId="hcp-1"
          agentId="agent-1"
          voiceModeEnabled={false}
          avatarEnabled={false}
        />,
      );

      // Send button should be disabled with empty input
      const sendBtn = screen.getByRole("button", {
        name: "admin:hcp.playgroundChatSend",
      });
      expect(sendBtn).toBeDisabled();

      // Type whitespace only
      const input = screen.getByPlaceholderText(
        "admin:hcp.playgroundChatPlaceholder",
      );
      await user.type(input, "   ");

      // Still disabled
      expect(sendBtn).toBeDisabled();
      expect(mockTestChatWithAgent).not.toHaveBeenCalled();
    });
  });
});
