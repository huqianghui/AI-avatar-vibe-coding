import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { ChevronRight, ChevronDown, Database, FileText, Plus, Trash2, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { InstructionsSection } from "@/components/admin/instructions-section";
import { AgentFoundationModelSelect } from "@/components/admin/agent-foundation-model-select";
import { VoiceLiveModelSelect } from "@/components/admin/voice-live-model-select";
import { AvatarCharacterGallery } from "@/components/admin/avatar-character-gallery";
import { ConnectKbDialog } from "@/components/admin/connect-kb-dialog";
import {
  useHcpKnowledgeConfigs,
  useAddKnowledgeConfig,
  useRemoveKnowledgeConfig,
} from "@/hooks/use-knowledge-base";
import type { KnowledgeConfigCreate } from "@/types/knowledge-base";
import { SUPPORTED_VOICE_LOCALES, LOCALE_FLAGS, LOCALE_LABEL_KEY, VOICE_NAME_OPTIONS } from "@/lib/voice-constants";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";

interface AgentConfigLeftPanelProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
  onAutoInstructionsChange?: (instructions: string) => void;
}

export function AgentConfigLeftPanel({
  form,
  profile,
  isNew,
  onAutoInstructionsChange,
}: AgentConfigLeftPanelProps) {
  const { t } = useTranslation(["admin", "common"]);

  const [knowledgeToolsExpanded, setKnowledgeToolsExpanded] = useState(false);
  const [connectKbDialogOpen, setConnectKbDialogOpen] = useState(false);
  // D-14: Foundation Model selection is not part of HcpFormValues (confirmed
  // by 29-07-SUMMARY.md — voice_live_model lives only on VoiceLiveInstanceSummary).
  // Tracked as local UI state only; not persisted to any hcp_profile field.
  const [foundationModel, setFoundationModel] = useState("");

  const { data: kbConfigs } = useHcpKnowledgeConfigs(profile?.id);
  const addKbMutation = useAddKnowledgeConfig();
  const removeKbMutation = useRemoveKnowledgeConfig();

  const handleConnectKb = (data: KnowledgeConfigCreate, onDone: () => void) => {
    if (!profile?.id) return;
    addKbMutation.mutate({ hcpId: profile.id, data }, { onSuccess: onDone });
  };

  const recognitionLanguage = form.watch("recognition_language");
  const voiceName = form.watch("voice_name");
  const avatarEnabled = form.watch("avatar_enabled");
  const avatarCharacter = form.watch("avatar_character");
  const avatarStyle = form.watch("avatar_style");

  return (
    <div className="space-y-4">
      {/* 1. Voice & Avatar Configuration (VMODE-01) — Foundry-portal-style
       * direct voice-mode config, replacing the removed VL Instance Summary
       * card. Persists directly to the 6 inline HcpProfile fields from
       * Plan 38-01; no VoiceLiveInstance selection required. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t("admin:hcp.voiceAvatarConfigTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {t("admin:hcp.modelDeployment")}
            </Label>
            <VoiceLiveModelSelect
              value={form.watch("voice_live_model")}
              onValueChange={(v) =>
                form.setValue("voice_live_model", v, { shouldDirty: true })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {t("admin:hcp.recognitionLanguage")}
            </Label>
            <Select
              value={recognitionLanguage}
              onValueChange={(v) =>
                form.setValue("recognition_language", v, { shouldDirty: true })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("admin:hcp.autoDetect")}</SelectItem>
                {SUPPORTED_VOICE_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {LOCALE_FLAGS[locale]}{" "}
                    {t(`common:lang.${LOCALE_LABEL_KEY[locale]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {t("admin:hcp.voiceName")}
            </Label>
            <Select
              value={voiceName}
              onValueChange={(v) =>
                form.setValue("voice_name", v, { shouldDirty: true })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_NAME_OPTIONS.map((voice) => (
                  <SelectItem key={voice.value} value={voice.value}>
                    {t(`admin:hcp.${voice.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              {t("admin:voiceLive.playgroundSection.enableAvatar")}
            </Label>
            <Switch
              checked={avatarEnabled}
              onCheckedChange={(checked) =>
                form.setValue("avatar_enabled", checked, { shouldDirty: true })
              }
            />
          </div>

          <AvatarCharacterGallery
            character={avatarCharacter}
            style={avatarStyle}
            onSelect={(characterId, style) => {
              form.setValue("avatar_character", characterId, { shouldDirty: true });
              form.setValue("avatar_style", style, { shouldDirty: true });
            }}
          />

          {isNew && (
            <p className="text-[10px] text-muted-foreground">
              {t("admin:hcp.playgroundDisabledNew")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. Agent Foundation Model (D-14) — decoupled from voice-mode config above */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <Label className="text-xs font-semibold">
            {t("admin:hcp.modelDeployment")}
          </Label>
          <div className="mt-2">
            <AgentFoundationModelSelect
              value={foundationModel}
              onValueChange={setFoundationModel}
              disabled={isNew}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Instructions Section */}
      <InstructionsSection
        form={form}
        profileId={profile?.id}
        isNew={isNew}
        onAutoInstructionsChange={onAutoInstructionsChange}
      />

      {/* 4. Knowledge & Tools (collapsible skeleton) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none pb-2"
          onClick={() => setKnowledgeToolsExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            {knowledgeToolsExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.knowledgeAndTools")}
            </CardTitle>
          </div>
        </CardHeader>
        {knowledgeToolsExpanded && (
          <CardContent className="space-y-3 pt-0">
            {/* Knowledge Bases */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  <FileText className="inline size-3.5 mr-1" />
                  {t("admin:hcp.knowledgeTitle")}
                </span>
                {profile?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setConnectKbDialogOpen(true)}
                  >
                    <Plus className="size-3 mr-1" />
                    {t("admin:hcp.addKnowledgeBase")}
                  </Button>
                )}
              </div>
              {kbConfigs && kbConfigs.length > 0 ? (
                <div className="space-y-1.5">
                  {kbConfigs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="flex items-center justify-between rounded border px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Database className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs truncate">{cfg.index_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeKbMutation.mutate(cfg.id)}
                        disabled={removeKbMutation.isPending}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {profile?.id
                    ? t("admin:hcp.noKnowledgeBases")
                    : t("admin:hcp.playgroundDisabledNew")}
                </p>
              )}
            </div>
            {/* Tools placeholder */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="size-4" />
              <span>{t("admin:hcp.toolsPlaceholder")}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Connect Knowledge Base Dialog */}
      {profile?.id && (
        <ConnectKbDialog
          open={connectKbDialogOpen}
          onOpenChange={setConnectKbDialogOpen}
          onConnect={handleConnectKb}
          isPending={addKbMutation.isPending}
        />
      )}
    </div>
  );
}
