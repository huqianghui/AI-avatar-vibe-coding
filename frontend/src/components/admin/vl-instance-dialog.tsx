import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VoiceLiveModelSelect } from "@/components/admin/voice-live-model-select";
import {
  useCreateVoiceLiveInstance,
  useUpdateVoiceLiveInstance,
} from "@/hooks/use-voice-live-instances";
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
import type {
  VoiceLiveInstance,
  VoiceLiveInstanceCreate,
} from "@/types/voice-live";

/* ── Types ───────────────────────────────────────────────────────────── */

interface VlInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance?: VoiceLiveInstance | null;
}

type AvatarGridItem = {
  characterId: string;
  displayName: string;
  style: string;
  styleLabel: string;
  isPhotoAvatar: boolean;
  thumbnailUrl: string;
  gradientClasses: string;
};

/* ── Component ───────────────────────────────────────────────────────── */

export function VlInstanceDialog({
  open,
  onOpenChange,
  instance,
}: VlInstanceDialogProps) {
  const { t } = useTranslation("admin");
  const isEdit = !!instance;
  const createMutation = useCreateVoiceLiveInstance();
  const updateMutation = useUpdateVoiceLiveInstance();

  const [form, setForm] = useState<VoiceLiveInstanceCreate>(createDefaultVlInstanceForm());
  const [avatarFilter, setAvatarFilter] = useState<"all" | "photo" | "video">("all");

  // Reset form when instance prop changes
  useEffect(() => {
    if (instance) {
      setForm({
        name: instance.name,
        description: instance.description ?? "",
        voice_live_model: instance.voice_live_model,
        enabled: instance.enabled,
        voice_name: instance.voice_name,
        voice_type: instance.voice_type,
        voice_temperature: instance.voice_temperature,
        voice_custom: instance.voice_custom,
        avatar_character: instance.avatar_character,
        avatar_style: instance.avatar_style,
        avatar_customized: instance.avatar_customized,
        turn_detection_type: instance.turn_detection_type,
        noise_suppression: instance.noise_suppression,
        echo_cancellation: instance.echo_cancellation,
        eou_detection: instance.eou_detection,
        recognition_language: instance.recognition_language,
        model_instruction: instance.model_instruction ?? "",
      });
    } else {
      setForm(createDefaultVlInstanceForm());
    }
    setAvatarFilter("all");
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

  /* ── Avatar grid ────────────────────────────────────────────────── */

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

  /** Track which thumbnails failed to load so we show initials fallback. */
  const failedThumbnailsRef = useRef(new Set<string>());
  const [, setThumbnailRerender] = useState(0);
  const handleThumbnailError = useCallback((key: string) => {
    if (!failedThumbnailsRef.current.has(key)) {
      failedThumbnailsRef.current.add(key);
      setThumbnailRerender((n) => n + 1);
    }
  }, []);

  /* ── Save handler ──────────────────────────────────────────────── */

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = useCallback(() => {
    if (!form.name?.trim()) return;

    if (isEdit && instance) {
      updateMutation.mutate(
        { id: instance.id, data: form },
        {
          onSuccess: () => {
            toast.success(t("voiceLive.instanceUpdated"));
            onOpenChange(false);
          },
        },
      );
    } else {
      createMutation.mutate(form, {
        onSuccess: () => {
          toast.success(t("voiceLive.instanceCreated"));
          onOpenChange(false);
        },
      });
    }
  }, [form, isEdit, instance, createMutation, updateMutation, onOpenChange, t]);

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("voiceLive.vlDialogEditTitle")
              : t("voiceLive.vlDialogCreateTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("voiceLive.editInstance")
              : t("voiceLive.createInstance")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Section 1: Identity ──────────────────────────────── */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="vl-name">{t("voiceLive.instanceName")}</Label>
              <Input
                id="vl-name"
                value={form.name ?? ""}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder={t("voiceLive.instanceNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vl-desc">
                {t("voiceLive.instanceDescription")}
              </Label>
              <Textarea
                id="vl-desc"
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder={t("voiceLive.instanceDescriptionPlaceholder")}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="vl-enabled">
                {t("voiceLive.instanceEnabled")}
              </Label>
              <Switch
                id="vl-enabled"
                checked={form.enabled ?? true}
                onCheckedChange={(v) => updateField("enabled", v)}
              />
            </div>
          </div>

          {/* ── Section 2: Model ─────────────────────────────────── */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              {t("voiceLive.vlDialogModelSection")}
            </h4>
            <VoiceLiveModelSelect
              value={form.voice_live_model ?? "gpt-4o"}
              onValueChange={(v) => updateField("voice_live_model", v)}
            />
          </div>

          {/* ── Section 3: Voice ─────────────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("voiceLive.vlDialogVoiceSection")}
            </h4>
            <div className="space-y-1.5">
              <Label>{t("hcp.voiceName")}</Label>
              <Select
                value={form.voice_name ?? "en-US-AvaNeural"}
                onValueChange={(v) => updateField("voice_name", v)}
              >
                <SelectTrigger className="h-8 text-xs">
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t("hcp.temperature")}</Label>
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
          </div>

          {/* ── Section 4: Avatar ────────────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("voiceLive.vlDialogAvatarSection")}
            </h4>

            {/* Filter tabs */}
            <div className="flex gap-1">
              {(["all", "photo", "video"] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={avatarFilter === filter ? "default" : "outline"}
                  className="h-7 text-xs px-3"
                  onClick={() => setAvatarFilter(filter)}
                >
                  {t(
                    `voiceLive.vlDialogFilter${filter.charAt(0).toUpperCase() + filter.slice(1)}` as `voiceLive.vlDialogFilter${"All" | "Photo" | "Video"}`,
                  )}
                </Button>
              ))}
            </div>

            {/* Avatar grid */}
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
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
                      "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all hover:bg-accent/50 cursor-pointer",
                      isSelected && "ring-2 ring-primary border-primary",
                    )}
                    onClick={() => {
                      updateField("avatar_character", item.characterId);
                      updateField("avatar_style", item.style);
                    }}
                  >
                    {!imgFailed ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.displayName}
                        className="h-14 w-14 rounded-full object-cover"
                        onError={() => handleThumbnailError(gridKey)}
                      />
                    ) : (
                      <div
                        className={cn(
                          "h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br",
                          item.gradientClasses,
                        )}
                      >
                        {getAvatarInitials(item.displayName)}
                      </div>
                    )}
                    <span className="text-[10px] leading-tight text-center truncate w-full">
                      {item.displayName}
                      {item.styleLabel ? ` (${item.styleLabel})` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Section 5: Conversation ──────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("voiceLive.vlDialogConversationSection")}
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("hcp.turnDetection")}</Label>
                <Select
                  value={form.turn_detection_type ?? "server_vad"}
                  onValueChange={(v) => updateField("turn_detection_type", v)}
                >
                  <SelectTrigger className="h-8 text-xs">
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
              <div className="space-y-1.5">
                <Label>{t("hcp.recognitionLanguage")}</Label>
                <Select
                  value={form.recognition_language ?? "auto"}
                  onValueChange={(v) => updateField("recognition_language", v)}
                >
                  <SelectTrigger className="h-8 text-xs">
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
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="vl-noise"
                  checked={form.noise_suppression ?? false}
                  onCheckedChange={(v) => updateField("noise_suppression", v)}
                />
                <Label htmlFor="vl-noise" className="text-xs">
                  {t("hcp.noiseSuppression")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="vl-echo"
                  checked={form.echo_cancellation ?? false}
                  onCheckedChange={(v) => updateField("echo_cancellation", v)}
                />
                <Label htmlFor="vl-echo" className="text-xs">
                  {t("hcp.echoCancellation")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="vl-eou"
                  checked={form.eou_detection ?? false}
                  onCheckedChange={(v) => updateField("eou_detection", v)}
                />
                <Label htmlFor="vl-eou" className="text-xs">
                  {t("hcp.eouDetection")}
                </Label>
              </div>
            </div>
          </div>

          {/* ── Section 6: Agent Instructions ────────────────────── */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              {t("voiceLive.vlDialogAgentSection")}
            </h4>
            <Textarea
              rows={3}
              value={form.model_instruction ?? ""}
              onChange={(e) =>
                updateField("model_instruction", e.target.value)
              }
              placeholder={t("voiceLive.vlDialogAgentInstructionsHint")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("voiceLive.vlDialogCancel")}
          </Button>
          <Button
            type="button"
            disabled={isSaving || !form.name?.trim()}
            onClick={handleSave}
          >
            {isSaving
              ? t("voiceLive.vlDialogSaving")
              : t("voiceLive.vlDialogSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
