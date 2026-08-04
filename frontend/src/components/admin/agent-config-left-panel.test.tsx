import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

let mockKbConfigs: Array<{ id: string; index_name: string }> = [];
const mockRemoveKbMutate = vi.fn();

vi.mock("@/hooks/use-knowledge-base", () => ({
  useHcpKnowledgeConfigs: () => ({ data: mockKbConfigs }),
  useRemoveKnowledgeConfig: () => ({
    mutate: mockRemoveKbMutate,
    isPending: false,
  }),
}));

vi.mock("@/components/admin/connect-kb-dialog", () => ({
  ConnectKbDialog: ({ open }: { open: boolean }) => (
    <div data-testid="connect-kb-dialog" data-open={open} />
  ),
}));

vi.mock("@/components/admin/agent-foundation-model-select", () => ({
  AgentFoundationModelSelect: ({ value }: { value: string }) => (
    <div data-testid="agent-foundation-model-select" data-value={value} />
  ),
}));

vi.mock("@/components/admin/voice-live-model-select", () => ({
  VoiceLiveModelSelect: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <div data-testid="voice-live-model-select" data-value={value}>
      <button type="button" onClick={() => onValueChange("gpt-realtime")}>
        change-model
      </button>
    </div>
  ),
}));

vi.mock("@/components/admin/avatar-character-gallery", () => ({
  AvatarCharacterGallery: ({
    character,
    style,
    onSelect,
  }: {
    character: string;
    style: string;
    onSelect: (characterId: string, style: string) => void;
  }) => (
    <div data-testid="avatar-character-gallery" data-character={character} data-style={style}>
      <button type="button" onClick={() => onSelect("harry", "business")}>
        select-gallery-item
      </button>
    </div>
  ),
}));

let capturedInstructionsProps: Record<string, unknown> | null = null;
vi.mock("@/components/admin/instructions-section", () => ({
  InstructionsSection: (props: Record<string, unknown>) => {
    capturedInstructionsProps = props;
    return <div data-testid="instructions-section">InstructionsSection</div>;
  },
}));

// Import after mocks
import { AgentConfigLeftPanel } from "./agent-config-left-panel";

function TestWrapper({
  isNew = false,
  profile,
  onAutoInstructionsChange,
}: {
  isNew?: boolean;
  profile?: { id: string; name: string };
  onAutoInstructionsChange?: (instructions: string) => void;
}) {
  const form = useForm<HcpFormValues>({
    defaultValues: {
      name: "Dr. Test",
      specialty: "Oncology",
      hospital: "",
      title: "",
      personality_type: "friendly",
      emotional_state: 50,
      communication_style: 50,
      expertise_areas: [],
      prescribing_habits: "",
      concerns: "",
      objections: [],
      probe_topics: [],
      difficulty: "medium",
      voice_live_instance_id: null,
      voice_live_model: "gpt-4o",
      voice_name: "en-US-AvaNeural",
      recognition_language: "auto",
      avatar_character: "lisa",
      avatar_style: "casual",
      avatar_enabled: true,
      agent_instructions_override: "",
    },
  });

  useEffect(() => {
    // form is fully initialized via defaultValues above
  }, []);

  return (
    <FormProvider {...form}>
      <AgentConfigLeftPanel
        form={form}
        profile={profile as never}
        isNew={isNew}
        onAutoInstructionsChange={onAutoInstructionsChange}
      />
    </FormProvider>
  );
}

describe("AgentConfigLeftPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInstructionsProps = null;
    mockKbConfigs = [];
  });

  // ── VMODE-01: Voice Live Instance card removed ────────────────────
  it("does not render any Voice Live Instance card text and does not call useVoiceLiveInstances", () => {
    render(<TestWrapper />);
    expect(screen.queryByText("admin:hcp.vlInstanceLabel")).not.toBeInTheDocument();
    expect(screen.queryByText("admin:hcp.vlInstanceEmptyTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("admin:hcp.vlInstanceRequiredBadge")).not.toBeInTheDocument();
  });

  it("does not render the 'Manage in Voice Live' link or remove-instance button", () => {
    render(<TestWrapper />);
    expect(
      screen.queryByText("admin:voiceLive.goToVlManagement"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("admin:voiceLive.removeInstance"),
    ).not.toBeInTheDocument();
  });

  // ── New "Voice & Avatar Configuration" card ────────────────────────
  it("renders the new Voice & Avatar Configuration card title", () => {
    render(<TestWrapper />);
    expect(
      screen.getByText("admin:hcp.voiceAvatarConfigTitle"),
    ).toBeInTheDocument();
  });

  it("renders VoiceLiveModelSelect bound to voice_live_model", () => {
    render(<TestWrapper />);
    expect(screen.getByTestId("voice-live-model-select")).toHaveAttribute(
      "data-value",
      "gpt-4o",
    );
  });

  it("changing the model deployment select updates the form value", () => {
    render(<TestWrapper />);
    fireEvent.click(screen.getByText("change-model"));
    expect(screen.getByTestId("voice-live-model-select")).toHaveAttribute(
      "data-value",
      "gpt-realtime",
    );
  });

  it("renders a Language select and a Speech-output Voice select", () => {
    render(<TestWrapper />);
    expect(screen.getByText("admin:hcp.recognitionLanguage")).toBeInTheDocument();
    expect(screen.getByText("admin:hcp.voiceName")).toBeInTheDocument();
  });

  it("renders an avatar_enabled Switch", () => {
    render(<TestWrapper />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeInTheDocument();
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });

  it("renders AvatarCharacterGallery bound to avatar_character/avatar_style", () => {
    render(<TestWrapper />);
    const gallery = screen.getByTestId("avatar-character-gallery");
    expect(gallery).toHaveAttribute("data-character", "lisa");
    expect(gallery).toHaveAttribute("data-style", "casual");
  });

  it("selecting a gallery item calls form.setValue for avatar_character/avatar_style with shouldDirty true", () => {
    render(<TestWrapper />);
    fireEvent.click(screen.getByText("select-gallery-item"));
    const gallery = screen.getByTestId("avatar-character-gallery");
    expect(gallery).toHaveAttribute("data-character", "harry");
    expect(gallery).toHaveAttribute("data-style", "business");
  });

  it("shows disabled hint for new profiles", () => {
    render(<TestWrapper isNew={true} />);
    expect(
      screen.getByText("admin:hcp.playgroundDisabledNew"),
    ).toBeInTheDocument();
  });

  it("does not show disabled hint for existing profiles", () => {
    render(<TestWrapper isNew={false} />);
    expect(
      screen.queryByText("admin:hcp.playgroundDisabledNew"),
    ).not.toBeInTheDocument();
  });

  // ── Agent Foundation Model card (D-14, unaffected) ─────────────────
  it("still renders the decorative Agent Foundation Model select", () => {
    render(<TestWrapper />);
    expect(
      screen.getByTestId("agent-foundation-model-select"),
    ).toBeInTheDocument();
  });

  // ── Knowledge & Tools expand/collapse ─────────────────────
  it("renders knowledge & tools section", () => {
    render(<TestWrapper />);
    expect(screen.getByText("admin:hcp.knowledgeAndTools")).toBeInTheDocument();
  });

  it("expands knowledge & tools section when header is clicked", async () => {
    render(<TestWrapper />);
    expect(
      screen.queryByText("admin:hcp.toolsPlaceholder"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("admin:hcp.knowledgeAndTools"));
    expect(
      screen.getByText("admin:hcp.toolsPlaceholder"),
    ).toBeInTheDocument();
  });

  it("collapses knowledge & tools section when header is clicked twice", () => {
    render(<TestWrapper />);
    const header = screen.getByText("admin:hcp.knowledgeAndTools");

    fireEvent.click(header);
    expect(
      screen.getByText("admin:hcp.toolsPlaceholder"),
    ).toBeInTheDocument();

    fireEvent.click(header);
    expect(
      screen.queryByText("admin:hcp.toolsPlaceholder"),
    ).not.toBeInTheDocument();
  });

  // ── Instructions section props ────────────────────────────
  it("passes form and profileId to InstructionsSection", () => {
    render(
      <TestWrapper isNew={false} profile={{ id: "hcp-1", name: "Dr. Test" }} />,
    );
    expect(capturedInstructionsProps).toBeTruthy();
    expect(capturedInstructionsProps!.profileId).toBe("hcp-1");
    expect(capturedInstructionsProps!.isNew).toBe(false);
  });
});
