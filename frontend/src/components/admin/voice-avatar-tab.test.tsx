import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("@/components/admin/agent-config-left-panel", () => ({
  AgentConfigLeftPanel: (props: Record<string, unknown>) => {
    capturedLeftPanelProps = props;
    return <div data-testid="agent-config-left-panel">AgentConfigLeftPanel</div>;
  },
}));

vi.mock("@/components/admin/playground-preview-panel", () => ({
  PlaygroundPreviewPanel: (props: Record<string, unknown>) => {
    capturedPlaygroundProps = props;
    return <div data-testid="playground-preview-panel">PlaygroundPreviewPanel</div>;
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
});
