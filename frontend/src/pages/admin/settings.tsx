import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Shield, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminSettingsPage() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [defaultLanguage, setDefaultLanguage] = useState("zh-CN");
  const [retentionDays, setRetentionDays] = useState("90");
  const [darkMode, setDarkMode] = useState(false);
  const [orgName, setOrgName] = useState("BeiGene");

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
