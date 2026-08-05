import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import fs from "fs";
import path from "path";
import PersonaEditorPage from "./persona-editor";
import type { AvatarPersona } from "@/api/avatar-personas";

// Helper: read JSON locale files via fs -- mirrors hcp-editor-tabs.test.tsx's
// readLocaleJson helper.
function readLocaleJson(locale: string, ns: string): Record<string, unknown> {
  const filePath = path.resolve(__dirname, `../../../public/locales/${locale}/${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

/* ── Mocks ────────────────────────────────────────────────────────────── */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockRetrySyncMutate = vi.fn();

let mockPersonaReturn: {
  data: AvatarPersona | undefined;
  isLoading: boolean;
};
let mockRetrySyncReturn: { isPending: boolean } = { isPending: false };

vi.mock("@/hooks/use-avatar-personas", () => ({
  useAvatarPersona: () => mockPersonaReturn,
  useCreateAvatarPersona: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateAvatarPersona: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
  useRetrySyncAvatarPersona: () => ({
    mutate: mockRetrySyncMutate,
    isPending: mockRetrySyncReturn.isPending,
  }),
}));

// Mock avatar-characters data
vi.mock("@/data/avatar-characters", () => ({
  AVATAR_CHARACTERS: [
    {
      id: "lisa",
      displayName: "Lisa",
      styles: ["casual-sitting", "professional"],
      defaultStyle: "casual-sitting",
      gender: "female",
      isPhotoAvatar: false,
      gradientClasses: "from-blue-400 to-blue-600",
      thumbnailUrl: "https://cdn/lisa.png",
    },
    {
      id: "photo1",
      displayName: "Photo Character",
      styles: [],
      defaultStyle: "",
      gender: "female",
      isPhotoAvatar: true,
      gradientClasses: "from-pink-400 to-pink-600",
      thumbnailUrl: "https://cdn/photo1.png",
    },
  ],
  getAvatarInitials: (name: string) =>
    name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase(),
}));

// Mock useAgentFoundationModels — the Model Deployment card's data source.
// Mirrors the mock shape used in agent-foundation-model-select.test.tsx.
vi.mock("@/hooks/use-agent-foundation-models", () => ({
  useAgentFoundationModels: () => ({
    data: { models: [], stale: false, error: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

// Mock the Knowledge/Foundry IQ hooks (persona-hcp-foundry-alignment
// Increment C) -- keeps this page's own test suite focused on the page's
// own behavior; PersonaKnowledgeSection has its own dedicated test file.
vi.mock("@/hooks/use-knowledge-base", () => ({
  usePersonaKnowledgeConfigs: () => ({ data: [], isLoading: false }),
  useAddPersonaKnowledgeConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useRemovePersonaKnowledgeConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useSearchConnections: () => ({ data: [], isLoading: false }),
  useSearchIndexes: () => ({ data: [], isLoading: false }),
}));

// Mock AvatarView — avoid pulling in WebRTC/audio-orb dependencies for a static preview
vi.mock("@/components/voice/avatar-view", () => ({
  AvatarView: (props: { avatarCharacter?: string; avatarStyle?: string; hcpName: string }) => (
    <div
      data-testid="avatar-view"
      data-avatar-character={props.avatarCharacter ?? ""}
      data-avatar-style={props.avatarStyle ?? ""}
      data-hcp-name={props.hcpName}
    />
  ),
}));

/* ── Helpers ───────────────────────────────────────────────────────────── */

const MOCK_PERSONA: AvatarPersona = {
  id: "p-1",
  name: "Lisa - Casual",
  character: "lisa",
  style: "casual-sitting",
  voice_map: { "en-US": "en-US-AvaNeural" },
  greeting_map: { "en-US": "Hi there, I'm Lisa!" },
  prompt_fragment: "Be casual and friendly.",
  enabled: true,
  is_default: true,
  agent_id: "persona-agent-p-1",
  agent_version: "2",
  agent_sync_status: "synced",
  agent_sync_error: "",
  proactive_engagement: false,
  interim_response_enabled: false,
  interim_response_type: "llm",
  interim_response_threshold_ms: 500,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function renderEditor(path = "/admin/avatar-personas/new") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/avatar-personas/new" element={<PersonaEditorPage />} />
          <Route path="/admin/avatar-personas/:id/edit" element={<PersonaEditorPage />} />
          <Route path="/admin/avatar-personas" element={<div>list-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Opens the gear-triggered Configuration panel (persona-hcp-foundry-
// alignment Increment D) -- Character & Avatar + Speech fields now live
// there, not always-visible in the main column.
async function openConfigPanel() {
  await userEvent.click(
    screen.getByRole("button", { name: "hcp.configureButton" }),
  );
}

/* ── Tests ─────────────────────────────────────────────────────────────── */

describe("PersonaEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersonaReturn = { data: undefined, isLoading: false };
    mockRetrySyncReturn = { isPending: false };
  });

  /* ---- Create mode ---- */

  it("renders create title when no id param", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("personas.createDialogTitle")).toBeInTheDocument();
  });

  it("renders name input", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(
      screen.getByPlaceholderText("personas.namePlaceholder"),
    ).toBeInTheDocument();
  });

  it("renders a gear Configure button that opens the Character & Avatar section", async () => {
    renderEditor("/admin/avatar-personas/new");
    expect(
      screen.queryByText("personas.characterSectionTitle"),
    ).not.toBeInTheDocument();
    await openConfigPanel();
    expect(screen.getByText("admin:voiceLive.playgroundSection.avatar")).toBeInTheDocument();
  });

  it("renders speech section with language, voice, and greeting fields inside the Configuration panel", async () => {
    renderEditor("/admin/avatar-personas/new");
    expect(
      screen.queryByText("admin:personas.greetingLabel"),
    ).not.toBeInTheDocument();

    await openConfigPanel();
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.speechInput"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.speechOutput"),
    ).toBeInTheDocument();
    expect(screen.getByText("admin:personas.greetingLabel")).toBeInTheDocument();
  });

  it("renders instructions section (prompt fragment)", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("personas.promptFragmentLabel")).toBeInTheDocument();
  });

  it("renders save and reset buttons", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("personas.save")).toBeInTheDocument();
    expect(screen.getByText("personas.editor.reset")).toBeInTheDocument();
  });

  it("renders the static avatar preview", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByTestId("avatar-view")).toBeInTheDocument();
    expect(screen.getByText("personas.editor.previewTitle")).toBeInTheDocument();
  });

  it("renders the model deployment card", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("hcp.modelDeployment")).toBeInTheDocument();
    expect(screen.getByText("personas.editor.modelDeploymentNote")).toBeInTheDocument();
  });

  it("renders a disabled Start button with a no-live-test tooltip", () => {
    renderEditor("/admin/avatar-personas/new");
    const startBtn = screen.getByText("hcp.playgroundStart").closest("button")!;
    expect(startBtn).toBeDisabled();
  });

  it("defaults preview to lisa/casual-sitting", () => {
    renderEditor("/admin/avatar-personas/new");
    const avatarView = screen.getByTestId("avatar-view");
    expect(avatarView).toHaveAttribute("data-avatar-character", "lisa");
    expect(avatarView).toHaveAttribute("data-avatar-style", "casual-sitting");
  });

  it("shows the greeting fallback text when no greeting is configured", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("personas.editor.previewGreetingFallback")).toBeInTheDocument();
  });

  it("disables save button when name is empty", () => {
    renderEditor("/admin/avatar-personas/new");
    const saveBtn = screen.getByText("personas.save").closest("button")!;
    expect(saveBtn).toBeDisabled();
  });

  it("does not show configured-languages chips when no locale is configured", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(
      screen.queryByText("personas.editor.configuredLocalesLabel"),
    ).not.toBeInTheDocument();
  });

  /* ---- Avatar grid ---- */

  it("renders avatar grid with filter buttons", async () => {
    renderEditor("/admin/avatar-personas/new");
    await openConfigPanel();
    expect(screen.getByText("voiceLive.vlDialogFilterAll")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogFilterPhoto")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogFilterVideo")).toBeInTheDocument();
  });

  it("renders avatar thumbnails from mock data", async () => {
    renderEditor("/admin/avatar-personas/new");
    await openConfigPanel();
    // lisa has 2 styles + 1 photo avatar = 3 items
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(3);
  });

  it("filters avatars by photo filter", async () => {
    renderEditor("/admin/avatar-personas/new");
    await openConfigPanel();
    await userEvent.click(
      screen.getByText("voiceLive.vlDialogFilterPhoto").closest("button")!,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(1);
  });

  it("filters avatars by video filter", async () => {
    renderEditor("/admin/avatar-personas/new");
    await openConfigPanel();
    await userEvent.click(
      screen.getByText("voiceLive.vlDialogFilterVideo").closest("button")!,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(2);
  });

  it("selecting an avatar updates the preview character/style", async () => {
    renderEditor("/admin/avatar-personas/new");
    await openConfigPanel();
    await userEvent.click(screen.getAllByRole("img")[1]!); // lisa's second style
    const avatarView = screen.getByTestId("avatar-view");
    expect(avatarView).toHaveAttribute("data-avatar-character", "lisa");
    expect(avatarView).toHaveAttribute("data-avatar-style", "professional");
  });

  it("renders the shared AvatarCharacterGallery component", async () => {
    renderEditor("/admin/avatar-personas/new");
    await openConfigPanel();
    // Proves the swap to <AvatarCharacterGallery> (Plan 38-02) rather than a
    // coincidental pass-through: the gallery's own grid container carries
    // this data-testid, which the page's now-deleted inline markup never had.
    expect(screen.getByTestId("avatar-character-grid")).toBeInTheDocument();
  });

  /* ---- Speech card i18n (VMODE-02) ---- */

  it("has a 'Speech output'-phrased en-US title for the Speech card", () => {
    const enAdmin = readLocaleJson("en-US", "admin") as {
      personas: { editor: { speechSectionTitle: string } };
    };
    expect(enAdmin.personas.editor.speechSectionTitle.toLowerCase()).toContain("output");
  });

  /* ---- Save (create) ---- */

  it("does not call createMutation when name is empty and save is clicked", async () => {
    renderEditor("/admin/avatar-personas/new");
    const saveBtn = screen.getByText("personas.save").closest("button")!;
    await userEvent.click(saveBtn);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("calls createMutation when name is filled and save is clicked", async () => {
    renderEditor("/admin/avatar-personas/new");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.type(nameInput, "New Persona");

    const saveBtn = screen.getByText("personas.save").closest("button")!;
    await userEvent.click(saveBtn);

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Persona", character: "lisa", style: "casual-sitting" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  // persona-hcp-foundry-alignment Increment F: interim response + proactive
  // engagement default to disabled/llm/500ms on create and flow through to
  // the save payload untouched.
  it("includes default interim response and proactive engagement fields in the create payload", async () => {
    renderEditor("/admin/avatar-personas/new");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.type(nameInput, "New Persona");
    await userEvent.click(screen.getByText("personas.save").closest("button")!);

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        proactive_engagement: false,
        interim_response_enabled: false,
        interim_response_type: "llm",
        interim_response_threshold_ms: 500,
      }),
      expect.anything(),
    );
  });

  it("toggles proactive engagement via the Configuration panel's Advanced settings and includes it in the save payload", async () => {
    renderEditor("/admin/avatar-personas/new");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.type(nameInput, "New Persona");

    await openConfigPanel();
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.proactiveEngagement")
        .closest("div")!
        .querySelector('[role="switch"]')!,
    );
    await userEvent.keyboard("{Escape}"); // close the Sheet before clicking Save

    await userEvent.click(screen.getByText("personas.save").closest("button")!);

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ proactive_engagement: true }),
      expect.anything(),
    );
  });

  it("shows created toast and navigates to edit url on create success", async () => {
    renderEditor("/admin/avatar-personas/new");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.type(nameInput, "New Persona");
    await userEvent.click(screen.getByText("personas.save").closest("button")!);

    const call = mockCreateMutate.mock.calls[0]!;
    const callbacks = call[1] as { onSuccess: (p: AvatarPersona) => void };
    callbacks.onSuccess(MOCK_PERSONA);

    expect(toast.success).toHaveBeenCalledWith("personas.editor.created");
  });

  it("shows the default-guard conflict toast on 409 error", async () => {
    renderEditor("/admin/avatar-personas/new");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.type(nameInput, "New Persona");
    await userEvent.click(screen.getByText("personas.save").closest("button")!);

    const call = mockCreateMutate.mock.calls[0]!;
    const callbacks = call[1] as { onError: (e: unknown) => void };
    callbacks.onError({ response: { status: 409 } });

    expect(toast.error).toHaveBeenCalledWith(
      "personas.defaultGuardError.title",
      expect.objectContaining({ description: "personas.defaultGuardError.body" }),
    );
  });

  /* ---- Edit mode — loading ---- */

  it("shows loading skeleton in edit mode when loading", () => {
    mockPersonaReturn = { data: undefined, isLoading: true };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.queryByText("personas.editDialogTitle")).not.toBeInTheDocument();
  });

  /* ---- Edit mode — loaded ---- */

  it("renders edit title in edit mode", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.getByText("personas.editDialogTitle")).toBeInTheDocument();
  });

  it("populates name from persona data", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    expect(nameInput).toHaveValue("Lisa - Casual");
  });

  it("shows configured-locale chip for en-US when voice/greeting are set", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    await openConfigPanel();
    expect(screen.getByText("personas.editor.configuredLocalesLabel")).toBeInTheDocument();
  });

  it("shows the configured greeting text in the preview (default active locale en-US)", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    await openConfigPanel();
    // Appears in both the editable greeting textarea and the read-only preview card.
    expect(screen.getAllByText("Hi there, I'm Lisa!").length).toBeGreaterThanOrEqual(2);
  });

  it("calls updateMutation when saving in edit mode", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");

    const saveBtn = screen.getByText("personas.save").closest("button")!;
    await userEvent.click(saveBtn);

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p-1" }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("shows saved toast on update success", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");

    await userEvent.click(screen.getByText("personas.save").closest("button")!);

    const call = mockUpdateMutate.mock.calls[0]!;
    const callbacks = call[1] as { onSuccess: () => void };
    callbacks.onSuccess();

    expect(toast.success).toHaveBeenCalledWith("personas.editor.saved");
  });

  /* ---- Reset ---- */

  it("resets form to persona data in edit mode when reset clicked", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Changed Name");
    expect(nameInput).toHaveValue("Changed Name");

    const resetBtn = screen.getByText("personas.editor.reset").closest("button")!;
    await userEvent.click(resetBtn);

    expect(nameInput).toHaveValue("Lisa - Casual");
  });

  it("resets form to defaults in create mode when reset clicked", async () => {
    renderEditor("/admin/avatar-personas/new");

    const nameInput = screen.getByPlaceholderText("personas.namePlaceholder");
    await userEvent.type(nameInput, "Something");

    const resetBtn = screen.getByText("personas.editor.reset").closest("button")!;
    await userEvent.click(resetBtn);

    expect(nameInput).toHaveValue("");
  });

  /* ---- is_default toggle ---- */

  it("shows disabled tooltip trigger for default toggle when not enabled", async () => {
    renderEditor("/admin/avatar-personas/new");

    const enabledLabel = screen.getByText("personas.toggleEnabled");
    const enabledSwitch = enabledLabel
      .closest("div")!
      .querySelector('[role="switch"]')!;
    await userEvent.click(enabledSwitch);

    const defaultSwitch = screen.getByText("personas.toggleDefault").closest("div")!
      .querySelector('[role="switch"]')!;
    expect(defaultSwitch).toBeDisabled();
  });

  /* ---- AI Foundry Agent sync card (persona-hcp-foundry-alignment
   * Increment B) ---- */

  it("renders the AI Foundry Agent card with 'No Agent' status in create mode", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("AI Foundry Agent")).toBeInTheDocument();
    expect(screen.getByText("No Agent")).toBeInTheDocument();
  });

  it("shows the info message about auto-creating an agent in create mode", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(
      screen.getByText(/AI Foundry Agent will be automatically created/),
    ).toBeInTheDocument();
  });

  it("shows 'Agent Synced' status and Agent ID in edit mode with a synced persona", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.getByText("Agent Synced")).toBeInTheDocument();
    expect(screen.getByText("persona-agent-p-1")).toBeInTheDocument();
  });

  it("shows a Force re-sync button for a synced persona and calls the retry mutation", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");

    const retryBtn = screen.getByText("Force re-sync").closest("button")!;
    await userEvent.click(retryBtn);

    expect(mockRetrySyncMutate).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("shows a success toast when retry-sync succeeds", async () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");

    await userEvent.click(screen.getByText("Force re-sync").closest("button")!);

    const call = mockRetrySyncMutate.mock.calls[0]!;
    const callbacks = call[1] as { onSuccess: () => void };
    callbacks.onSuccess();

    expect(toast.success).toHaveBeenCalledWith("hcp.syncSuccess");
  });

  it("shows a failed toast for a persona with a sync error", () => {
    mockPersonaReturn = {
      data: { ...MOCK_PERSONA, agent_sync_status: "failed", agent_sync_error: "boom" },
      isLoading: false,
    };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.getByText("Sync Failed")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows 'View in Azure Portal' button when the persona has an agent_id", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.getByText("View in Azure Portal")).toBeInTheDocument();
  });

  /* ---- Knowledge / Foundry IQ section (persona-hcp-foundry-alignment
   * Increment C) ---- */

  it("renders the Knowledge/Foundry IQ section in edit mode", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.getByText("hcp.knowledgeTitle")).toBeInTheDocument();
  });

  it("does not render the Knowledge/Foundry IQ section in create mode (no persona id yet)", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.queryByText("hcp.knowledgeTitle")).not.toBeInTheDocument();
  });
});
