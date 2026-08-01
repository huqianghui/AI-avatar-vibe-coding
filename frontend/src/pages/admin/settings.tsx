import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Shield, Palette, Languages } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateVoiceMap, useVoiceMap } from "@/hooks/use-voice-map";

/** Locale order for the 5-row Voice per Language card (matches the language switcher, D-09). */
const VOICE_MAP_LOCALES = ["zh-CN", "en-US", "es-ES", "es-MX", "es-US"] as const;

/** Flag emoji per locale -- mirrors language-switcher.tsx exactly (es-US shares en-US's flag by design, D-09). */
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

export default function AdminSettingsPage() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [defaultLanguage, setDefaultLanguage] = useState("zh-CN");
  const [retentionDays, setRetentionDays] = useState("90");
  const [darkMode, setDarkMode] = useState(false);
  const [orgName, setOrgName] = useState("BeiGene");

  const voiceMapQuery = useVoiceMap();
  const updateVoiceMapMutation = useUpdateVoiceMap();
  const [voiceMapValues, setVoiceMapValues] = useState<Record<string, string>>({});
  // WR-03: only seed local edit state from the query on the *first* successful
  // load. Without this guard, a background refetch (e.g. TanStack Query's
  // default refetchOnWindowFocus after staleTime elapses) would silently
  // overwrite any in-progress, unsaved admin edits.
  const hasInitializedVoiceMap = useRef(false);

  useEffect(() => {
    if (!hasInitializedVoiceMap.current && voiceMapQuery.data?.voice_map) {
      setVoiceMapValues(voiceMapQuery.data.voice_map);
      hasInitializedVoiceMap.current = true;
    }
  }, [voiceMapQuery.data]);

  const handleSaveVoiceMap = () => {
    updateVoiceMapMutation.mutate(
      { voice_map: voiceMapValues },
      { onError: () => toast.error(t("voiceMap.error")) },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.description")}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Language Settings */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Globe className="size-5 text-primary" />
              {t("settings.language")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("settings.defaultLanguage")}
              </Label>
              <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">{tc("lang.zhCN")}</SelectItem>
                  <SelectItem value="en-US">{tc("lang.enUS")}</SelectItem>
                  <SelectItem value="es-ES">{tc("lang.esES")}</SelectItem>
                  <SelectItem value="es-MX">{tc("lang.esMX")}</SelectItem>
                  <SelectItem value="es-US">{tc("lang.esUS")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Voice per Language (D-06) */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Languages className="size-5 text-primary" />
              {t("voiceMap.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {VOICE_MAP_LOCALES.map((locale) => (
              <div key={locale} className="flex items-center gap-3">
                <Label className="min-w-[180px]">
                  {FLAGS[locale]} {tc(`lang.${LOCALE_LABEL_KEY[locale]}`)}
                </Label>
                <Input
                  className="flex-1 min-w-0"
                  value={voiceMapValues[locale] ?? ""}
                  placeholder={voiceMapQuery.data?.defaults[locale] ?? ""}
                  onChange={(e) =>
                    setVoiceMapValues((prev) => ({ ...prev, [locale]: e.target.value }))
                  }
                />
              </div>
            ))}
            <p className="text-sm text-muted-foreground">{t("voiceMap.helper")}</p>
          </CardContent>
          <CardFooter>
            <Button disabled={updateVoiceMapMutation.isPending} onClick={handleSaveVoiceMap}>
              {updateVoiceMapMutation.isPending ? tc("saving") : t("voiceMap.save")}
            </Button>
          </CardFooter>
        </Card>

        {/* Data Retention */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Shield className="size-5 text-primary" />
              {t("settings.dataRetention")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("settings.voiceRetention")}
              </Label>
              <Input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-[240px]"
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.voiceRetentionHint")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Palette className="size-5 text-primary" />
              {t("settings.branding")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("settings.orgName")}
              </Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-[320px]"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              <Label className="text-sm">
                {t("settings.darkMode")}
              </Label>
            </div>
          </CardContent>
        </Card>

        <Button className="w-fit">
          {t("settings.save")}
        </Button>
      </div>
    </div>
  );
}
