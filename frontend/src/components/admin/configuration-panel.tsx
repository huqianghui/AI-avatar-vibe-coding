import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarCharacterGallery } from "@/components/admin/avatar-character-gallery";
import { VoiceLiveModelSelect } from "@/components/admin/voice-live-model-select";
import {
  SUPPORTED_VOICE_LOCALES,
  LOCALE_FLAGS,
  LOCALE_LABEL_KEY,
  VOICE_NAME_OPTIONS,
  voiceOptionsForLanguage,
  SPEECH_RECOGNITION_MODEL_OPTIONS,
} from "@/lib/voice-constants";

export interface ConfigurationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Optional Sheet title override. Defaults to `admin:hcp.voiceAvatarConfigTitle`. */
  title?: string;

  /**
   * Speech recognition model (Foundry Voice Live deployment). Only render
   * when the caller has a real backing field -- omit both this and
   * `onRecognitionModelChange` when there is nothing to persist to (e.g.
   * personas have no model-deployment concept for voice recognition).
   */
  recognitionModel?: string;
  onRecognitionModelChange?: (value: string) => void;

  /**
   * Speech recognition (transcription) model -- Foundry Voice Live
   * `session.input_audio_transcription.model` (persona-hcp-foundry-
   * alignment Increment G). Distinct from `recognitionModel` above, which
   * is the LLM "Model deployment" select. Omit both this and
   * `onSpeechRecognitionModelChange` when there is nothing to persist to.
   */
  speechRecognitionModel?: string;
  onSpeechRecognitionModelChange?: (value: string) => void;

  /** Recognition language for the active speech-input context. */
  language: string;
  onLanguageChange: (value: string) => void;
  /**
   * Whether to offer an "Auto Detect" option in the language select. Only
   * true where the backend field genuinely supports an "auto" sentinel
   * value (HCP's `recognition_language`); personas pick one concrete
   * locale at a time and have no such concept.
   *
   * @deprecated superseded by the `autoDetectLanguage` Switch below
   * (persona-hcp-foundry-alignment Increment G); kept for backward
   * compatibility with existing test coverage.
   */
  showAutoDetectOption?: boolean;

  /**
   * Language auto-detect toggle (persona-hcp-foundry-alignment Increment
   * G): a Switch rendered above the language select. When true, the
   * concrete language select below is hidden (language is detected at
   * runtime instead of chosen). HCP maps this to its existing
   * `recognition_language` "auto" sentinel; personas back it with a real
   * `auto_detect_language` column. Omit both this and
   * `onAutoDetectLanguageChange` to always show the concrete language
   * select (current behavior).
   */
  autoDetectLanguage?: boolean;
  onAutoDetectLanguageChange?: (value: boolean) => void;

  /** Speech output voice for the active language. */
  voice: string;
  onVoiceChange: (value: string) => void;
  /** Optional leading sentinel option (personas' "(use default)" voice). */
  voiceDefaultOption?: { value: string; label: string };

  /**
   * Greeting text for the active language (personas only). Omit both this
   * and `onGreetingChange` for callers with no greeting concept (HCP).
   */
  greeting?: string;
  onGreetingChange?: (value: string) => void;
  /** Extra content rendered after the greeting field (e.g. persona's
   * "configured languages" badge list). */
  speechOutputExtra?: ReactNode;

  /**
   * Avatar enable toggle. Only render when the caller has a real backing
   * field -- omit both this and `onAvatarEnabledChange` when the avatar is
   * unconditionally shown (personas always render an avatar).
   */
  avatarEnabled?: boolean;
  onAvatarEnabledChange?: (value: boolean) => void;

  avatarCharacter: string;
  avatarStyle: string;
  onAvatarSelect: (characterId: string, style: string) => void;

  /**
   * Interim response (Foundry-portal Speech output > Advanced settings):
   * a filler response played while the LLM generates its real answer.
   * Omit both this and `onInterimResponseEnabledChange` to hide the whole
   * Advanced settings > Interim response block (there is no caller that
   * currently omits it, but the pattern is kept consistent with the rest
   * of this component).
   */
  interimResponseEnabled?: boolean;
  onInterimResponseEnabledChange?: (value: boolean) => void;
  interimResponseType?: "llm" | "static";
  onInterimResponseTypeChange?: (value: "llm" | "static") => void;
  interimResponseThresholdMs?: number;
  onInterimResponseThresholdMsChange?: (value: number) => void;

  /** Proactive engagement (Foundry-portal Speech output > Advanced settings). */
  proactiveEngagement?: boolean;
  onProactiveEngagementChange?: (value: boolean) => void;

  /**
   * Speech input > Advanced settings (persona-hcp-foundry-alignment
   * Increment G): end-of-utterance detection, noise suppression, echo
   * cancellation, and a newline-separated phrase list. Each field is
   * independently gated -- omit a value/callback pair to hide just that
   * field, or omit all four to hide the whole collapsible.
   */
  eouDetection?: boolean;
  onEouDetectionChange?: (value: boolean) => void;
  noiseSuppression?: boolean;
  onNoiseSuppressionChange?: (value: boolean) => void;
  echoCancellation?: boolean;
  onEchoCancellationChange?: (value: boolean) => void;
  phraseList?: string;
  onPhraseListChange?: (value: string) => void;

  /**
   * Speech output > Advanced settings extensions (persona-hcp-foundry-
   * alignment Increment G): voice temperature, playback speed, and a
   * custom lexicon URL. Independently gated like the fields above.
   */
  voiceTemperature?: number;
  onVoiceTemperatureChange?: (value: number) => void;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (value: number) => void;
  customLexiconUrl?: string;
  onCustomLexiconUrlChange?: (value: string) => void;

  /** Note shown near the top of the panel (e.g. "Save profile first to test"). */
  disabledNote?: string;

  /** Resets the underlying form. Omit to hide the Reset button. */
  onReset?: () => void;
}

/**
 * Foundry-portal-style "Configuration" slide-out panel: opened by a gear
 * Configure button in the playground/preview toolbar, grouping voice-mode
 * settings (Speech input, Speech output, Avatar) that used to live in an
 * always-visible left-panel card.
 *
 * Shared by both the HCP profile editor and the Avatar Persona editor
 * (persona-hcp-foundry-alignment Increment D) -- callers own their own
 * form state and pass primitive values + change callbacks. Fields with no
 * real backend counterpart for a given caller are omitted entirely rather
 * than rendered as non-persisting decoration.
 */
export function ConfigurationPanel({
  open,
  onOpenChange,
  title,
  recognitionModel,
  onRecognitionModelChange,
  speechRecognitionModel,
  onSpeechRecognitionModelChange,
  language,
  onLanguageChange,
  showAutoDetectOption,
  autoDetectLanguage,
  onAutoDetectLanguageChange,
  voice,
  onVoiceChange,
  voiceDefaultOption,
  greeting,
  onGreetingChange,
  speechOutputExtra,
  avatarEnabled,
  onAvatarEnabledChange,
  avatarCharacter,
  avatarStyle,
  onAvatarSelect,
  interimResponseEnabled,
  onInterimResponseEnabledChange,
  interimResponseType,
  onInterimResponseTypeChange,
  interimResponseThresholdMs,
  onInterimResponseThresholdMsChange,
  proactiveEngagement,
  onProactiveEngagementChange,
  eouDetection,
  onEouDetectionChange,
  noiseSuppression,
  onNoiseSuppressionChange,
  echoCancellation,
  onEchoCancellationChange,
  phraseList,
  onPhraseListChange,
  voiceTemperature,
  onVoiceTemperatureChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  customLexiconUrl,
  onCustomLexiconUrlChange,
  disabledNote,
  onReset,
}: ConfigurationPanelProps) {
  const { t } = useTranslation(["admin", "common"]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [inputAdvancedOpen, setInputAdvancedOpen] = useState(false);

  const showRecognitionModel =
    recognitionModel !== undefined && onRecognitionModelChange !== undefined;
  const showSpeechRecognitionModel =
    speechRecognitionModel !== undefined && onSpeechRecognitionModelChange !== undefined;
  const showAutoDetectToggle =
    autoDetectLanguage !== undefined && onAutoDetectLanguageChange !== undefined;
  const showAvatarToggle = avatarEnabled !== undefined && onAvatarEnabledChange !== undefined;
  const showGreeting = greeting !== undefined && onGreetingChange !== undefined;
  const showInterimResponse =
    interimResponseEnabled !== undefined && onInterimResponseEnabledChange !== undefined;
  const showProactiveEngagement =
    proactiveEngagement !== undefined && onProactiveEngagementChange !== undefined;
  const showEouDetection = eouDetection !== undefined && onEouDetectionChange !== undefined;
  const showNoiseSuppression =
    noiseSuppression !== undefined && onNoiseSuppressionChange !== undefined;
  const showEchoCancellation =
    echoCancellation !== undefined && onEchoCancellationChange !== undefined;
  const showPhraseList = phraseList !== undefined && onPhraseListChange !== undefined;
  const showSpeechInputAdvanced =
    showEouDetection || showNoiseSuppression || showEchoCancellation || showPhraseList;
  const showVoiceTemperature =
    voiceTemperature !== undefined && onVoiceTemperatureChange !== undefined;
  const showPlaybackSpeed = playbackSpeed !== undefined && onPlaybackSpeedChange !== undefined;
  const showCustomLexiconUrl =
    customLexiconUrl !== undefined && onCustomLexiconUrlChange !== undefined;
  const showOutputExtras = showVoiceTemperature || showPlaybackSpeed || showCustomLexiconUrl;
  const showAdvancedSettings = showInterimResponse || showProactiveEngagement || showOutputExtras;

  // Filter the speech-output voice list to the active recognition language
  // (plus multilingual voices). If the currently-selected voice isn't in that
  // filtered set -- e.g. the panel opens with a language/voice combo saved
  // before this filtering existed -- keep it visible as an extra option so
  // the saved value isn't silently dropped from the Select.
  const filteredVoiceOptions = voiceOptionsForLanguage(language);
  const selectedVoiceVisible =
    voice === voiceDefaultOption?.value ||
    voice === "" ||
    filteredVoiceOptions.some((opt) => opt.value === voice);
  const selectedVoiceFallback = !selectedVoiceVisible
    ? VOICE_NAME_OPTIONS.find((opt) => opt.value === voice)
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col overflow-hidden"
        data-testid="configuration-panel"
      >
        <SheetHeader>
          <SheetTitle>{title ?? t("admin:hcp.voiceAvatarConfigTitle")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {disabledNote && (
            <p className="text-xs text-muted-foreground">{disabledNote}</p>
          )}

          {/* Speech input */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("admin:voiceLive.playgroundSection.speechInput")}
            </h3>
            {showRecognitionModel && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("admin:hcp.modelDeployment")}
                </Label>
                <VoiceLiveModelSelect
                  value={recognitionModel!}
                  onValueChange={onRecognitionModelChange!}
                />
              </div>
            )}
            {showSpeechRecognitionModel && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("admin:hcp.speechRecognitionModel")}
                </Label>
                <Select
                  value={speechRecognitionModel}
                  onValueChange={onSpeechRecognitionModelChange}
                >
                  <SelectTrigger
                    data-testid="speech-recognition-model-select"
                    className="h-8 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEECH_RECOGNITION_MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(`admin:hcp.${opt.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showAutoDetectToggle && (
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  {t("admin:voiceLive.playgroundSection.autoDetectLanguage")}
                </Label>
                <Switch
                  data-testid="auto-detect-language-switch"
                  checked={autoDetectLanguage}
                  onCheckedChange={onAutoDetectLanguageChange}
                />
              </div>
            )}
            {!autoDetectLanguage && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("admin:hcp.recognitionLanguage")}
                </Label>
                <Select value={language} onValueChange={onLanguageChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {showAutoDetectOption && (
                      <SelectItem value="auto">{t("admin:hcp.autoDetect")}</SelectItem>
                    )}
                    {SUPPORTED_VOICE_LOCALES.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {LOCALE_FLAGS[locale]} {t(`common:lang.${LOCALE_LABEL_KEY[locale]}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showSpeechInputAdvanced && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => setInputAdvancedOpen((prev) => !prev)}
                  aria-expanded={inputAdvancedOpen}
                >
                  {inputAdvancedOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  {t("admin:voiceLive.playgroundSection.advancedSettings")}
                </button>

                {inputAdvancedOpen && (
                  <div className="space-y-3 pl-1">
                    {showEouDetection && (
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.eouDetection")}
                        </Label>
                        <Switch
                          data-testid="eou-detection-switch"
                          checked={eouDetection}
                          onCheckedChange={onEouDetectionChange}
                        />
                      </div>
                    )}
                    {showNoiseSuppression && (
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.noiseSuppression")}
                        </Label>
                        <Switch
                          data-testid="noise-suppression-switch"
                          checked={noiseSuppression}
                          onCheckedChange={onNoiseSuppressionChange}
                        />
                      </div>
                    )}
                    {showEchoCancellation && (
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.echoCancellation")}
                        </Label>
                        <Switch
                          data-testid="echo-cancellation-switch"
                          checked={echoCancellation}
                          onCheckedChange={onEchoCancellationChange}
                        />
                      </div>
                    )}
                    {showPhraseList && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.phraseList")}
                        </Label>
                        <Textarea
                          data-testid="phrase-list-textarea"
                          rows={3}
                          className="text-xs resize-none"
                          value={phraseList}
                          onChange={(e) => onPhraseListChange!(e.target.value)}
                          placeholder={t(
                            "admin:voiceLive.playgroundSection.phraseListPlaceholder",
                          )}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("admin:voiceLive.playgroundSection.phraseListHelper")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Speech output */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("admin:voiceLive.playgroundSection.speechOutput")}
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("admin:hcp.voiceName")}</Label>
              <Select value={voice} onValueChange={onVoiceChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voiceDefaultOption && (
                    <SelectItem value={voiceDefaultOption.value}>
                      {voiceDefaultOption.label}
                    </SelectItem>
                  )}
                  {filteredVoiceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(`admin:hcp.${opt.labelKey}`)}
                    </SelectItem>
                  ))}
                  {selectedVoiceFallback && (
                    <SelectItem
                      key={selectedVoiceFallback.value}
                      value={selectedVoiceFallback.value}
                    >
                      {t(`admin:hcp.${selectedVoiceFallback.labelKey}`)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {showGreeting && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("admin:personas.greetingLabel")}
                </Label>
                <Textarea
                  id="persona-editor-greeting"
                  rows={2}
                  className="text-sm resize-none"
                  value={greeting}
                  onChange={(e) => onGreetingChange!(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin:personas.greetingHelper")}
                </p>
              </div>
            )}

            {speechOutputExtra}

            {showAdvancedSettings && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  aria-expanded={advancedOpen}
                >
                  {advancedOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  {t("admin:voiceLive.playgroundSection.advancedSettings")}
                </button>

                {advancedOpen && (
                  <div className="space-y-4 pl-1">
                    {showInterimResponse && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">
                            {t("admin:voiceLive.playgroundSection.interimResponse")}
                          </Label>
                          <Switch
                            data-testid="interim-response-switch"
                            checked={interimResponseEnabled}
                            onCheckedChange={onInterimResponseEnabledChange}
                          />
                        </div>
                        {interimResponseEnabled && (
                          <div className="space-y-2 pl-1">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">
                                {t("admin:voiceLive.playgroundSection.interimResponseType")}
                              </Label>
                              <Select
                                value={interimResponseType ?? "llm"}
                                onValueChange={(v) =>
                                  onInterimResponseTypeChange?.(v as "llm" | "static")
                                }
                              >
                                <SelectTrigger
                                  data-testid="interim-response-type-select"
                                  className="h-8 text-xs"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="llm">
                                    {t(
                                      "admin:voiceLive.playgroundSection.interimResponseTypeLlm",
                                    )}
                                  </SelectItem>
                                  <SelectItem value="static">
                                    {t(
                                      "admin:voiceLive.playgroundSection.interimResponseTypeStatic",
                                    )}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">
                                {t("admin:voiceLive.playgroundSection.interimResponseThreshold")}
                              </Label>
                              <Input
                                data-testid="interim-response-threshold-input"
                                type="number"
                                min={0}
                                step={100}
                                className="h-8 text-xs"
                                value={interimResponseThresholdMs ?? 500}
                                onChange={(e) =>
                                  onInterimResponseThresholdMsChange?.(
                                    Number(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {showInterimResponse && showProactiveEngagement && <Separator />}

                    {showProactiveEngagement && (
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.proactiveEngagement")}
                        </Label>
                        <Switch
                          data-testid="proactive-engagement-switch"
                          checked={proactiveEngagement}
                          onCheckedChange={onProactiveEngagementChange}
                        />
                      </div>
                    )}

                    {(showInterimResponse || showProactiveEngagement) && showOutputExtras && (
                      <Separator />
                    )}

                    {showVoiceTemperature && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.voiceTemperature")}
                        </Label>
                        <Input
                          data-testid="voice-temperature-input"
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          className="h-8 text-xs"
                          value={voiceTemperature ?? 0.9}
                          onChange={(e) =>
                            onVoiceTemperatureChange?.(Number(e.target.value) || 0)
                          }
                        />
                      </div>
                    )}

                    {showPlaybackSpeed && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.playbackSpeed")}
                        </Label>
                        <Input
                          data-testid="playback-speed-input"
                          type="number"
                          min={0.5}
                          max={2}
                          step={0.05}
                          className="h-8 text-xs"
                          value={playbackSpeed ?? 1.0}
                          onChange={(e) => onPlaybackSpeedChange?.(Number(e.target.value) || 0)}
                        />
                      </div>
                    )}

                    {showCustomLexiconUrl && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          {t("admin:voiceLive.playgroundSection.customLexiconUrl")}
                        </Label>
                        <Input
                          data-testid="custom-lexicon-url-input"
                          type="text"
                          className="h-8 text-xs"
                          value={customLexiconUrl ?? ""}
                          onChange={(e) => onCustomLexiconUrlChange?.(e.target.value)}
                          placeholder={t(
                            "admin:voiceLive.playgroundSection.customLexiconUrlPlaceholder",
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("admin:voiceLive.playgroundSection.avatar")}
            </h3>
            {showAvatarToggle && (
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  {t("admin:voiceLive.playgroundSection.enableAvatar")}
                </Label>
                <Switch
                  checked={avatarEnabled}
                  onCheckedChange={onAvatarEnabledChange}
                />
              </div>
            )}
            <AvatarCharacterGallery
              character={avatarCharacter}
              style={avatarStyle}
              onSelect={onAvatarSelect}
            />
          </div>
        </div>

        {onReset && (
          <SheetFooter>
            <Button variant="outline" className="w-full" onClick={onReset}>
              {t("admin:voiceLive.playgroundSection.reset")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
