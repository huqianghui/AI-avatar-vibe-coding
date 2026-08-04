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

// AvatarCharacterGallery and VoiceLiveModelSelect have their own dedicated
// test files -- mock them here so this suite focuses on ConfigurationPanel's
// own prop-driven conditional rendering (open/close, optional field groups,
// callback wiring), not their internals.
let capturedGalleryProps: Record<string, unknown> | null = null;
vi.mock("@/components/admin/avatar-character-gallery", () => ({
  AvatarCharacterGallery: (props: Record<string, unknown>) => {
    capturedGalleryProps = props;
    return <div data-testid="avatar-character-gallery">AvatarCharacterGallery</div>;
  },
}));

let capturedModelSelectProps: Record<string, unknown> | null = null;
vi.mock("@/components/admin/voice-live-model-select", () => ({
  VoiceLiveModelSelect: (props: Record<string, unknown>) => {
    capturedModelSelectProps = props;
    return <div data-testid="voice-live-model-select">VoiceLiveModelSelect</div>;
  },
}));

// Import after mocks
import { ConfigurationPanel } from "./configuration-panel";

function baseProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    language: "en-US",
    onLanguageChange: vi.fn(),
    voice: "en-US-AvaNeural",
    onVoiceChange: vi.fn(),
    avatarCharacter: "lisa",
    avatarStyle: "casual",
    onAvatarSelect: vi.fn(),
  };
}

describe("ConfigurationPanel", () => {
  beforeEach(() => {
    capturedGalleryProps = null;
    capturedModelSelectProps = null;
  });

  it("renders nothing in the DOM when closed", () => {
    render(<ConfigurationPanel {...baseProps()} open={false} />);
    expect(screen.queryByTestId("configuration-panel")).not.toBeInTheDocument();
  });

  it("renders the panel when open", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.getByTestId("configuration-panel")).toBeInTheDocument();
  });

  it("calls onOpenChange when the sheet requests to close", async () => {
    const onOpenChange = vi.fn();
    render(<ConfigurationPanel {...baseProps()} onOpenChange={onOpenChange} />);
    // Escape key triggers Radix Dialog's onOpenChange(false)
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses the default title when none is provided", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.getByText("admin:hcp.voiceAvatarConfigTitle")).toBeInTheDocument();
  });

  it("uses a custom title when provided", () => {
    render(<ConfigurationPanel {...baseProps()} title="Custom Title" />);
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(
      screen.queryByText("admin:hcp.voiceAvatarConfigTitle"),
    ).not.toBeInTheDocument();
  });

  it("always renders the three section headings", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.speechInput"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.speechOutput"),
    ).toBeInTheDocument();
    expect(screen.getByText("admin:voiceLive.playgroundSection.avatar")).toBeInTheDocument();
  });

  it("shows a disabledNote when provided", () => {
    render(<ConfigurationPanel {...baseProps()} disabledNote="Save first" />);
    expect(screen.getByText("Save first")).toBeInTheDocument();
  });

  it("does not render a disabledNote paragraph when omitted", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.queryByText("Save first")).not.toBeInTheDocument();
  });

  /* ── recognitionModel (HCP-only) ──────────────────────────────────── */

  it("does not render the recognition model field when recognitionModel/onRecognitionModelChange are omitted", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.queryByTestId("voice-live-model-select")).not.toBeInTheDocument();
    expect(screen.queryByText("admin:hcp.modelDeployment")).not.toBeInTheDocument();
  });

  it("renders the recognition model field and passes value/callback through when provided", () => {
    const onRecognitionModelChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        recognitionModel="gpt-4o"
        onRecognitionModelChange={onRecognitionModelChange}
      />,
    );
    expect(screen.getByTestId("voice-live-model-select")).toBeInTheDocument();
    expect(screen.getByText("admin:hcp.modelDeployment")).toBeInTheDocument();
    expect(capturedModelSelectProps).toBeTruthy();
    expect(capturedModelSelectProps!.value).toBe("gpt-4o");
    expect(capturedModelSelectProps!.onValueChange).toBe(onRecognitionModelChange);
  });

  /* ── showAutoDetectOption (HCP-only) ──────────────────────────────── */

  it("does not offer an Auto Detect language option by default", async () => {
    render(<ConfigurationPanel {...baseProps()} />);
    await userEvent.click(screen.getAllByRole("combobox")[0]!); // language select
    expect(screen.queryByText("admin:hcp.autoDetect")).not.toBeInTheDocument();
  });

  it("offers an Auto Detect language option when showAutoDetectOption is true", async () => {
    render(<ConfigurationPanel {...baseProps()} showAutoDetectOption />);
    await userEvent.click(screen.getAllByRole("combobox")[0]!); // language select
    expect(screen.getByText("admin:hcp.autoDetect")).toBeInTheDocument();
  });

  /* ── voiceDefaultOption (personas' "(use default)") ───────────────── */

  it("does not offer a default-voice option when voiceDefaultOption is omitted", async () => {
    render(<ConfigurationPanel {...baseProps()} />);
    await userEvent.click(screen.getAllByRole("combobox")[1]!); // voice select
    expect(screen.queryByText("Use default")).not.toBeInTheDocument();
  });

  it("offers the default-voice option when voiceDefaultOption is provided", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        voiceDefaultOption={{ value: "__use_default__", label: "Use default" }}
      />,
    );
    await userEvent.click(screen.getAllByRole("combobox")[1]!); // voice select
    expect(screen.getByText("Use default")).toBeInTheDocument();
  });

  /* ── greeting (personas-only) ─────────────────────────────────────── */

  it("does not render the greeting field when greeting/onGreetingChange are omitted", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.queryByText("admin:personas.greetingLabel")).not.toBeInTheDocument();
  });

  it("renders the greeting field with the given value when provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        greeting="Hi there!"
        onGreetingChange={vi.fn()}
      />,
    );
    expect(screen.getByText("admin:personas.greetingLabel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hi there!")).toBeInTheDocument();
  });

  it("calls onGreetingChange when the greeting textarea changes", async () => {
    const onGreetingChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        greeting=""
        onGreetingChange={onGreetingChange}
      />,
    );
    const textarea = screen.getByText("admin:personas.greetingLabel")
      .closest("div")!
      .querySelector("textarea")!;
    await userEvent.type(textarea, "Hi!");
    expect(onGreetingChange).toHaveBeenCalled();
  });

  /* ── speechOutputExtra ─────────────────────────────────────────────── */

  it("renders speechOutputExtra content when provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        speechOutputExtra={<div data-testid="extra-badges">extra</div>}
      />,
    );
    expect(screen.getByTestId("extra-badges")).toBeInTheDocument();
  });

  it("does not render anything extra when speechOutputExtra is omitted", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.queryByTestId("extra-badges")).not.toBeInTheDocument();
  });

  /* ── avatarEnabled (HCP-only) ─────────────────────────────────────── */

  it("does not render an avatar-enabled toggle by default", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders an avatar-enabled toggle when avatarEnabled/onAvatarEnabledChange are provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        avatarEnabled={true}
        onAvatarEnabledChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("calls onAvatarEnabledChange when the toggle is clicked", async () => {
    const onAvatarEnabledChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        avatarEnabled={true}
        onAvatarEnabledChange={onAvatarEnabledChange}
      />,
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onAvatarEnabledChange).toHaveBeenCalledWith(false);
  });

  /* ── avatar gallery passthrough ────────────────────────────────────── */

  it("always renders the AvatarCharacterGallery with the given character/style/onSelect", () => {
    const onAvatarSelect = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        avatarCharacter="lisa"
        avatarStyle="casual"
        onAvatarSelect={onAvatarSelect}
      />,
    );
    expect(screen.getByTestId("avatar-character-gallery")).toBeInTheDocument();
    expect(capturedGalleryProps).toBeTruthy();
    expect(capturedGalleryProps!.character).toBe("lisa");
    expect(capturedGalleryProps!.style).toBe("casual");
    expect(capturedGalleryProps!.onSelect).toBe(onAvatarSelect);
  });

  /* ── onReset ───────────────────────────────────────────────────────── */

  it("does not render a Reset footer button when onReset is omitted", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.reset"),
    ).not.toBeInTheDocument();
  });

  it("renders and wires a Reset footer button when onReset is provided", async () => {
    const onReset = vi.fn();
    render(<ConfigurationPanel {...baseProps()} onReset={onReset} />);
    const resetBtn = screen.getByText("admin:voiceLive.playgroundSection.reset");
    expect(resetBtn).toBeInTheDocument();
    await userEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalled();
  });
});
