import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { Button } from "@/components/ui";

const languages = [
  { code: "zh-CN", labelKey: "lang.zhCN", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "en-US", labelKey: "lang.enUS", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "es-ES", labelKey: "lang.esES", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "es-MX", labelKey: "lang.esMX", flag: "\u{1F1F2}\u{1F1FD}" },
  { code: "es-US", labelKey: "lang.esUS", flag: "\u{1F1FA}\u{1F1F8}" }, // same flag as en-US, intentional (D-09) -- disambiguated by label, not flag
] as const;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");

  const currentLang = languages.find((l) => l.code === i18n.language) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Switch language" className="gap-1.5 transition-colors duration-150">
          <span className="text-base leading-none">{currentLang.flag}</span>
          <span className="text-sm">{(currentLang.code.split("-")[0] ?? "").toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={
              i18n.language === lang.code ? "font-medium text-primary" : ""
            }
          >
            <span className="mr-2">{lang.flag}</span>
            {t(lang.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
