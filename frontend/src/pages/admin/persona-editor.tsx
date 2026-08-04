import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentFoundationModelSelect } from "@/components/admin/agent-foundation-model-select";
import {
  useAvatarPersona,
  useCreateAvatarPersona,
  useUpdateAvatarPersona,
} from "@/hooks/use-avatar-personas";
import { AvatarView } from "@/components/voice/avatar-view";
import { AVATAR_CHARACTERS, getAvatarInitials } from "@/data/avatar-characters";
import { CDN_BASE, VOICE_NAME_OPTIONS } from "@/lib/voice-constants";
import { cn } from "@/lib/utils";
import type { AvatarPersonaCreate } from "@/api/avatar-personas";

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

const DEFAULT_LOCALE: (typeof PERSONA_VOICE_LOCALES)[number] = "en-US";

type AvatarGridItem = {
  characterId: string;
  displayName: string;
  style: string;
  styleLabel: string;
  isPhotoAvatar: boolean;
  thumbnailUrl: string;
  gradientClasses: string;
};

interface PersonaEditorFormState {
  name: string;
  character: string;
  style: string;
  voiceMap: Record<string, string>;
  greetingMap: Record<string, string>;
  prompt_fragment: string;
  enabled: boolean;
  is_default: boolean;
}

function createDefaultPersonaForm(): PersonaEditorFormState {
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

/* ── Page Component ───────────────────────────────────────────────────── */

export default function PersonaEditorPage() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const te = useCallback((key: string) => t(`personas.editor.${key}`), [t]);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  /* ── Data hooks ─────────────────────────────────────────────────────── */

  const { data: persona, isLoading } = useAvatarPersona(id);
  const createMutation = useCreateAvatarPersona();
  const updateMutation = useUpdateAvatarPersona();

  /* ── Form state ────────────────────────────────────────────────────── */

  const [form, setForm] = useState<PersonaEditorFormState>(createDefaultPersonaForm());
  const [avatarFilter, setAvatarFilter] = useState<"all" | "photo" | "video">("all");
  const [activeLocale, setActiveLocale] =
    useState<(typeof PERSONA_VOICE_LOCALES)[number]>(DEFAULT_LOCALE);
  const formInitializedRef = useRef(false);
  // Model Deployment selector -- mirrors the HCP profile editor's D-14
  // pattern: informational only, not yet persisted to any backend field
  // (AvatarPersona has no model-deployment column, same limitation as
  // HcpProfile today). See personas.editor.modelDeploymentNote.
  const [foundationModel, setFoundationModel] = useState("");

  // Populate form ONCE when persona first loads.
  useEffect(() => {
    if (persona && !formInitializedRef.current) {
      formInitializedRef.current = true;
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
    }
  }, [persona]);

  const updateField = useCallback(
    <K extends keyof PersonaEditorFormState>(key: K, value: PersonaEditorFormState[K]) => {
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

  const handleReset = useCallback(() => {
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
  }, [persona]);

  /* ── Avatar grid ───────────────────────────────────────────────────── */

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

  /* ── Resolved greeting preview (client-side mirror of the backend's
   * 3-tier fallback chain in avatar_persona_service.resolve_greeting_for_locale) ── */

  const resolvedGreeting = useMemo(() => {
    if (form.greetingMap[activeLocale]) return form.greetingMap[activeLocale];
    const firstConfigured = Object.values(form.greetingMap)[0];
    if (firstConfigured) return firstConfigured;
    return te("previewGreetingFallback");
  }, [form.greetingMap, activeLocale, te]);

  const configuredLocales = useMemo(
    () => PERSONA_VOICE_LOCALES.filter((l) => form.voiceMap[l] || form.greetingMap[l]),
    [form.voiceMap, form.greetingMap],
  );

  /* ── Save handler ──────────────────────────────────────────────────── */

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

    if (isEdit && id) {
      updateMutation.mutate(
        { id, data: payload },
        {
          onSuccess: () => {
            toast.success(te("saved"));
          },
          onError: handleError,
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          toast.success(te("created"));
          navigate(`/admin/avatar-personas/${created.id}/edit`, { replace: true });
        },
        onError: handleError,
      });
    }
  }, [form, isEdit, id, createMutation, updateMutation, navigate, te, handleError]);

  /* ── Loading state ─────────────────────────────────────────────────── */

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

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* ════════════ LEFT PANEL — Configuration ════════════ */}
      <div className="w-[380px] min-w-[340px] border-r flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={te("backAriaLabel")}
            onClick={() => navigate("/admin/avatar-personas")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold truncate">
              {isEdit ? t("personas.editDialogTitle") : t("personas.createDialogTitle")}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              id="persona-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => updateField("enabled", v)}
            />
            <Label htmlFor="persona-enabled" className="text-xs whitespace-nowrap">
              {t("personas.toggleEnabled")}
            </Label>
          </div>
        </div>

        {/* Scrollable config area -- Card-per-section, mirroring the HCP
         * profile editor's AgentConfigLeftPanel layout (hcp-profile-editor.tsx
         * "语音和数字人" tab). Section 1 there is a "VL Instance Summary" card;
         * personas have no voice-live-instance concept, so that card is
         * replaced here by the actual voice-mode config (Character & Avatar +
         * Speech), per explicit design direction. */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 1. Identity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("hcp.identity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder={t("personas.namePlaceholder")}
                className="text-sm"
              />
              <div className="flex items-center justify-between">
                <Label htmlFor="persona-default" className="text-xs">
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
            </CardContent>
          </Card>

          {/* 2. Character & Avatar -- replaces the HCP page's "VL Instance
           * Summary" card with the actual voice-mode avatar picker. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("personas.characterSectionTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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

              <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
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
                        "flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all hover:bg-accent/50 cursor-pointer",
                        isSelected && "ring-2 ring-primary border-primary",
                      )}
                      onClick={() => {
                        updateField("character", item.characterId);
                        updateField("style", item.style);
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
            </CardContent>
          </Card>

          {/* 3. Speech (language-scoped voice + greeting) -- the other half
           * of the voice-mode config replacing the VL Instance Summary card. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {te("speechSectionTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Language selector — picks which locale's voice/greeting is being edited */}
              <div className="space-y-1.5">
                <Label className="text-xs">{te("languageLabel")}</Label>
                <Select
                  value={activeLocale}
                  onValueChange={(v) =>
                    setActiveLocale(v as (typeof PERSONA_VOICE_LOCALES)[number])
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONA_VOICE_LOCALES.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {FLAGS[locale]} {tc(`lang.${LOCALE_LABEL_KEY[locale]}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice for the active locale */}
              <div className="space-y-1.5">
                <Label className="text-xs">{te("voiceLabel")}</Label>
                <Select
                  value={form.voiceMap[activeLocale] ?? USE_DEFAULT_VOICE}
                  onValueChange={(v) => setVoiceForLocale(activeLocale, v)}
                >
                  <SelectTrigger className="h-9 text-sm">
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

              {/* Greeting for the active locale */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("personas.greetingLabel")}</Label>
                <Textarea
                  id="persona-editor-greeting"
                  rows={2}
                  className="text-sm resize-none"
                  value={form.greetingMap[activeLocale] ?? ""}
                  onChange={(e) => setGreetingForLocale(activeLocale, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("personas.greetingHelper")}</p>
              </div>

              {/* Which locales already have overrides configured */}
              {configuredLocales.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {te("configuredLocalesLabel")}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {configuredLocales.map((locale) => (
                      <Badge
                        key={locale}
                        variant={locale === activeLocale ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {FLAGS[locale]} {tc(`lang.${LOCALE_LABEL_KEY[locale]}`)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Model Deployment -- mirrors AgentConfigLeftPanel's "模型部署"
           * card (D-14: informational only, not persisted anywhere for HCP
           * profiles either; AvatarPersona has no equivalent backend field). */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("hcp.modelDeployment")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <AgentFoundationModelSelect
                value={foundationModel}
                onValueChange={setFoundationModel}
              />
              <p className="text-[10px] text-muted-foreground">
                {te("modelDeploymentNote")}
              </p>
            </CardContent>
          </Card>

          {/* 5. Instructions (persona prompt fragment) -- mirrors the HCP
           * page's "自定义指令" override field. The HCP page's "自动生成指令"
           * half is omitted: it calls previewInstructions() to generate text
           * from HCP-only profile fields (personality_type, specialty,
           * expertise_areas, etc.) that AvatarPersona does not have, so there
           * is nothing to auto-generate from. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {t("personas.promptFragmentLabel")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Textarea
                id="persona-editor-prompt-fragment"
                rows={3}
                className="text-sm resize-none"
                value={form.prompt_fragment}
                onChange={(e) => updateField("prompt_fragment", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("personas.promptFragmentHelper")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bottom action bar */}
        <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={isSaving || !form.name.trim()}
            onClick={handleSave}
          >
            {isSaving ? t("personas.saving") : t("personas.save")}
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            {te("reset")}
          </Button>
        </div>
      </div>

      {/* ════════════ RIGHT PANEL — Static Preview ════════════ */}
      <div className="flex-1 flex flex-col p-4">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">{te("previewTitle")}</CardTitle>
            {/* Mirrors the HCP page's "工作台" Start button. Disabled here:
             * a live interactive test session requires either an assigned
             * Voice Live instance or a Foundry agent (see
             * playground-preview-panel.tsx), and AvatarPersona has neither
             * concept today -- this is a genuine backend gap, not something
             * to fake. See personas.editor.noLiveTestNote. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled className="gap-1.5">
                    <Play className="size-3.5" />
                    {t("hcp.playgroundStart")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{te("noLiveTestNote")}</TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-3">
            <div className="flex-1 relative min-h-[360px] rounded-lg overflow-hidden">
              <AvatarView
                videoRef={{ current: null }}
                isAvatarConnected={false}
                isSessionActive={false}
                audioState="idle"
                isConnecting={false}
                hcpName={form.name}
                isFullScreen={false}
                avatarCharacter={form.character}
                avatarStyle={form.style}
                className="absolute inset-0"
              />
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {te("previewGreetingLabel")}
              </p>
              <p className="text-sm">{resolvedGreeting}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
