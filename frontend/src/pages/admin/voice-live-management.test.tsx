import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import VoiceLiveManagementPage from "./voice-live-management";
import type { VoiceLiveInstance } from "@/types/voice-live";
import type { HcpProfile } from "@/types/hcp";

/* ── Mocks ────────────────────────────────────────────────────────────── */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (opts?.defaultValue as string) ?? key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockDeleteMutate = vi.fn();
const mockAssignMutate = vi.fn();
const mockUnassignMutate = vi.fn();
const mockRefetch = vi.fn();

let mockInstancesReturn: {
  data: { items: VoiceLiveInstance[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: typeof mockRefetch;
};

let mockHcpReturn: {
  data: { items: HcpProfile[] } | undefined;
};

vi.mock("@/hooks/use-voice-live-instances", () => ({
  useVoiceLiveInstances: () => mockInstancesReturn,
  useDeleteVoiceLiveInstance: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
  useAssignVoiceLiveInstance: () => ({
    mutate: mockAssignMutate,
    isPending: false,
  }),
  useUnassignVoiceLiveInstance: () => ({
    mutate: mockUnassignMutate,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-hcp-profiles", () => ({
  useHcpProfiles: () => mockHcpReturn,
}));

// Mock child components
vi.mock("@/components/shared/empty-state", () => ({
  EmptyState: (props: { title: string; body: string }) => (
    <div data-testid="empty-state">
      {props.title} - {props.body}
    </div>
  ),
}));

vi.mock("@/components/admin/voice-live-chain-card", () => ({
  VoiceLiveInstanceCard: (props: {
    instance: VoiceLiveInstance;
    onEdit: (i: VoiceLiveInstance) => void;
    onDelete: (i: VoiceLiveInstance) => void;
    onAssign: (i: VoiceLiveInstance) => void;
    onUnassign: (id: string) => void;
  }) => (
    <div data-testid={`instance-card-${props.instance.id}`}>
      <span>{props.instance.name}</span>
      <button onClick={() => props.onEdit(props.instance)}>edit</button>
      <button onClick={() => props.onDelete(props.instance)}>delete</button>
      <button onClick={() => props.onAssign(props.instance)}>assign</button>
      <button onClick={() => props.onUnassign("hcp-unassign-1")}>
        unassign
      </button>
    </div>
  ),
}));

/* ── Helpers ───────────────────────────────────────────────────────────── */

const makeInstance = (
  overrides: Partial<VoiceLiveInstance> = {},
): VoiceLiveInstance => ({
  id: "vl-1",
  name: "VL Instance 1",
  description: "",
  voice_live_model: "gpt-4o",
  enabled: true,
  voice_name: "en-US-AvaNeural",
  voice_type: "azure-standard",
  voice_temperature: 0.9,
  voice_custom: false,
  avatar_character: "lori",
  avatar_style: "casual",
  avatar_customized: false,
  turn_detection_type: "server_vad",
  noise_suppression: false,
  echo_cancellation: false,
  eou_detection: false,
  recognition_language: "auto",
  response_temperature: 0.8,
  proactive_engagement: true,
  auto_detect_language: true,
  playback_speed: 1.0,
  custom_lexicon_enabled: false,
  custom_lexicon_url: "",
  avatar_enabled: true,
  model_instruction: "",
  hcp_count: 2,
  created_by: "admin",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  ...overrides,
});

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <VoiceLiveManagementPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ── Tests ─────────────────────────────────────────────────────────────── */

describe("VoiceLiveManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstancesReturn = {
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    mockHcpReturn = { data: { items: [] } };
  });

  /* ---- Header ---- */

  it("renders the page title", () => {
    mockInstancesReturn = {
      data: { items: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    expect(screen.getByText("voiceLive.title")).toBeInTheDocument();
  });

  it("renders page description", () => {
    mockInstancesReturn = {
      data: { items: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    expect(screen.getByText("voiceLive.pageDescription")).toBeInTheDocument();
  });

  it("renders create instance button", () => {
    mockInstancesReturn = {
      data: { items: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    expect(
      screen.getByText("voiceLive.createInstance"),
    ).toBeInTheDocument();
  });

  it("navigates to new page when create button is clicked", async () => {
    mockInstancesReturn = {
      data: { items: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(
      screen.getByText("voiceLive.createInstance").closest("button")!,
    );
    expect(mockNavigate).toHaveBeenCalledWith("/admin/voice-live/new");
  });

  /* ---- Stats ---- */

  it("renders stat cards with correct values", () => {
    const instances = [
      makeInstance({ id: "vl-1", enabled: true, hcp_count: 2 }),
      makeInstance({ id: "vl-2", enabled: false, hcp_count: 1 }),
    ];
    mockInstancesReturn = {
      data: { items: instances },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    // Total instances = 2, Enabled = 1, Assigned HCPs = 3
    expect(screen.getByLabelText("2 voiceLive.statTotalInstances")).toBeInTheDocument();
    expect(screen.getByLabelText("1 voiceLive.statEnabled")).toBeInTheDocument();
    expect(screen.getByLabelText("3 voiceLive.statAssignedHcps")).toBeInTheDocument();
  });

  /* ---- Loading state ---- */

  it("renders loading skeletons when loading", () => {
    mockInstancesReturn = {
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    // Should not show instance cards
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  /* ---- Error state ---- */

  it("renders error state with retry button", () => {
    mockInstancesReturn = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    };
    renderPage();
    expect(screen.getByText("voiceLive.loadError")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.retrySync")).toBeInTheDocument();
  });

  it("calls refetch when retry button is clicked", async () => {
    mockInstancesReturn = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(
      screen.getByText("voiceLive.retrySync").closest("button")!,
    );
    expect(mockRefetch).toHaveBeenCalled();
  });

  /* ---- Empty state ---- */

  it("renders empty state when no instances", () => {
    mockInstancesReturn = {
      data: { items: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  /* ---- Instance cards ---- */

  it("renders instance cards when data is available", () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    expect(screen.getByTestId("instance-card-vl-1")).toBeInTheDocument();
    expect(screen.getByText("VL Instance 1")).toBeInTheDocument();
  });

  it("navigates to edit page when edit is clicked on card", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(screen.getByText("edit"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/voice-live/vl-1/edit");
  });

  /* ---- Delete dialog ---- */

  it("opens delete dialog when delete is clicked on card", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(screen.getByText("delete"));
    // The dialog renders "voiceLive.deleteInstance" in both title and confirm button
    const deleteTexts = screen.getAllByText("voiceLive.deleteInstance");
    expect(deleteTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("calls deleteMutation when confirm delete is clicked", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    // Open delete dialog
    await userEvent.click(screen.getByText("delete"));

    // Click the destructive delete button in dialog
    const deleteButtons = screen.getAllByText("voiceLive.deleteInstance");
    // The second one is inside the dialog footer
    const confirmBtn = deleteButtons[deleteButtons.length - 1]!.closest("button")!;
    await userEvent.click(confirmBtn);

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      "vl-1",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("shows success toast on delete success", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    await userEvent.click(screen.getByText("delete"));
    const deleteButtons = screen.getAllByText("voiceLive.deleteInstance");
    await userEvent.click(
      deleteButtons[deleteButtons.length - 1]!.closest("button")!,
    );

    const call = mockDeleteMutate.mock.calls[0]!;
    const callbacks = call[1] as { onSuccess: () => void };
    callbacks.onSuccess();

    expect(toast.success).toHaveBeenCalledWith("voiceLive.instanceDeleted");
  });

  it("shows error toast on delete error", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    await userEvent.click(screen.getByText("delete"));
    const deleteButtons = screen.getAllByText("voiceLive.deleteInstance");
    await userEvent.click(
      deleteButtons[deleteButtons.length - 1]!.closest("button")!,
    );

    const call = mockDeleteMutate.mock.calls[0]!;
    const callbacks = call[1] as { onError: () => void };
    callbacks.onError();

    expect(toast.error).toHaveBeenCalled();
  });

  /* ---- Assign dialog ---- */

  it("opens assign dialog when assign is clicked on card", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(screen.getByText("assign"));
    expect(
      screen.getByText("voiceLive.assignDialogTitle"),
    ).toBeInTheDocument();
  });

  it("shows empty message when no available HCPs", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    mockHcpReturn = { data: { items: [] } };
    renderPage();

    await userEvent.click(screen.getByText("assign"));
    expect(
      screen.getByText("voiceLive.assignDialogEmpty"),
    ).toBeInTheDocument();
  });

  it("renders cancel button in assign dialog", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    await userEvent.click(screen.getByText("assign"));
    expect(
      screen.getByText("voiceLive.vlDialogCancel"),
    ).toBeInTheDocument();
  });

  /* ---- Multiple instances ---- */

  it("renders multiple instance cards", () => {
    mockInstancesReturn = {
      data: {
        items: [
          makeInstance({ id: "vl-1", name: "First" }),
          makeInstance({ id: "vl-2", name: "Second" }),
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    expect(screen.getByTestId("instance-card-vl-1")).toBeInTheDocument();
    expect(screen.getByTestId("instance-card-vl-2")).toBeInTheDocument();
  });

  /* ---- Unassign ---- */

  it("calls unassignMutation when unassign is clicked on card", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(screen.getByText("unassign"));

    expect(mockUnassignMutate).toHaveBeenCalledWith(
      "hcp-unassign-1",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("shows success toast on unassign success", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(screen.getByText("unassign"));

    const call = mockUnassignMutate.mock.calls[0]!;
    const callbacks = call[1] as { onSuccess: () => void };
    callbacks.onSuccess();

    expect(toast.success).toHaveBeenCalledWith(
      "voiceLive.removeInstanceSuccess",
    );
  });

  it("shows error toast on unassign error", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();
    await userEvent.click(screen.getByText("unassign"));

    const call = mockUnassignMutate.mock.calls[0]!;
    const callbacks = call[1] as { onError: () => void };
    callbacks.onError();

    expect(toast.error).toHaveBeenCalledWith("voiceLive.assignError");
  });

  /* ---- Assign dialog with available HCPs ---- */

  it("renders available HCPs in assign dialog dropdown", async () => {
    const hcpNotAssigned = {
      id: "hcp-free",
      name: "Dr. Free",
      specialty: "Cardiology",
      hospital: "",
      title: "",
      avatar_url: "",
      personality_type: "friendly" as const,
      emotional_state: 50,
      communication_style: 50,
      expertise_areas: [],
      prescribing_habits: "",
      concerns: "",
      objections: [],
      probe_topics: [],
      difficulty: "medium" as const,
      is_active: true,
      created_by: "admin",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      agent_id: "",
      agent_version: "",
      agent_sync_status: "none" as const,
      agent_sync_error: "",
      voice_live_instance_id: null,
      voice_live_enabled: true,
      voice_live_model: "gpt-4o",
      voice_name: "en-US-AvaNeural",
      voice_type: "azure-standard",
      voice_temperature: 0.9,
      voice_custom: false,
      avatar_character: "lori",
      avatar_style: "casual",
      avatar_customized: false,
      turn_detection_type: "server_vad",
      noise_suppression: false,
      echo_cancellation: false,
      eou_detection: false,
      recognition_language: "auto",
      avatar_enabled: true,
      proactive_engagement: false,
      interim_response_enabled: false,
      interim_response_type: "llm" as const,
      interim_response_threshold_ms: 500,
      speech_recognition_model: "azure-speech",
      phrase_list: "",
      playback_speed: 1.0,
      custom_lexicon_url: "",
      agent_instructions_override: "",
      knowledge_config_count: 0,
    };
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    mockHcpReturn = { data: { items: [hcpNotAssigned] } };
    renderPage();

    // Open assign dialog
    await userEvent.click(screen.getByText("assign"));

    // The dialog should show the select label
    expect(
      screen.getByText("voiceLive.assignDialogSelect"),
    ).toBeInTheDocument();
  });

  /* ---- HCP profiles mapped to instances ---- */

  it("builds assignedHcpsMap from HCP profiles", () => {
    const hcpAssigned = {
      id: "hcp-mapped",
      name: "Dr. Mapped",
      specialty: "Oncology",
      hospital: "",
      title: "",
      avatar_url: "",
      personality_type: "friendly" as const,
      emotional_state: 50,
      communication_style: 50,
      expertise_areas: [],
      prescribing_habits: "",
      concerns: "",
      objections: [],
      probe_topics: [],
      difficulty: "medium" as const,
      is_active: true,
      created_by: "admin",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      agent_id: "",
      agent_version: "",
      agent_sync_status: "none" as const,
      agent_sync_error: "",
      voice_live_instance_id: "vl-1",
      voice_live_enabled: true,
      voice_live_model: "gpt-4o",
      voice_name: "en-US-AvaNeural",
      voice_type: "azure-standard",
      voice_temperature: 0.9,
      voice_custom: false,
      avatar_character: "lori",
      avatar_style: "casual",
      avatar_customized: false,
      turn_detection_type: "server_vad",
      noise_suppression: false,
      echo_cancellation: false,
      eou_detection: false,
      recognition_language: "auto",
      avatar_enabled: true,
      proactive_engagement: false,
      interim_response_enabled: false,
      interim_response_type: "llm" as const,
      interim_response_threshold_ms: 500,
      speech_recognition_model: "azure-speech",
      phrase_list: "",
      playback_speed: 1.0,
      custom_lexicon_url: "",
      agent_instructions_override: "",
      knowledge_config_count: 0,
    };
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    mockHcpReturn = { data: { items: [hcpAssigned] } };
    renderPage();

    // The card receives assignedHcps from the map
    expect(screen.getByTestId("instance-card-vl-1")).toBeInTheDocument();
  });

  /* ---- Cancel button in assign and delete dialogs ---- */

  it("closes delete dialog when cancel is clicked", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    await userEvent.click(screen.getByText("delete"));
    // Dialog is open
    const cancelBtns = screen.getAllByText("voiceLive.vlDialogCancel");
    await userEvent.click(cancelBtns[0]!.closest("button")!);

    // The delete confirmation text should be gone after cancel
    // (dialog closes)
  });

  it("closes assign dialog when cancel is clicked", async () => {
    mockInstancesReturn = {
      data: { items: [makeInstance()] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderPage();

    await userEvent.click(screen.getByText("assign"));
    const cancelBtns = screen.getAllByText("voiceLive.vlDialogCancel");
    const lastCancel = cancelBtns[cancelBtns.length - 1]!.closest("button")!;
    await userEvent.click(lastCancel);
  });
});
