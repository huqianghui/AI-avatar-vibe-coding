import type { ReactNode } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---- Mocks ----

import { vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Mock the two child panels the component delegates to
let capturedLeftPanelProps: Record<string, unknown> | null = null;
let capturedPlaygroundProps: Record<string, unknown> | null = null;
let capturedConfigPanelProps: Record<string, unknown> | null = null;

vi.mock("@/components/admin/agent-config-left-panel", () => ({
  AgentConfigLeftPanel: (props: Record<string, unknown>) => {
    capturedLeftPanelProps = props;
    return <div data-testid="agent-config-left-panel">AgentConfigLeftPanel</div>;
  },
}));

vi.mock("@/components/admin/playground-preview-panel", () => ({
  PlaygroundPreviewPanel: (props: Record<string, unknown>) => {
    capturedPlaygroundProps = props;
    return (
      <div data-testid="playground-preview-panel">
        PlaygroundPreviewPanel
        {(props.toolbarExtra as ReactNode) ?? null}
      </div>
    );
  },
}));

// Mock ConfigurationPanel -- gear-button-opened Foundry-style panel
// (persona-hcp-foundry-alignment Increment D). Renders a marker only when
// `open` so tests can assert on the gear button's open/close wiring.
vi.mock("@/components/admin/configuration-panel", () => ({
  ConfigurationPanel: (props: Record<string, unknown>) => {
    capturedConfigPanelProps = props;
    if (!props.open) return null;
    return <div data-testid="configuration-panel">ConfigurationPanel</div>;
  },
}));

// Import after mocks
import { VoiceAvatarTab } from "./voice-avatar-tab";
import { useForm, FormProvider } from "react-hook-form";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

/** Wrapper providing react-hook-form context */
function TestWrapper({
  instanceId = null,
  isNew = false,
  profile,
  avatarCharacter = "lisa",
  avatarStyle = "casual",
  avatarEnabled = true,
}: {
  instanceId?: string | null;
  isNew?: boolean;
  profile?: { id: string; name: string; agent_id?: string };
  avatarCharacter?: string;
  avatarStyle?: string;
  avatarEnabled?: boolean;
}) {
  const form = useForm<HcpFormValues>({
    defaultValues: {
      name: "Test HCP",
      specialty: "Oncology",
      hospital: "",
      title: "",
      personality_type: "friendly",
      emotional_state: 30,
      communication_style: 50,
      expertise_areas: [],
      prescribing_habits: "",
      concerns: "",
      objections: [],
      probe_topics: [],
      difficulty: "medium",
      voice_live_instance_id: instanceId,
      voice_live_model: "gpt-4o",
      voice_name: "en-US-AvaNeural",
      recognition_language: "auto",
      avatar_character: avatarCharacter,
      avatar_style: avatarStyle,
      avatar_enabled: avatarEnabled,
      agent_instructions_override: "",
    },
  });

  return (
    <FormProvider {...form}>
      <VoiceAvatarTab
        form={form}
        isNew={isNew}
        profile={profile as never}
      />
    </FormProvider>
  );
}

describe("VoiceAvatarTab (two-panel layout)", () => {
  beforeEach(() => {
    capturedLeftPanelProps = null;
    capturedPlaygroundProps = null;
    capturedConfigPanelProps = null;
  });

  it("renders both panels", () => {
    render(<TestWrapper instanceId="inst-001" />);
    expect(screen.getByTestId("agent-config-left-panel")).toBeInTheDocument();
    expect(screen.getByTestId("playground-preview-panel")).toBeInTheDocument();
  });

  it("passes form, isNew, and onAutoInstructionsChange to AgentConfigLeftPanel", () => {
    render(<TestWrapper instanceId="inst-001" isNew={false} />);
    expect(capturedLeftPanelProps).toBeTruthy();
    expect(capturedLeftPanelProps!.isNew).toBe(false);
    expect(typeof capturedLeftPanelProps!.onAutoInstructionsChange).toBe("function");
  });

  // VMODE-01: avatar data now comes directly from the form's inline fields,
  // not a matched VoiceLiveInstance -- no VL instance binding required.
  it("passes avatar data from the form's inline avatar fields to PlaygroundPreviewPanel", () => {
    render(
      <TestWrapper
        instanceId={null}
        avatarCharacter="lisa"
        avatarStyle="casual"
        avatarEnabled={true}
      />,
    );
    expect(capturedPlaygroundProps).toBeTruthy();
    expect(capturedPlaygroundProps!.avatarCharacter).toBe("lisa");
    expect(capturedPlaygroundProps!.avatarStyle).toBe("casual");
    expect(capturedPlaygroundProps!.avatarEnabled).toBe(true);
  });

  it("reflects avatar_enabled=false from the form", () => {
    render(<TestWrapper instanceId={null} avatarEnabled={false} />);
    expect(capturedPlaygroundProps).toBeTruthy();
    expect(capturedPlaygroundProps!.avatarEnabled).toBe(false);
  });

  it("sets disabled=true on PlaygroundPreviewPanel when isNew is true", () => {
    render(<TestWrapper instanceId={null} isNew={true} />);
    expect(capturedPlaygroundProps).toBeTruthy();
    expect(capturedPlaygroundProps!.disabled).toBe(true);
  });

  it("sets disabled=false on PlaygroundPreviewPanel when isNew is false", () => {
    render(<TestWrapper instanceId={null} isNew={false} />);
    expect(capturedPlaygroundProps).toBeTruthy();
    expect(capturedPlaygroundProps!.disabled).toBe(false);
  });

  it("passes profile data to PlaygroundPreviewPanel", () => {
    const profile = { id: "hcp-1", name: "Dr. Test", agent_id: "agent-1" };
    render(
      <TestWrapper instanceId={null} isNew={false} profile={profile} />,
    );
    expect(capturedPlaygroundProps).toBeTruthy();
    expect(capturedPlaygroundProps!.hcpProfileId).toBe("hcp-1");
    expect(capturedPlaygroundProps!.profileName).toBe("Dr. Test");
    expect(capturedPlaygroundProps!.agentId).toBe("agent-1");
  });

  // VMODE-01: voice mode is always enabled -- resolve_voice_config() on the
  // backend always returns a valid config regardless of VL instance linkage.
  it("always derives voiceModeEnabled=true for PlaygroundPreviewPanel, with or without a bound VL instance", () => {
    render(<TestWrapper instanceId="inst-001" />);
    expect(capturedPlaygroundProps!.voiceModeEnabled).toBe(true);

    capturedPlaygroundProps = null;
    render(<TestWrapper instanceId={null} />);
    expect(capturedPlaygroundProps!.voiceModeEnabled).toBe(true);
  });

  // ── persona-hcp-foundry-alignment Increment D: gear Configure button ──
  describe("gear Configure button -> ConfigurationPanel", () => {
    it("passes a gear Configure button as PlaygroundPreviewPanel's toolbarExtra", () => {
      render(<TestWrapper instanceId={null} />);
      expect(
        screen.getByRole("button", { name: "admin:hcp.configureButton" }),
      ).toBeInTheDocument();
    });

    it("renders ConfigurationPanel closed by default", () => {
      render(<TestWrapper instanceId={null} />);
      expect(capturedConfigPanelProps).toBeTruthy();
      expect(capturedConfigPanelProps!.open).toBe(false);
      expect(screen.queryByTestId("configuration-panel")).not.toBeInTheDocument();
    });

    it("opens ConfigurationPanel when the gear button is clicked", () => {
      render(<TestWrapper instanceId={null} />);
      fireEvent.click(
        screen.getByRole("button", { name: "admin:hcp.configureButton" }),
      );
      expect(screen.getByTestId("configuration-panel")).toBeInTheDocument();
    });

    it("passes the form's voice/language/model/avatar fields to ConfigurationPanel", () => {
      render(
        <TestWrapper
          instanceId={null}
          avatarCharacter="lisa"
          avatarStyle="casual"
          avatarEnabled={true}
        />,
      );
      expect(capturedConfigPanelProps).toBeTruthy();
      expect(capturedConfigPanelProps!.recognitionModel).toBe("gpt-4o");
      expect(capturedConfigPanelProps!.language).toBe("auto");
      expect(capturedConfigPanelProps!.voice).toBe("en-US-AvaNeural");
      expect(capturedConfigPanelProps!.avatarEnabled).toBe(true);
      expect(capturedConfigPanelProps!.avatarCharacter).toBe("lisa");
      expect(capturedConfigPanelProps!.avatarStyle).toBe("casual");
      expect(capturedConfigPanelProps!.showAutoDetectOption).toBe(true);
      expect(typeof capturedConfigPanelProps!.onRecognitionModelChange).toBe(
        "function",
      );
      expect(typeof capturedConfigPanelProps!.onLanguageChange).toBe("function");
      expect(typeof capturedConfigPanelProps!.onVoiceChange).toBe("function");
      expect(typeof capturedConfigPanelProps!.onAvatarEnabledChange).toBe(
        "function",
      );
      expect(typeof capturedConfigPanelProps!.onAvatarSelect).toBe("function");
    });

    it("shows a disabledNote for new profiles and none for existing ones", () => {
      render(<TestWrapper instanceId={null} isNew={true} />);
      expect(capturedConfigPanelProps!.disabledNote).toBe(
        "admin:hcp.playgroundDisabledNew",
      );

      capturedConfigPanelProps = null;
      render(<TestWrapper instanceId={null} isNew={false} />);
      expect(capturedConfigPanelProps!.disabledNote).toBeUndefined();
    });
  });
});
