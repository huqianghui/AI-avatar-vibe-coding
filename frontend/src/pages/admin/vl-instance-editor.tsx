import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceLiveModelSelect } from "@/components/admin/voice-live-model-select";
import { VoiceTestPlayground } from "@/components/voice/voice-test-playground";
import { AssignHcpDialog } from "@/components/admin/assign-hcp-dialog";
import {
  useVoiceLiveInstance,
  useCreateVoiceLiveInstance,
  useUpdateVoiceLiveInstance,
} from "@/hooks/use-voice-live-instances";
import { useHcpProfiles } from "@/hooks/use-hcp-profiles";
import type { SessionState as PlaygroundSessionState } from "@/components/voice/voice-test-playground";
import {
  AVATAR_CHARACTERS,
  getAvatarInitials,
} from "@/data/avatar-characters";
import { cn } from "@/lib/utils";
import {
  VOICE_NAME_OPTIONS,
  TURN_DETECTION_TYPES,
  RECOGNITION_LANGUAGES,
  CDN_BASE,
  createDefaultVlInstanceForm,
  voiceOptionsForLanguage,
} from "@/lib/voice-constants";
import type { VoiceLiveInstanceCreate } from "@/types/voice-live";

const DEFAULT_FORM = createDefaultVlInstanceForm();

type AvatarGridItem = {
  characterId: string;
  displayName: string;
  style: string;
  styleLabel: string;
  isPhotoAvatar: boolean;
  thumbnailUrl: string;
  gradientClasses: string;
};

/* ── Collapsible Section ─────────────────────────────────────────────── */

function AdvancedToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      onClick={onToggle}
    >
      {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      {label}
    </button>
  );
}

/* ── Page Component ───────────────────────────────────────────────────── */

export default function VlInstanceEditorPage() {
  const { t } = useTranslation("admin");
  const tp = useCallback(
    (key: string) => t(`voiceLive.playgroundSection.${key}`),
    [t],
  );
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  /* ── Data hooks ─────────────────────────────────────────────────────── */

  const { data: instance, isLoading } = useVoiceLiveInstance(id);
  const createMutation = useCreateVoiceLiveInstance();
  const updateMutation = useUpdateVoiceLiveInstance();
  const { data: hcpData } = useHcpProfiles();
  const hcpProfiles = hcpData?.items ?? [];

  // HCPs assigned to this instance (for test session)
  const assignedHcps = useMemo(
    () => (id ? hcpProfiles.filter((p) => p.voice_live_instance_id === id) : []),
    [hcpProfiles, id],
  );
  const testHcp = assignedHcps[0];

  /* ── Form state ────────────────────────────────────────────────────── */

  const [form, setForm] = useState<VoiceLiveInstanceCreate>({ ...DEFAULT_FORM });
  const [avatarFilter, setAvatarFilter] = useState<"all" | "photo" | "video">("all");
  const formInitializedRef = useRef(false);

  // Collapsible section states
  const [showResponseAdvanced, setShowResponseAdvanced] = useState(false);
  const [showInputAdvanced, setShowInputAdvanced] = useState(false);
  const [showOutputAdvanced, setShowOutputAdvanced] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);

  // Populate form ONCE when instance first loads
  useEffect(() => {
    if (instance && !formInitializedRef.current) {
      formInitializedRef.current = true;
      const {
        id: _id, hcp_count: _hc, created_by: _cb,
        created_at: _ca, updated_at: _ua,
        ...formFields
      } = instance;
      setForm({
        ...DEFAULT_FORM,
        ...formFields,
        description: instance.description ?? "",
        model_instruction: instance.model_instruction ?? "",
      });
    }
  }, [instance]);

  const updateField = useCallback(
    <K extends keyof VoiceLiveInstanceCreate>(
      key: K,
      value: VoiceLiveInstanceCreate[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (instance) {
      const {
        id: _id, hcp_count: _hc, created_by: _cb,
        created_at: _ca, updated_at: _ua,
        ...formFields
      } = instance;
      setForm({
        ...DEFAULT_FORM,
        ...formFields,
        description: instance.description ?? "",
        model_instruction: instance.model_instruction ?? "",
      });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
  }, [instance]);

  // Filter the speech-output voice list to the form's recognition language
  // (plus multilingual voices); "auto" shows every voice. Keep the currently
  // selected voice visible even if it falls outside the filtered set, so a
  // previously-saved value isn't silently dropped from the Select.
  const filteredVoiceOptions = useMemo(
    () => voiceOptionsForLanguage(form.recognition_language ?? "auto"),
    [form.recognition_language],
  );
  const selectedVoiceFallback = useMemo(() => {
    const currentVoice = form.voice_name ?? "en-US-AvaNeural";
    if (filteredVoiceOptions.some((opt) => opt.value === currentVoice)) {
      return undefined;
    }
    return VOICE_NAME_OPTIONS.find((opt) => opt.value === currentVoice);
  }, [filteredVoiceOptions, form.voice_name]);

  /* ── Voice test session state (delegated to VoiceTestPlayground) ──── */

  const [isTestActive, setIsTestActive] = useState(false);
  const handleSessionStateChange = useCallback(
    (state: PlaygroundSessionState) => {
      setIsTestActive(state === "connected" || state === "connecting");
    },
    [],
  );

  /* ── Avatar grid ────────────────────────────────────────────────────── */

  const filteredAvatarItems = useMemo(() => {
    const items: AvatarGridItem[] = [];
    for (const c of AVATAR_CHARACTERS) {
      if (c.isPhotoAvatar) {
        if (avatarFilter === "video") continue;
        items.push({
          characterId: c.id,
          displayName: c.displayName,
          style: "",
          styleLabel: "",
          isPhotoAvatar: true,
          thumbnailUrl: c.thumbnailUrl,
          gradientClasses: c.gradientClasses,
        });
      } else {
        if (avatarFilter === "photo") continue;
        for (const s of c.styles) {
          items.push({
            characterId: c.id,
            displayName: c.displayName,
            style: s,
            styleLabel: s.replace(/-/g, " "),
            isPhotoAvatar: false,
            thumbnailUrl: `${CDN_BASE}/${c.id}-${s}.png`,
            gradientClasses: c.gradientClasses,
          });
        }
      }
    }
    return items;
  }, [avatarFilter]);

  const failedThumbnailsRef = useRef(new Set<string>());
  const [, setThumbnailRerender] = useState(0);
  const handleThumbnailError = useCallback((key: string) => {
    if (!failedThumbnailsRef.current.has(key)) {
      failedThumbnailsRef.current.add(key);
      setThumbnailRerender((n) => n + 1);
    }
  }, []);

  /* ── Save handler ───────────────────────────────────────────────────── */

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = useCallback(() => {
    if (!form.name?.trim()) return;

    if (isEdit && id) {
      updateMutation.mutate(
        { id, data: form },
        {
          onSuccess: () => {
            toast.success(t("voiceLive.instanceUpdated"));
            // Stay on page — user can now test with updated config
          },
        },
      );
    } else {
      createMutation.mutate(form, {
        onSuccess: (created) => {
          toast.success(t("voiceLive.instanceCreated"));
          // Navigate to edit URL so user can test the newly created instance
          navigate(`/admin/voice-live/${created.id}/edit`, { replace: true });
        },
      });
    }
  }, [form, isEdit, id, createMutation, updateMutation, navigate, t]);

  /* ── Loading state ──────────────────────────────────────────────────── */

  if (isEdit && isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-[380px] border-r p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-32 rounded" />
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-48 rounded" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="size-64 rounded-full" />
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* ════════════ LEFT PANEL — Configuration (~30%) ════════════ */}
      <div className="w-[380px] min-w-[340px] border-r flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate("/admin/voice-live")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold truncate">
              {isEdit
                ? t("voiceLive.vlDialogEditTitle")
                : t("voiceLive.vlDialogCreateTitle")}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              id="vl-enabled"
              checked={form.enabled ?? true}
              onCheckedChange={(v) => updateField("enabled", v)}
            />
            <Label htmlFor="vl-enabled" className="text-xs whitespace-nowrap">
              {t("voiceLive.instanceEnabled")}
            </Label>
          </div>
        </div>

        {/* Scrollable config area — disabled during active test session */}
        <div
          className={cn(
            "flex-1 overflow-y-auto px-4 py-4 space-y-5",
            isTestActive && "pointer-events-none opacity-50",
          )}
        >
          {/* Instance identity */}
          <div className="space-y-2">
            <Input
              value={form.name ?? ""}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder={t("voiceLive.instanceNamePlaceholder")}
              className="text-sm"
            />
          </div>

          <Separator />

          {/* ── Section 1: Generative AI Model ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tp("generativeModel")}
            </h3>
            <VoiceLiveModelSelect
              value={form.voice_live_model ?? "gpt-4o"}
              onValueChange={(v) => updateField("voice_live_model", v)}
            />

            {/* Response instruction */}
            <div className="space-y-1.5">
              <Label className="text-xs">{tp("responseInstruction")}</Label>
              <Textarea
                rows={3}
                className="text-sm resize-none"
                value={form.model_instruction ?? ""}
                onChange={(e) =>
                  updateField("model_instruction", e.target.value)
                }
                placeholder={tp("responseInstructionPlaceholder")}
              />
            </div>

            {/* Advanced: Response temperature + Proactive engagement */}
            <AdvancedToggle
              open={showResponseAdvanced}
              onToggle={() => setShowResponseAdvanced((v) => !v)}
              label={tp("advancedSettings")}
            />
            {showResponseAdvanced && (
              <div className="space-y-3 pl-1 border-l-2 border-muted ml-1.5">
                <div className="pl-3 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{tp("responseTemperature")}</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(form.response_temperature ?? 0.8).toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={2}
                      step={0.1}
                      value={[form.response_temperature ?? 0.8]}
                      onValueChange={([v]) => {
                        if (v !== undefined) updateField("response_temperature", v);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{tp("proactiveEngagement")}</Label>
                    <Switch
                      checked={form.proactive_engagement ?? true}
                      onCheckedChange={(v) => updateField("proactive_engagement", v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Section 2: Speech Input ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tp("speechInput")}
            </h3>

            {/* Language */}
            <div className="space-y-1.5">
              <Label className="text-xs">{tp("language")}</Label>
              <Select
                value={form.recognition_language ?? "auto"}
                onValueChange={(v) => updateField("recognition_language", v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECOGNITION_LANGUAGES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(`hcp.${opt.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-detect */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">{tp("autoDetectLanguage")}</Label>
              <Switch
                checked={form.auto_detect_language ?? true}
                onCheckedChange={(v) => updateField("auto_detect_language", v)}
              />
            </div>

            {/* Advanced: VAD, audio enhancement */}
            <AdvancedToggle
              open={showInputAdvanced}
              onToggle={() => setShowInputAdvanced((v) => !v)}
              label={tp("advancedSettings")}
            />
            {showInputAdvanced && (
              <div className="space-y-3 pl-1 border-l-2 border-muted ml-1.5">
                <div className="pl-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{tp("turnDetection")}</Label>
                    <Select
                      value={form.turn_detection_type ?? "server_vad"}
                      onValueChange={(v) => updateField("turn_detection_type", v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TURN_DETECTION_TYPES.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(`hcp.${opt.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{tp("noiseSuppression")}</Label>
                    <Switch
                      checked={form.noise_suppression ?? false}
                      onCheckedChange={(v) => updateField("noise_suppression", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{tp("echoCancellation")}</Label>
                    <Switch
                      checked={form.echo_cancellation ?? false}
                      onCheckedChange={(v) => updateField("echo_cancellation", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{tp("eouDetection")}</Label>
                    <Switch
                      checked={form.eou_detection ?? false}
                      onCheckedChange={(v) => updateField("eou_detection", v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Section 3: Speech Output ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tp("speechOutput")}
            </h3>

            {/* Voice selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">{tp("voice")}</Label>
              <Select
                value={form.voice_name ?? "en-US-AvaNeural"}
                onValueChange={(v) => updateField("voice_name", v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredVoiceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(`hcp.${opt.labelKey}`)}
                    </SelectItem>
                  ))}
                  {selectedVoiceFallback && (
                    <SelectItem
                      key={selectedVoiceFallback.value}
                      value={selectedVoiceFallback.value}
                    >
                      {t(`hcp.${selectedVoiceFallback.labelKey}`)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced: voice temp, playback speed, custom lexicon */}
            <AdvancedToggle
              open={showOutputAdvanced}
              onToggle={() => setShowOutputAdvanced((v) => !v)}
              label={tp("advancedSettings")}
            />
            {showOutputAdvanced && (
              <div className="space-y-3 pl-1 border-l-2 border-muted ml-1.5">
                <div className="pl-3 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{tp("voiceTemperature")}</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(form.voice_temperature ?? 0.9).toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={2}
                      step={0.1}
                      value={[form.voice_temperature ?? 0.9]}
                      onValueChange={([v]) => {
                        if (v !== undefined) updateField("voice_temperature", v);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{tp("playbackSpeed")}</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(form.playback_speed ?? 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <Slider
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={[form.playback_speed ?? 1.0]}
                      onValueChange={([v]) => {
                        if (v !== undefined) updateField("playback_speed", v);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{tp("customLexicon")}</Label>
                    <Switch
                      checked={form.custom_lexicon_enabled ?? false}
                      onCheckedChange={(v) => updateField("custom_lexicon_enabled", v)}
                    />
                  </div>
                  {form.custom_lexicon_enabled && (
                    <div className="space-y-1">
                      <Label className="text-xs">{tp("customLexiconUrl")}</Label>
                      <Input
                        className="text-xs h-8"
                        value={form.custom_lexicon_url ?? ""}
                        onChange={(e) => updateField("custom_lexicon_url", e.target.value)}
                        placeholder={tp("customLexiconUrlPlaceholder")}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Section 4: Avatar ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tp("avatar")}
            </h3>

            {/* Avatar enabled toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">{tp("enableAvatar")}</Label>
              <Switch
                checked={form.avatar_enabled ?? true}
                onCheckedChange={(v) => updateField("avatar_enabled", v)}
              />
            </div>

            {/* Avatar grid (only when enabled) */}
            {form.avatar_enabled && (
              <>
                {/* Filter tabs */}
                <div className="flex gap-1">
                  {(["all", "photo", "video"] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      size="sm"
                      variant={avatarFilter === filter ? "default" : "outline"}
                      className="h-6 text-[10px] px-2"
                      onClick={() => setAvatarFilter(filter)}
                    >
                      {t(
                        `voiceLive.vlDialogFilter${filter.charAt(0).toUpperCase() + filter.slice(1)}` as `voiceLive.vlDialogFilter${"All" | "Photo" | "Video"}`,
                      )}
                    </Button>
                  ))}
                </div>

                {/* Thumbnail grid */}
                <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                  {filteredAvatarItems.map((item) => {
                    const gridKey = item.isPhotoAvatar
                      ? item.characterId
                      : `${item.characterId}-${item.style}`;
                    const isSelected =
                      form.avatar_character === item.characterId &&
                      (item.isPhotoAvatar || form.avatar_style === item.style);
                    const imgFailed = failedThumbnailsRef.current.has(gridKey);

                    return (
                      <button
                        key={gridKey}
                        type="button"
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all hover:bg-accent/50 cursor-pointer",
                          isSelected && "ring-2 ring-primary border-primary",
                        )}
                        onClick={() => {
                          updateField("avatar_character", item.characterId);
                          updateField("avatar_style", item.style);
                        }}
                      >
                        {!imgFailed ? (
                          <div className="w-full aspect-[3/4] overflow-hidden rounded-md bg-muted/30">
                            <img
                              src={item.thumbnailUrl}
                              alt={item.displayName}
                              className="size-full object-contain"
                              onError={() => handleThumbnailError(gridKey)}
                            />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "w-full aspect-[3/4] rounded-md flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br",
                              item.gradientClasses,
                            )}
                          >
                            {getAvatarInitials(item.displayName)}
                          </div>
                        )}
                        <span className="text-[9px] leading-tight text-center truncate w-full">
                          {item.displayName}
                          {item.styleLabel ? ` (${item.styleLabel})` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom action bar — disabled during active test session */}
        <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={isSaving || !form.name?.trim() || isTestActive}
            onClick={handleSave}
          >
            {isSaving ? t("voiceLive.vlDialogSaving") : tp("applyChanges")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={isTestActive}
            onClick={handleReset}
          >
            {tp("reset")}
          </Button>
        </div>
      </div>

      {/* ════════════ RIGHT PANEL — Test Playground (~70%) ════════════ */}
      <div className="flex-1 flex flex-col">
        <VoiceTestPlayground
          vlInstanceId={id}
          systemPrompt={form.model_instruction ?? ""}
          language={form.recognition_language ?? "auto"}
          avatarCharacter={
            form.avatar_enabled ? (form.avatar_character ?? undefined) : undefined
          }
          avatarStyle={
            form.avatar_enabled ? (form.avatar_style ?? undefined) : undefined
          }
          avatarEnabled={form.avatar_enabled ?? false}
          hcpName={testHcp?.name ?? form.name ?? ""}
          disabled={!isEdit}
          disabledMessage={!isEdit ? tp("testPlaceholder") : undefined}
          onSessionStateChange={handleSessionStateChange}
          headerExtra={
            isEdit ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setAssignOpen(true)}
              >
                <Users className="size-3.5" />
                {tp("assignToHcp")}
                {assignedHcps.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({assignedHcps.length})
                  </span>
                )}
              </Button>
            ) : undefined
          }
          title={t("voiceLive.playgroundTitle")}
          className="flex-1"
        />
      </div>

      {/* ════════════ Assign to HCP Dialog ════════════ */}
      {id && (
        <AssignHcpDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          instanceId={id}
          instanceName={form.name ?? ""}
        />
      )}
    </div>
  );
}
