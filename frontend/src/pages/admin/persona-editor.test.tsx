import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import PersonaEditorPage from "./persona-editor";
import type { AvatarPersona } from "@/api/avatar-personas";

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

let mockPersonaReturn: {
  data: AvatarPersona | undefined;
  isLoading: boolean;
};

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

/* ── Tests ─────────────────────────────────────────────────────────────── */

describe("PersonaEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersonaReturn = { data: undefined, isLoading: false };
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

  it("renders character section", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("personas.characterSectionTitle")).toBeInTheDocument();
  });

  it("renders speech section with language, voice, and greeting fields", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("personas.editor.speechSectionTitle")).toBeInTheDocument();
    expect(screen.getByText("personas.editor.languageLabel")).toBeInTheDocument();
    expect(screen.getByText("personas.editor.voiceLabel")).toBeInTheDocument();
    expect(screen.getByText("personas.greetingLabel")).toBeInTheDocument();
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

  it("renders avatar grid with filter buttons", () => {
    renderEditor("/admin/avatar-personas/new");
    expect(screen.getByText("voiceLive.vlDialogFilterAll")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogFilterPhoto")).toBeInTheDocument();
    expect(screen.getByText("voiceLive.vlDialogFilterVideo")).toBeInTheDocument();
  });

  it("renders avatar thumbnails from mock data", () => {
    renderEditor("/admin/avatar-personas/new");
    // lisa has 2 styles + 1 photo avatar = 3 items
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(3);
  });

  it("filters avatars by photo filter", async () => {
    renderEditor("/admin/avatar-personas/new");
    await userEvent.click(
      screen.getByText("voiceLive.vlDialogFilterPhoto").closest("button")!,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(1);
  });

  it("filters avatars by video filter", async () => {
    renderEditor("/admin/avatar-personas/new");
    await userEvent.click(
      screen.getByText("voiceLive.vlDialogFilterVideo").closest("button")!,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(2);
  });

  it("selecting an avatar updates the preview character/style", async () => {
    renderEditor("/admin/avatar-personas/new");
    await userEvent.click(screen.getAllByRole("img")[1]!); // lisa's second style
    const avatarView = screen.getByTestId("avatar-view");
    expect(avatarView).toHaveAttribute("data-avatar-character", "lisa");
    expect(avatarView).toHaveAttribute("data-avatar-style", "professional");
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

  it("shows configured-locale chip for en-US when voice/greeting are set", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
    expect(screen.getByText("personas.editor.configuredLocalesLabel")).toBeInTheDocument();
  });

  it("shows the configured greeting text in the preview (default active locale en-US)", () => {
    mockPersonaReturn = { data: MOCK_PERSONA, isLoading: false };
    renderEditor("/admin/avatar-personas/p-1/edit");
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
});
