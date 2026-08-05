import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AvatarPersona } from "@/api/avatar-personas";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

const mockGetAgentPortalUrl = vi.fn();
const mockPullVoiceConfig = vi.fn();
vi.mock("@/api/avatar-personas", () => ({
  avatarPersonasApi: {
    getAgentPortalUrl: (...args: unknown[]) => mockGetAgentPortalUrl(...args),
    pullVoiceConfig: (...args: unknown[]) => mockPullVoiceConfig(...args),
  },
}));

// Import after mocks
import { PersonaAgentStatusSection } from "./persona-agent-status-section";

function makePersona(overrides: Partial<AvatarPersona> = {}): AvatarPersona {
  return {
    id: "persona-1",
    name: "Lisa",
    character: "lisa",
    style: "casual-sitting",
    voice_map: {},
    greeting_map: {},
    prompt_fragment: "",
    enabled: true,
    is_default: false,
    agent_id: "agent-abc",
    agent_version: "1",
    agent_sync_status: "synced",
    agent_sync_error: "",
    proactive_engagement: false,
    interim_response_enabled: false,
    interim_response_type: "llm",
    interim_response_threshold_ms: 500,
    speech_recognition_model: "azure-speech",
    auto_detect_language: false,
    eou_detection: false,
    noise_suppression: false,
    echo_cancellation: false,
    phrase_list: "",
    voice_temperature: 0.9,
    playback_speed: 1.0,
    custom_lexicon_url: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("PersonaAgentStatusSection", () => {
  const defaultProps = {
    isNew: false,
    onRetrySync: vi.fn(),
    retrySyncPending: false,
  };

  it("renders AI Foundry Agent title", () => {
    render(<PersonaAgentStatusSection persona={makePersona()} {...defaultProps} />);
    expect(screen.getByText("AI Foundry Agent")).toBeInTheDocument();
  });

  it("shows 'Agent Synced' status when synced", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "synced" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("Agent Synced")).toBeInTheDocument();
  });

  it("shows 'Sync Pending' status when pending", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "pending" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("Sync Pending")).toBeInTheDocument();
  });

  it("shows 'Sync Failed' status when failed", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "failed" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("Sync Failed")).toBeInTheDocument();
  });

  it("shows 'No Agent' status when none", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "none", agent_id: "" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("No Agent")).toBeInTheDocument();
  });

  it("shows 'No Agent' when persona is undefined", () => {
    render(<PersonaAgentStatusSection persona={undefined} {...defaultProps} />);
    expect(screen.getByText("No Agent")).toBeInTheDocument();
  });

  it("shows agent ID when persona has one", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_id: "agent-xyz-123" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("agent-xyz-123")).toBeInTheDocument();
    expect(screen.getByText("Agent ID")).toBeInTheDocument();
  });

  it("does not show agent ID when persona has no agent_id", () => {
    render(
      <PersonaAgentStatusSection persona={makePersona({ agent_id: "" })} {...defaultProps} />,
    );
    expect(screen.queryByText("Agent ID")).not.toBeInTheDocument();
  });

  it("shows error message when status is failed with sync error", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "failed", agent_sync_error: "Connection timeout" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("does not show error message when status is not failed", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "synced", agent_sync_error: "old error" })}
        {...defaultProps}
      />,
    );
    expect(screen.queryByText("old error")).not.toBeInTheDocument();
  });

  it("shows retry button when status is failed and not new", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "failed" })}
        isNew={false}
        onRetrySync={vi.fn()}
        retrySyncPending={false}
      />,
    );
    expect(screen.getByText("admin:hcp.retrySync")).toBeInTheDocument();
  });

  it("shows force re-sync button when status is synced", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "synced" })}
        {...defaultProps}
      />,
    );
    expect(screen.queryByText("admin:hcp.retrySync")).not.toBeInTheDocument();
    expect(screen.getByText("Force re-sync")).toBeInTheDocument();
  });

  it("does not show retry button when status is pending", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "pending" })}
        {...defaultProps}
      />,
    );
    expect(screen.queryByText("admin:hcp.retrySync")).not.toBeInTheDocument();
    expect(screen.queryByText("Force re-sync")).not.toBeInTheDocument();
  });

  it("does not show retry button when isNew is true", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "failed" })}
        isNew={true}
        onRetrySync={vi.fn()}
        retrySyncPending={false}
      />,
    );
    expect(screen.queryByText("admin:hcp.retrySync")).not.toBeInTheDocument();
  });

  it("shows 'Syncing...' when retrySyncPending is true", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "failed" })}
        isNew={false}
        onRetrySync={vi.fn()}
        retrySyncPending={true}
      />,
    );
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
  });

  it("calls onRetrySync when retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetrySync = vi.fn();
    render(
      <PersonaAgentStatusSection
        persona={makePersona({ agent_sync_status: "failed" })}
        isNew={false}
        onRetrySync={onRetrySync}
        retrySyncPending={false}
      />,
    );
    await user.click(screen.getByText("admin:hcp.retrySync"));
    expect(onRetrySync).toHaveBeenCalledOnce();
  });

  it("shows 'View in Azure Portal' button when agent_id exists", () => {
    render(
      <PersonaAgentStatusSection persona={makePersona({ agent_id: "agent-123" })} {...defaultProps} />,
    );
    expect(screen.getByText("View in Azure Portal")).toBeInTheDocument();
  });

  it("does not show 'View in Azure Portal' when agent_id is empty", () => {
    render(<PersonaAgentStatusSection persona={makePersona({ agent_id: "" })} {...defaultProps} />);
    expect(screen.queryByText("View in Azure Portal")).not.toBeInTheDocument();
  });

  it("shows info message for new personas", () => {
    render(
      <PersonaAgentStatusSection
        persona={undefined}
        isNew={true}
        onRetrySync={vi.fn()}
        retrySyncPending={false}
      />,
    );
    expect(
      screen.getByText(/AI Foundry Agent will be automatically created/),
    ).toBeInTheDocument();
  });

  it("shows metadata (Created / Last Updated) for existing personas", () => {
    render(
      <PersonaAgentStatusSection
        persona={makePersona()}
        isNew={false}
        onRetrySync={vi.fn()}
        retrySyncPending={false}
      />,
    );
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Last Updated")).toBeInTheDocument();
  });

  it("does not show metadata when isNew is true", () => {
    render(
      <PersonaAgentStatusSection
        persona={undefined}
        isNew={true}
        onRetrySync={vi.fn()}
        retrySyncPending={false}
      />,
    );
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
    expect(screen.queryByText("Last Updated")).not.toBeInTheDocument();
  });

  // Pull-from-agent button (persona-hcp-foundry-alignment Increment H)
  describe("Pull from Agent button", () => {
    it("shows pull button when synced, not new, and onPullConfig is provided", () => {
      render(
        <PersonaAgentStatusSection
          persona={makePersona({ agent_sync_status: "synced" })}
          isNew={false}
          onRetrySync={vi.fn()}
          retrySyncPending={false}
          onPullConfig={vi.fn()}
          pullConfigPending={false}
        />,
      );
      expect(screen.getByText("admin:hcp.pullVoiceConfig")).toBeInTheDocument();
    });

    it("does not show pull button when onPullConfig is not provided", () => {
      render(
        <PersonaAgentStatusSection
          persona={makePersona({ agent_sync_status: "synced" })}
          {...defaultProps}
        />,
      );
      expect(screen.queryByText("admin:hcp.pullVoiceConfig")).not.toBeInTheDocument();
    });

    it("does not show pull button when status is not synced", () => {
      render(
        <PersonaAgentStatusSection
          persona={makePersona({ agent_sync_status: "failed" })}
          isNew={false}
          onRetrySync={vi.fn()}
          retrySyncPending={false}
          onPullConfig={vi.fn()}
          pullConfigPending={false}
        />,
      );
      expect(screen.queryByText("admin:hcp.pullVoiceConfig")).not.toBeInTheDocument();
    });

    it("does not show pull button when isNew is true", () => {
      render(
        <PersonaAgentStatusSection
          persona={makePersona({ agent_sync_status: "synced" })}
          isNew={true}
          onRetrySync={vi.fn()}
          retrySyncPending={false}
          onPullConfig={vi.fn()}
          pullConfigPending={false}
        />,
      );
      expect(screen.queryByText("admin:hcp.pullVoiceConfig")).not.toBeInTheDocument();
    });

    it("shows pending label when pullConfigPending is true", () => {
      render(
        <PersonaAgentStatusSection
          persona={makePersona({ agent_sync_status: "synced" })}
          isNew={false}
          onRetrySync={vi.fn()}
          retrySyncPending={false}
          onPullConfig={vi.fn()}
          pullConfigPending={true}
        />,
      );
      expect(screen.getByText("admin:hcp.pullVoiceConfigPending")).toBeInTheDocument();
      expect(screen.queryByText("admin:hcp.pullVoiceConfig")).not.toBeInTheDocument();
    });

    it("calls onPullConfig when pull button is clicked", async () => {
      const user = userEvent.setup();
      const onPullConfig = vi.fn();
      render(
        <PersonaAgentStatusSection
          persona={makePersona({ agent_sync_status: "synced" })}
          isNew={false}
          onRetrySync={vi.fn()}
          retrySyncPending={false}
          onPullConfig={onPullConfig}
          pullConfigPending={false}
        />,
      );
      await user.click(screen.getByText("admin:hcp.pullVoiceConfig"));
      expect(onPullConfig).toHaveBeenCalledOnce();
    });
  });
});
