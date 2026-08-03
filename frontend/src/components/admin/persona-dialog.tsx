import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useCreateAvatarPersona,
  useUpdateAvatarPersona,
} from "@/hooks/use-avatar-personas";
import type { AvatarPersona, AvatarPersonaCreate } from "@/api/avatar-personas";
import { AVATAR_CHARACTERS, getAvatarInitials } from "@/data/avatar-characters";
import { CDN_BASE, VOICE_NAME_OPTIONS } from "@/lib/voice-constants";
import { cn } from "@/lib/utils";

/* ── Constants ───────────────────────────────────────────────────────── */

const PERSONA_VOICE_LOCALES = ["zh-CN", "en-US", "es-ES", "es-MX", "es-US"] as const;

/** Flag emoji per locale -- mirrors settings.tsx's Voice per Language card. */
const FLAGS: Record<string, string> = {
  "zh-CN": "\u{1F1E8}\u{1F1F3}",
  "en-US": "\u{1F1FA}\u{1F1F8}",
  "es-ES": "\u{1F1EA}\u{1F1F8}",
  "es-MX": "\u{1F1F2}\u{1F1FD}",
  "es-US": "\u{1F1FA}\u{1F1F8}",
};

/** Maps locale code to its common.json `lang.*` sub-key. */
const LOCALE_LABEL_KEY: Record<string, string> = {
  "zh-CN": "zhCN",
  "en-US": "enUS",
  "es-ES": "esES",
  "es-MX": "esMX",
  "es-US": "esUS",
};

/** Sentinel value for the leading "(use default)" voice option. */
const USE_DEFAULT_VOICE = "__use_default__";

/* ── Types ───────────────────────────────────────────────────────────── */

interface PersonaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona?: AvatarPersona | null;
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

interface PersonaFormState {
  name: string;
  character: string;
  style: string;
  voiceMap: Record<string, string>;
  greetingMap: Record<string, string>;
  prompt_fragment: string;
  enabled: boolean;
  is_default: boolean;
}

function createDefaultPersonaForm(): PersonaFormState {
  return {
    name: "",
    character: "lisa",
    style: "casual-sitting",
    voiceMap: {},
    greetingMap: {},
    prompt_fragment: "",
    enabled: true,
    is_default: false,
  };
}

/* ── Component ───────────────────────────────────────────────────────── */

export function PersonaDialog({ open, onOpenChange, persona }: PersonaDialogProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const isEdit = !!persona;
  const createMutation = useCreateAvatarPersona();
  const updateMutation = useUpdateAvatarPersona();

  const [form, setForm] = useState<PersonaFormState>(createDefaultPersonaForm());
  const [avatarFilter, setAvatarFilter] = useState<"all" | "photo" | "video">("all");

  useEffect(() => {
    if (persona) {
      setForm({
        name: persona.name,
        character: persona.character,
        style: persona.style,
        voiceMap: { ...persona.voice_map },
        greetingMap: { ...persona.greeting_map },
        prompt_fragment: persona.prompt_fragment,
        enabled: persona.enabled,
        is_default: persona.is_default,
      });
    } else {
      setForm(createDefaultPersonaForm());
    }
    setAvatarFilter("all");
  }, [persona]);

  const updateField = useCallback(
    <K extends keyof PersonaFormState>(key: K, value: PersonaFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setVoiceForLocale = useCallback((locale: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev.voiceMap };
      if (value === USE_DEFAULT_VOICE) {
        delete next[locale];
      } else {
        next[locale] = value;
      }
      return { ...prev, voiceMap: next };
    });
  }, []);

  const setGreetingForLocale = useCallback((locale: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev.greetingMap };
      if (value.trim() === "") {
        delete next[locale];
      } else {
        next[locale] = value;
      }
      return { ...prev, greetingMap: next };
    });
  }, []);

  /* ── Avatar grid (cloned from vl-instance-dialog.tsx) ─────────────── */

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

  /* ── Save handler ──────────────────────────────────────────────── */

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleError = useCallback(
    (error: unknown) => {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 409) {
        toast.error(t("personas.defaultGuardError.title"), {
          description: t("personas.defaultGuardError.body"),
        });
      } else {
        toast.error(t("personas.saveError.title"), {
          description: t("personas.saveError.body"),
        });
      }
    },
    [t],
  );

  const handleSave = useCallback(() => {
    if (!form.name.trim()) return;

    const payload: AvatarPersonaCreate = {
      name: form.name.trim(),
      character: form.character,
      style: form.style,
      voice_map: form.voiceMap,
      greeting_map: form.greetingMap,
      prompt_fragment: form.prompt_fragment,
      enabled: form.enabled,
      is_default: form.is_default,
    };

    if (isEdit && persona) {
      updateMutation.mutate(
        { id: persona.id, data: payload },
        {
          onSuccess: () => onOpenChange(false),
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => onOpenChange(false),
        onError: handleError,
      });
    }
  }, [form, isEdit, persona, createMutation, updateMutation, onOpenChange, handleError]);

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("personas.editDialogTitle") : t("personas.createDialogTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Section 1: Identity ──────────────────────────────── */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="persona-name">{t("personas.nameLabel")}</Label>
              <Input
                id="persona-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder={t("personas.namePlaceholder")}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="persona-enabled" className="text-sm font-semibold">
                {t("personas.toggleEnabled")}
              </Label>
              <Switch
                id="persona-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => updateField("enabled", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="persona-default" className="text-sm font-semibold">
                {t("personas.toggleDefault")}
              </Label>
              {form.enabled ? (
                <Switch
                  id="persona-default"
                  checked={form.is_default}
                  onCheckedChange={(v) => updateField("is_default", v)}
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Switch id="persona-default" checked={false} disabled />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("personas.toggleDefaultDisabledTooltip")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* ── Section 2: Character & Style ─────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("personas.characterSectionTitle")}
            </h4>

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

            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
              {filteredAvatarItems.map((item) => {
                const gridKey = item.isPhotoAvatar
                  ? item.characterId
                  : `${item.characterId}-${item.style}`;
                const isSelected =
                  form.character === item.characterId &&
                  (item.isPhotoAvatar || form.style === item.style);
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
                      updateField("character", item.characterId);
                      updateField("style", item.style);
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

          {/* ── Section 3: Voice per Language ────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("personas.voiceSectionTitle")}
            </h4>
            {PERSONA_VOICE_LOCALES.map((locale) => (
              <div key={locale} className="flex items-center gap-3">
                <Label className="min-w-[140px] text-sm">
                  {FLAGS[locale]} {tc(`lang.${LOCALE_LABEL_KEY[locale]}`)}
                </Label>
                <Select
                  value={form.voiceMap[locale] ?? USE_DEFAULT_VOICE}
                  onValueChange={(v) => setVoiceForLocale(locale, v)}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={USE_DEFAULT_VOICE}>
                      {t("personas.useDefaultVoiceOption")}
                    </SelectItem>
                    {VOICE_NAME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(`hcp.${opt.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* ── Section 4: Greeting per Language ─────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("personas.greetingSectionTitle")}
            </h4>
            {PERSONA_VOICE_LOCALES.map((locale) => (
              <div key={locale} className="space-y-1">
                <Label className="text-sm">
                  {FLAGS[locale]} {tc(`lang.${LOCALE_LABEL_KEY[locale]}`)}
                </Label>
                <Textarea
                  id={`persona-greeting-${locale}`}
                  rows={2}
                  value={form.greetingMap[locale] ?? ""}
                  onChange={(e) => setGreetingForLocale(locale, e.target.value)}
                />
              </div>
            ))}
            <p className="text-sm text-muted-foreground">{t("personas.greetingHelper")}</p>
          </div>

          {/* ── Section 5: Persona Prompt Fragment ───────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="persona-prompt-fragment" className="text-sm font-semibold">
              {t("personas.promptFragmentLabel")}
            </Label>
            <Textarea
              id="persona-prompt-fragment"
              rows={3}
              value={form.prompt_fragment}
              onChange={(e) => updateField("prompt_fragment", e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {t("personas.promptFragmentHelper")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="button" disabled={isSaving || !form.name.trim()} onClick={handleSave}>
            {isSaving ? t("personas.saving") : t("personas.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
