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
        language={recognitionLanguage}
        onLanguageChange={(v) =>
          form.setValue("recognition_language", v, { shouldDirty: true })
        }
        showAutoDetectOption
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
      />
    </div>
  );
}
