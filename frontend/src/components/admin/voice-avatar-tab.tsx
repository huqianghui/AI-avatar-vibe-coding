import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { AgentConfigLeftPanel } from "@/components/admin/agent-config-left-panel";
import { PlaygroundPreviewPanel } from "@/components/admin/playground-preview-panel";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";

interface VoiceAvatarTabProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
}

export function VoiceAvatarTab({ form, profile, isNew }: VoiceAvatarTabProps) {
  // Auto-generated instructions from InstructionsSection (used as fallback systemPrompt)
  const [autoInstructions, setAutoInstructions] = useState("");
  const handleAutoInstructionsChange = useCallback((instructions: string) => {
    setAutoInstructions(instructions);
  }, []);

  // VMODE-01: voice/avatar config is now sourced directly from the 6 inline
  // HcpProfile form fields (Plan 38-01) rather than a bound VoiceLiveInstance.
  // voice_live_instance_id is vestigial/optional -- kept only as a fallback
  // identifier for VoiceTestPlayground's non-HCP (VL-instance testing) path.
  const vlInstanceId = form.watch("voice_live_instance_id");
  const avatarCharacter = form.watch("avatar_character");
  const avatarStyle = form.watch("avatar_style");
  const avatarEnabled = form.watch("avatar_enabled");
  // Voice mode is always available -- resolve_voice_config() on the backend
  // always returns a valid config regardless of VL instance linkage (38-01).
  const voiceModeEnabled = true;

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
        />
      </div>
    </div>
  );
}
