import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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

  /** Recognition language for the active speech-input context. */
  language: string;
  onLanguageChange: (value: string) => void;
  /**
   * Whether to offer an "Auto Detect" option in the language select. Only
   * true where the backend field genuinely supports an "auto" sentinel
   * value (HCP's `recognition_language`); personas pick one concrete
   * locale at a time and have no such concept.
   */
  showAutoDetectOption?: boolean;

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
  language,
  onLanguageChange,
  showAutoDetectOption,
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
  disabledNote,
  onReset,
}: ConfigurationPanelProps) {
  const { t } = useTranslation(["admin", "common"]);

  const showRecognitionModel =
    recognitionModel !== undefined && onRecognitionModelChange !== undefined;
  const showAvatarToggle = avatarEnabled !== undefined && onAvatarEnabledChange !== undefined;
  const showGreeting = greeting !== undefined && onGreetingChange !== undefined;

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
                  {VOICE_NAME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(`admin:hcp.${opt.labelKey}`)}
                    </SelectItem>
                  ))}
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
