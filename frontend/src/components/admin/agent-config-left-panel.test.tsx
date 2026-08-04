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
const mockAddKbMutate = vi.fn();
const mockRemoveKbMutate = vi.fn();

vi.mock("@/hooks/use-knowledge-base", () => ({
  useHcpKnowledgeConfigs: () => ({ data: mockKbConfigs }),
  useAddKnowledgeConfig: () => ({
    mutate: mockAddKbMutate,
    isPending: false,
  }),
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

  // ── persona-hcp-foundry-alignment Increment D: voice/avatar config
  // moved out of this panel into the gear-opened <ConfigurationPanel>
  // rendered by VoiceAvatarTab -- this panel no longer owns those fields.
  it("does not render the Voice & Avatar Configuration card (moved to ConfigurationPanel)", () => {
    render(<TestWrapper />);
    expect(
      screen.queryByText("admin:hcp.voiceAvatarConfigTitle"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("voice-live-model-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avatar-character-gallery")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
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
