import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentConfigLeftPanel } from "@/components/admin/agent-config-left-panel";
import { PlaygroundPreviewPanel } from "@/components/admin/playground-preview-panel";
import { ConfigurationPanel } from "@/components/admin/configuration-panel";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";

interface VoiceAvatarTabProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
}

export function VoiceAvatarTab({ form, profile, isNew }: VoiceAvatarTabProps) {
  const { t } = useTranslation(["admin"]);

  // Auto-generated instructions from InstructionsSection (used as fallback systemPrompt)
  const [autoInstructions, setAutoInstructions] = useState("");
  const handleAutoInstructionsChange = useCallback((instructions: string) => {
    setAutoInstructions(instructions);
  }, []);

  // Foundry-portal-style gear "Configure" button -> right-side Configuration
  // panel (persona-hcp-foundry-alignment Increment D). Owns its own open
  // state here since the panel is triggered from the playground toolbar but
  // reads/writes the same react-hook-form instance as the left panel.
  const [configPanelOpen, setConfigPanelOpen] = useState(false);

  // VMODE-01: voice/avatar config is now sourced directly from the 6 inline
  // HcpProfile form fields (Plan 38-01) rather than a bound VoiceLiveInstance.
  // voice_live_instance_id is vestigial/optional -- kept only as a fallback
  // identifier for VoiceTestPlayground's non-HCP (VL-instance testing) path.
  const vlInstanceId = form.watch("voice_live_instance_id");
  const avatarCharacter = form.watch("avatar_character");
  const avatarStyle = form.watch("avatar_style");
  const avatarEnabled = form.watch("avatar_enabled");
  const voiceLiveModel = form.watch("voice_live_model");
  const recognitionLanguage = form.watch("recognition_language");
  const voiceName = form.watch("voice_name");
  // Voice mode is always available -- resolve_voice_config() on the backend
  // always returns a valid config regardless of VL instance linkage (38-01).
  const voiceModeEnabled = true;

  // Interim response + proactive engagement (persona-hcp-foundry-alignment
  // Increment F) -- Foundry-portal Configuration panel > Speech output >
  // Advanced settings.
  const proactiveEngagement = form.watch("proactive_engagement");
  const interimResponseEnabled = form.watch("interim_response_enabled");
  const interimResponseType = form.watch("interim_response_type");
  const interimResponseThresholdMs = form.watch("interim_response_threshold_ms");

  // Foundry Configuration panel parity (persona-hcp-foundry-alignment
  // Increment G): speech recognition (transcription) model, speech input
  // Advanced settings, speech output Advanced settings extensions.
  const speechRecognitionModel = form.watch("speech_recognition_model");
  const eouDetection = form.watch("eou_detection");
  const noiseSuppression = form.watch("noise_suppression");
  const echoCancellation = form.watch("echo_cancellation");
  const phraseList = form.watch("phrase_list");
  const voiceTemperature = form.watch("voice_temperature");
  const playbackSpeed = form.watch("playback_speed");
  const customLexiconUrl = form.watch("custom_lexicon_url");

  // systemPrompt: use override if set, otherwise use auto-generated instructions
  const overridePrompt = form.watch("agent_instructions_override");
  const systemPrompt = (overridePrompt && overridePrompt.trim()) ? overridePrompt : autoInstructions;

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[480px]">
      {/* Left Panel: Agent Configuration — fixed width, scrollable, matching VL editor */}
      <div className="w-[380px] min-w-[340px] border-r overflow-y-auto p-4 space-y-4">
        <AgentConfigLeftPanel
          form={form}
          profile={profile}
          isNew={isNew}
          onAutoInstructionsChange={handleAutoInstructionsChange}
        />
      </div>
      {/* Right Panel: Playground Preview — fills remaining space, matching VL editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <PlaygroundPreviewPanel
          hcpProfileId={profile?.id}
          profileName={profile?.name}
          agentId={profile?.agent_id}
          vlInstanceId={vlInstanceId ?? undefined}
          systemPrompt={systemPrompt}
          avatarCharacter={avatarCharacter}
          avatarStyle={avatarStyle}
          avatarEnabled={avatarEnabled}
          voiceModeEnabled={voiceModeEnabled}
          disabled={isNew}
          toolbarExtra={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label={t("admin:hcp.configureButton")}
              onClick={() => setConfigPanelOpen(true)}
            >
              <Settings className="size-3.5" />
              {t("admin:hcp.configureButton")}
            </Button>
          }
        />
      </div>

      <ConfigurationPanel
        open={configPanelOpen}
        onOpenChange={setConfigPanelOpen}
        recognitionModel={voiceLiveModel}
        onRecognitionModelChange={(v) =>
          form.setValue("voice_live_model", v, { shouldDirty: true })
        }
        speechRecognitionModel={speechRecognitionModel}
        onSpeechRecognitionModelChange={(v) =>
          form.setValue("speech_recognition_model", v, { shouldDirty: true })
        }
        language={recognitionLanguage}
        onLanguageChange={(v) =>
          form.setValue("recognition_language", v, { shouldDirty: true })
        }
        autoDetectLanguage={recognitionLanguage === "auto"}
        onAutoDetectLanguageChange={(v) =>
          form.setValue(
            "recognition_language",
            v ? "auto" : "en-US",
            { shouldDirty: true },
          )
        }
        voice={voiceName}
        onVoiceChange={(v) => form.setValue("voice_name", v, { shouldDirty: true })}
        avatarEnabled={avatarEnabled}
        onAvatarEnabledChange={(v) =>
          form.setValue("avatar_enabled", v, { shouldDirty: true })
        }
        avatarCharacter={avatarCharacter}
        avatarStyle={avatarStyle}
        onAvatarSelect={(characterId, style) => {
          form.setValue("avatar_character", characterId, { shouldDirty: true });
          form.setValue("avatar_style", style, { shouldDirty: true });
        }}
        disabledNote={isNew ? t("admin:hcp.playgroundDisabledNew") : undefined}
        interimResponseEnabled={interimResponseEnabled}
        onInterimResponseEnabledChange={(v) =>
          form.setValue("interim_response_enabled", v, { shouldDirty: true })
        }
        interimResponseType={interimResponseType}
        onInterimResponseTypeChange={(v) =>
          form.setValue("interim_response_type", v, { shouldDirty: true })
        }
        interimResponseThresholdMs={interimResponseThresholdMs}
        onInterimResponseThresholdMsChange={(v) =>
          form.setValue("interim_response_threshold_ms", v, { shouldDirty: true })
        }
        proactiveEngagement={proactiveEngagement}
        onProactiveEngagementChange={(v) =>
          form.setValue("proactive_engagement", v, { shouldDirty: true })
        }
        eouDetection={eouDetection}
        onEouDetectionChange={(v) =>
          form.setValue("eou_detection", v, { shouldDirty: true })
        }
        noiseSuppression={noiseSuppression}
        onNoiseSuppressionChange={(v) =>
          form.setValue("noise_suppression", v, { shouldDirty: true })
        }
        echoCancellation={echoCancellation}
        onEchoCancellationChange={(v) =>
          form.setValue("echo_cancellation", v, { shouldDirty: true })
        }
        phraseList={phraseList}
        onPhraseListChange={(v) =>
          form.setValue("phrase_list", v, { shouldDirty: true })
        }
        voiceTemperature={voiceTemperature}
        onVoiceTemperatureChange={(v) =>
          form.setValue("voice_temperature", v, { shouldDirty: true })
        }
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={(v) =>
          form.setValue("playback_speed", v, { shouldDirty: true })
        }
        customLexiconUrl={customLexiconUrl}
        onCustomLexiconUrlChange={(v) =>
          form.setValue("custom_lexicon_url", v, { shouldDirty: true })
        }
        onReset={() => {
          // Foundry-portal parity: the Configuration panel's footer Reset
          // restores voice-mode fields to their last-saved values (form
          // defaults are re-seeded from the profile on load). resetField()
          // can't be used here: these fields are never register()ed (they
          // drive custom components via watch/setValue), so it is a no-op.
          const d = form.formState.defaultValues;
          const opts = { shouldDirty: true } as const;
          form.setValue("voice_live_model", d?.voice_live_model ?? "gpt-4o", opts);
          form.setValue("voice_name", d?.voice_name ?? "en-US-AvaNeural", opts);
          form.setValue("recognition_language", d?.recognition_language ?? "auto", opts);
          form.setValue("avatar_character", d?.avatar_character ?? "lisa", opts);
          form.setValue("avatar_style", d?.avatar_style ?? "casual", opts);
          form.setValue("avatar_enabled", d?.avatar_enabled ?? true, opts);
          form.setValue("proactive_engagement", d?.proactive_engagement ?? false, opts);
          form.setValue(
            "interim_response_enabled",
            d?.interim_response_enabled ?? false,
            opts,
          );
          form.setValue("interim_response_type", d?.interim_response_type ?? "llm", opts);
          form.setValue(
            "interim_response_threshold_ms",
            d?.interim_response_threshold_ms ?? 500,
            opts,
          );
          form.setValue(
            "speech_recognition_model",
            d?.speech_recognition_model ?? "azure-speech",
            opts,
          );
          form.setValue("eou_detection", d?.eou_detection ?? false, opts);
          form.setValue("noise_suppression", d?.noise_suppression ?? false, opts);
          form.setValue("echo_cancellation", d?.echo_cancellation ?? false, opts);
          form.setValue("phrase_list", d?.phrase_list ?? "", opts);
          form.setValue("voice_temperature", d?.voice_temperature ?? 0.9, opts);
          form.setValue("playback_speed", d?.playback_speed ?? 1.0, opts);
          form.setValue("custom_lexicon_url", d?.custom_lexicon_url ?? "", opts);
        }}
      />
    </div>
  );
}
