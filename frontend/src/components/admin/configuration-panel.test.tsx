import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  /* ── voice filtering by recognition language ─────────────────────────── */

  it("shows only Spanish (es-ES) and multilingual voices when language is es-ES", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        language="es-ES"
        voice="es-ES-ElviraNeural"
      />,
    );
    await userEvent.click(screen.getAllByRole("combobox")[1]!); // voice select
    // Elvira is also the current selection, so its label appears in both the
    // trigger and the dropdown option -- assert via the option role.
    expect(
      screen.getByRole("option", { name: "admin:hcp.voiceElvira" }),
    ).toBeInTheDocument();
    expect(screen.getByText("admin:hcp.voiceAlvaro")).toBeInTheDocument();
    expect(
      screen.getByText("admin:hcp.voiceXiaoxiaoMultilingual"),
    ).toBeInTheDocument();
    expect(screen.queryByText("admin:hcp.voiceJenny")).not.toBeInTheDocument();
    expect(screen.queryByText("admin:hcp.voiceDalia")).not.toBeInTheDocument();
  });

  it("keeps a selected voice visible even when it does not match the active language", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        language="es-ES"
        voice="en-US-JennyNeural"
      />,
    );
    await userEvent.click(screen.getAllByRole("combobox")[1]!); // voice select
    // Jenny is the current selection (shown in the trigger) and also
    // appended as a fallback dropdown option -- assert via the option role.
    expect(
      screen.getByRole("option", { name: "admin:hcp.voiceJenny" }),
    ).toBeInTheDocument();
  });

  it("does not duplicate the selected voice when it already matches the active language", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        language="es-ES"
        voice="es-ES-ElviraNeural"
      />,
    );
    await userEvent.click(screen.getAllByRole("combobox")[1]!); // voice select
    // The trigger's SelectValue also shows the selected label, so scope this
    // assertion to dropdown options only -- there must be exactly one.
    expect(screen.getAllByRole("option", { name: "admin:hcp.voiceElvira" })).toHaveLength(1);
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

  /* ── Advanced settings: interim response + proactive engagement
   * (persona-hcp-foundry-alignment Increment F) ──────────────────────── */

  it("does not render the Advanced settings section when neither interim response nor proactive engagement props are provided", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.advancedSettings"),
    ).not.toBeInTheDocument();
  });

  it("renders the Advanced settings toggle when interim response props are provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={false}
        onInterimResponseEnabledChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    ).toBeInTheDocument();
  });

  it("renders the Advanced settings toggle when proactive engagement props are provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        proactiveEngagement={false}
        onProactiveEngagementChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    ).toBeInTheDocument();
  });

  it("keeps Advanced settings collapsed by default, hiding the interim response and proactive engagement switches", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={false}
        onInterimResponseEnabledChange={vi.fn()}
        proactiveEngagement={false}
        onProactiveEngagementChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.interimResponse"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.proactiveEngagement"),
    ).not.toBeInTheDocument();
  });

  it("expands Advanced settings on click, revealing the interim response and proactive engagement switches", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={false}
        onInterimResponseEnabledChange={vi.fn()}
        proactiveEngagement={false}
        onProactiveEngagementChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.interimResponse"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.proactiveEngagement"),
    ).toBeInTheDocument();
  });

  it("does not render the interim response type/threshold fields when interim response is disabled", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={false}
        onInterimResponseEnabledChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.interimResponseType"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.interimResponseThreshold"),
    ).not.toBeInTheDocument();
  });

  it("renders the interim response type/threshold fields when interim response is enabled", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={true}
        onInterimResponseEnabledChange={vi.fn()}
        interimResponseType="llm"
        onInterimResponseTypeChange={vi.fn()}
        interimResponseThresholdMs={500}
        onInterimResponseThresholdMsChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.interimResponseType"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.interimResponseThreshold"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();
  });

  it("calls onInterimResponseEnabledChange when the interim response switch is toggled", async () => {
    const onInterimResponseEnabledChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={false}
        onInterimResponseEnabledChange={onInterimResponseEnabledChange}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onInterimResponseEnabledChange).toHaveBeenCalledWith(true);
  });

  it("calls onInterimResponseThresholdMsChange when the threshold input changes", async () => {
    const onInterimResponseThresholdMsChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        interimResponseEnabled={true}
        onInterimResponseEnabledChange={vi.fn()}
        interimResponseThresholdMs={500}
        onInterimResponseThresholdMsChange={onInterimResponseThresholdMsChange}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    const input = screen.getByDisplayValue("500");
    fireEvent.change(input, { target: { value: "800" } });
    expect(onInterimResponseThresholdMsChange).toHaveBeenCalledWith(800);
  });

  it("calls onProactiveEngagementChange when the proactive engagement switch is toggled", async () => {
    const onProactiveEngagementChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        proactiveEngagement={false}
        onProactiveEngagementChange={onProactiveEngagementChange}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onProactiveEngagementChange).toHaveBeenCalledWith(true);
  });

  /* ── speechRecognitionModel (transcription model, Increment G) ───────── */

  it("does not render the speech recognition model field by default", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(
      screen.queryByTestId("speech-recognition-model-select"),
    ).not.toBeInTheDocument();
  });

  it("renders the speech recognition model field when provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        speechRecognitionModel="azure-speech"
        onSpeechRecognitionModelChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("speech-recognition-model-select"),
    ).toBeInTheDocument();
    expect(screen.getByText("admin:hcp.speechRecognitionModel")).toBeInTheDocument();
  });

  it("calls onSpeechRecognitionModelChange when a new option is selected", async () => {
    const onSpeechRecognitionModelChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        speechRecognitionModel="azure-speech"
        onSpeechRecognitionModelChange={onSpeechRecognitionModelChange}
      />,
    );
    await userEvent.click(screen.getByTestId("speech-recognition-model-select"));
    await userEvent.click(screen.getByText("admin:hcp.speechRecognitionModelWhisper1"));
    expect(onSpeechRecognitionModelChange).toHaveBeenCalledWith("whisper-1");
  });

  /* ── autoDetectLanguage toggle (Increment G) ──────────────────────────── */

  it("does not render the auto-detect-language switch by default", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    expect(screen.queryByTestId("auto-detect-language-switch")).not.toBeInTheDocument();
  });

  it("renders the auto-detect-language switch when provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        autoDetectLanguage={false}
        onAutoDetectLanguageChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("auto-detect-language-switch")).toBeInTheDocument();
  });

  it("calls onAutoDetectLanguageChange when the switch is toggled", async () => {
    const onAutoDetectLanguageChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        autoDetectLanguage={false}
        onAutoDetectLanguageChange={onAutoDetectLanguageChange}
      />,
    );
    await userEvent.click(screen.getByTestId("auto-detect-language-switch"));
    expect(onAutoDetectLanguageChange).toHaveBeenCalledWith(true);
  });

  it("hides the concrete language select when autoDetectLanguage is true", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        autoDetectLanguage={true}
        onAutoDetectLanguageChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("admin:hcp.recognitionLanguage")).not.toBeInTheDocument();
  });

  it("shows the concrete language select when autoDetectLanguage is false", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        autoDetectLanguage={false}
        onAutoDetectLanguageChange={vi.fn()}
      />,
    );
    expect(screen.getByText("admin:hcp.recognitionLanguage")).toBeInTheDocument();
  });

  /* ── Speech input Advanced settings: EOU/noise/echo/phraseList
   * (persona-hcp-foundry-alignment Increment G) ───────────────────────── */

  it("does not render the speech-input Advanced settings toggle when no field props are provided", () => {
    render(<ConfigurationPanel {...baseProps()} />);
    // Only the speech-output Advanced settings toggle would exist if any
    // of those props were set -- here none are, so there should be no
    // "Advanced settings" text at all.
    expect(
      screen.queryByText("admin:voiceLive.playgroundSection.advancedSettings"),
    ).not.toBeInTheDocument();
  });

  it("renders the speech-input Advanced settings toggle when eouDetection is provided", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        eouDetection={false}
        onEouDetectionChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    ).toBeInTheDocument();
  });

  it("keeps speech-input Advanced settings collapsed by default", () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        eouDetection={false}
        onEouDetectionChange={vi.fn()}
        noiseSuppression={false}
        onNoiseSuppressionChange={vi.fn()}
        echoCancellation={false}
        onEchoCancellationChange={vi.fn()}
        phraseList=""
        onPhraseListChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("eou-detection-switch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("noise-suppression-switch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("echo-cancellation-switch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("phrase-list-textarea")).not.toBeInTheDocument();
  });

  it("expands speech-input Advanced settings on click, revealing all four fields", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        eouDetection={false}
        onEouDetectionChange={vi.fn()}
        noiseSuppression={false}
        onNoiseSuppressionChange={vi.fn()}
        echoCancellation={false}
        onEchoCancellationChange={vi.fn()}
        phraseList=""
        onPhraseListChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    expect(screen.getByTestId("eou-detection-switch")).toBeInTheDocument();
    expect(screen.getByTestId("noise-suppression-switch")).toBeInTheDocument();
    expect(screen.getByTestId("echo-cancellation-switch")).toBeInTheDocument();
    expect(screen.getByTestId("phrase-list-textarea")).toBeInTheDocument();
  });

  it("calls onEouDetectionChange, onNoiseSuppressionChange, and onEchoCancellationChange when their switches are toggled", async () => {
    const onEouDetectionChange = vi.fn();
    const onNoiseSuppressionChange = vi.fn();
    const onEchoCancellationChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        eouDetection={false}
        onEouDetectionChange={onEouDetectionChange}
        noiseSuppression={false}
        onNoiseSuppressionChange={onNoiseSuppressionChange}
        echoCancellation={false}
        onEchoCancellationChange={onEchoCancellationChange}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    await userEvent.click(screen.getByTestId("eou-detection-switch"));
    await userEvent.click(screen.getByTestId("noise-suppression-switch"));
    await userEvent.click(screen.getByTestId("echo-cancellation-switch"));
    expect(onEouDetectionChange).toHaveBeenCalledWith(true);
    expect(onNoiseSuppressionChange).toHaveBeenCalledWith(true);
    expect(onEchoCancellationChange).toHaveBeenCalledWith(true);
  });

  it("calls onPhraseListChange when the phrase list textarea changes", async () => {
    const onPhraseListChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        phraseList=""
        onPhraseListChange={onPhraseListChange}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    const textarea = screen.getByTestId("phrase-list-textarea");
    await userEvent.type(textarea, "a");
    expect(onPhraseListChange).toHaveBeenCalled();
  });

  /* ── Speech output Advanced settings extensions: voiceTemperature,
   * playbackSpeed, customLexiconUrl (Increment G) ─────────────────────── */

  it("does not render voiceTemperature/playbackSpeed/customLexiconUrl inputs by default", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        proactiveEngagement={false}
        onProactiveEngagementChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    expect(screen.queryByTestId("voice-temperature-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("playback-speed-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("custom-lexicon-url-input")).not.toBeInTheDocument();
  });

  it("renders voiceTemperature/playbackSpeed/customLexiconUrl inputs when provided", async () => {
    render(
      <ConfigurationPanel
        {...baseProps()}
        voiceTemperature={0.9}
        onVoiceTemperatureChange={vi.fn()}
        playbackSpeed={1.0}
        onPlaybackSpeedChange={vi.fn()}
        customLexiconUrl=""
        onCustomLexiconUrlChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    expect(screen.getByTestId("voice-temperature-input")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.9")).toBeInTheDocument();
    expect(screen.getByTestId("playback-speed-input")).toBeInTheDocument();
    expect(screen.getByTestId("custom-lexicon-url-input")).toBeInTheDocument();
  });

  it("calls onVoiceTemperatureChange, onPlaybackSpeedChange, and onCustomLexiconUrlChange when their inputs change", async () => {
    const onVoiceTemperatureChange = vi.fn();
    const onPlaybackSpeedChange = vi.fn();
    const onCustomLexiconUrlChange = vi.fn();
    render(
      <ConfigurationPanel
        {...baseProps()}
        voiceTemperature={0.9}
        onVoiceTemperatureChange={onVoiceTemperatureChange}
        playbackSpeed={1.0}
        onPlaybackSpeedChange={onPlaybackSpeedChange}
        customLexiconUrl=""
        onCustomLexiconUrlChange={onCustomLexiconUrlChange}
      />,
    );
    await userEvent.click(
      screen.getByText("admin:voiceLive.playgroundSection.advancedSettings"),
    );
    fireEvent.change(screen.getByTestId("voice-temperature-input"), {
      target: { value: "0.5" },
    });
    expect(onVoiceTemperatureChange).toHaveBeenCalledWith(0.5);

    fireEvent.change(screen.getByTestId("playback-speed-input"), {
      target: { value: "1.5" },
    });
    expect(onPlaybackSpeedChange).toHaveBeenCalledWith(1.5);

    fireEvent.change(screen.getByTestId("custom-lexicon-url-input"), {
      target: { value: "https://example.com/lexicon.xml" },
    });
    expect(onCustomLexiconUrlChange).toHaveBeenCalledWith(
      "https://example.com/lexicon.xml",
    );
  });
});
