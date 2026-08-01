import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import AdminSettingsPage from "./settings";

vi.mock("react-i18next", async () => {
  const { createTestTranslator } = await import("@/test/i18n-mock");
  return {
    useTranslation: (namespace?: string | string[]) => ({
      t: createTestTranslator(namespace),
      i18n: { changeLanguage: vi.fn(), language: "en-US" },
    }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const defaultVoiceMap: Record<string, string> = {
  "zh-CN": "",
  "en-US": "",
  "es-ES": "es-ES-CustomNeural",
  "es-MX": "",
  "es-US": "",
};

const defaultVoiceDefaults: Record<string, string> = {
  "zh-CN": "zh-CN-XiaoxiaoNeural",
  "en-US": "en-US-AriaNeural",
  "es-ES": "es-ES-ElviraNeural",
  "es-MX": "es-MX-DaliaNeural",
  "es-US": "es-US-PalomaNeural",
};

let mockVoiceMapReturn: {
  data: { voice_map: Record<string, string>; defaults: Record<string, string> } | undefined;
  isLoading: boolean;
} = {
  data: { voice_map: { ...defaultVoiceMap }, defaults: { ...defaultVoiceDefaults } },
  isLoading: false,
};

const mockUpdateVoiceMapMutate = vi.fn();
let mockUpdateVoiceMapReturn: { mutate: typeof mockUpdateVoiceMapMutate; isPending: boolean } = {
  mutate: mockUpdateVoiceMapMutate,
  isPending: false,
};

vi.mock("@/hooks/use-voice-map", () => ({
  useVoiceMap: () => mockVoiceMapReturn,
  useUpdateVoiceMap: () => mockUpdateVoiceMapReturn,
}));

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVoiceMapReturn = {
      data: { voice_map: { ...defaultVoiceMap }, defaults: { ...defaultVoiceDefaults } },
      isLoading: false,
    };
    mockUpdateVoiceMapReturn = {
      mutate: mockUpdateVoiceMapMutate,
      isPending: false,
    };
  });

  it("renders the page title and description", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText("System Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Configure platform-wide settings"),
    ).toBeInTheDocument();
  });

  it("renders Language & Region card", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText("Language & Region")).toBeInTheDocument();
    expect(screen.getByText("Default Language")).toBeInTheDocument();
  });

  it("renders Data Retention card", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText("Data Retention")).toBeInTheDocument();
    expect(
      screen.getByText("Voice Recording Retention (days)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Voice recordings older than this will be automatically deleted",
      ),
    ).toBeInTheDocument();
  });

  it("renders Branding card", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText("Branding")).toBeInTheDocument();
    expect(screen.getByText("Organization Name")).toBeInTheDocument();
    expect(screen.getByText("Dark Mode")).toBeInTheDocument();
  });

  it("renders Save Settings button", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText("Save Settings")).toBeInTheDocument();
  });

  it("shows default retention days value of 90", () => {
    render(<AdminSettingsPage />);
    const retentionInput = screen.getByDisplayValue("90");
    expect(retentionInput).toBeInTheDocument();
  });

  it("shows default org name of BeiGene", () => {
    render(<AdminSettingsPage />);
    const orgInput = screen.getByDisplayValue("BeiGene");
    expect(orgInput).toBeInTheDocument();
  });

  it("allows editing retention days", async () => {
    render(<AdminSettingsPage />);
    const user = userEvent.setup();
    const retentionInput = screen.getByDisplayValue("90");
    await user.clear(retentionInput);
    await user.type(retentionInput, "30");
    expect(retentionInput).toHaveValue(30);
  });

  it("allows editing org name", async () => {
    render(<AdminSettingsPage />);
    const user = userEvent.setup();
    const orgInput = screen.getByDisplayValue("BeiGene");
    await user.clear(orgInput);
    await user.type(orgInput, "TestOrg");
    expect(orgInput).toHaveValue("TestOrg");
  });

  it("renders language select with default zh-CN", () => {
    render(<AdminSettingsPage />);
    // The select trigger shows "Chinese (Simplified)" because of the default value
    expect(
      screen.getByText("Chinese"),
    ).toBeInTheDocument();
  });

  it("renders all 5 language options including es-ES, es-MX, and es-US", async () => {
    render(<AdminSettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(5);
    expect(
      screen.getByRole("option", { name: "Español (España)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Español (México)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Español (EE. UU.)" }),
    ).toBeInTheDocument();
  });

  // ---- Voice per Language card ----

  it("renders the Voice per Language card with 5 rows (flag+label) and an Input per locale", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByText("Voice per Language")).toBeInTheDocument();
    expect(screen.getByText("🇨🇳 Chinese")).toBeInTheDocument();
    expect(screen.getByText("🇺🇸 English")).toBeInTheDocument();
    expect(screen.getByText("🇪🇸 Español (España)")).toBeInTheDocument();
    expect(screen.getByText("🇲🇽 Español (México)")).toBeInTheDocument();
    expect(screen.getByText("🇺🇸 Español (EE. UU.)")).toBeInTheDocument();
    // 5 editable Inputs, one per locale
    expect(screen.getByDisplayValue("es-ES-CustomNeural")).toBeInTheDocument();
  });

  it("shows each locale's default voice as the Input placeholder", () => {
    render(<AdminSettingsPage />);
    expect(screen.getByPlaceholderText("zh-CN-XiaoxiaoNeural")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("en-US-AriaNeural")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("es-ES-ElviraNeural")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("es-MX-DaliaNeural")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("es-US-PalomaNeural")).toBeInTheDocument();
  });

  it("sends the full 5-locale voice_map (including unedited rows) when Save Voice Settings is clicked", async () => {
    render(<AdminSettingsPage />);
    const user = userEvent.setup();

    const esMxInput = screen.getByPlaceholderText("es-MX-DaliaNeural");
    await user.type(esMxInput, "es-MX-CustomNeural");

    await user.click(screen.getByText("Save Voice Settings"));

    expect(mockUpdateVoiceMapMutate).toHaveBeenCalledWith(
      {
        voice_map: {
          "zh-CN": "",
          "en-US": "",
          "es-ES": "es-ES-CustomNeural",
          "es-MX": "es-MX-CustomNeural",
          "es-US": "",
        },
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("shows an error toast when the voice_map save mutation fails", async () => {
    render(<AdminSettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Save Voice Settings"));

    const call = mockUpdateVoiceMapMutate.mock.calls[0]!;
    const callbacks = call[1] as { onError: () => void };
    callbacks.onError();

    expect(toast.error).toHaveBeenCalledWith(
      "Something went wrong. The voice configuration could not be saved. Please check the value and try again.",
    );
  });

  it("WR-03: does not overwrite unsaved edits when the voice_map query data changes (background refetch)", async () => {
    const { rerender } = render(<AdminSettingsPage />);
    const user = userEvent.setup();

    const esMxInput = screen.getByPlaceholderText("es-MX-DaliaNeural");
    await user.type(esMxInput, "es-MX-UnsavedEdit");
    expect(esMxInput).toHaveValue("es-MX-UnsavedEdit");

    // Simulate a TanStack Query background refetch (e.g. refetchOnWindowFocus
    // after staleTime elapses) that returns a *new* object reference for the
    // server's last-saved data -- which does not include the admin's
    // in-progress, unsaved edit.
    mockVoiceMapReturn = {
      data: { voice_map: { ...defaultVoiceMap }, defaults: { ...defaultVoiceDefaults } },
      isLoading: false,
    };
    await act(async () => {
      rerender(<AdminSettingsPage />);
    });

    expect(screen.getByPlaceholderText("es-MX-DaliaNeural")).toHaveValue("es-MX-UnsavedEdit");
  });

  it("disables the Save Voice Settings button while the mutation is pending", () => {
    mockUpdateVoiceMapReturn = { mutate: mockUpdateVoiceMapMutate, isPending: true };
    render(<AdminSettingsPage />);
    expect(screen.getByText("Saving...").closest("button")).toBeDisabled();
  });
});
