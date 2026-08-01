import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en-US",
    // Order is load-bearing for D-10: i18next's prefix-match fallback resolves
    // a bare "es" or an unlisted es-* variant (e.g. es-AR) to the FIRST es-*
    // entry below, so es-ES MUST precede es-MX and es-US. en-US/zh-CN keep
    // their existing relative order (unrelated prefixes, no ambiguity).
    supportedLngs: ["en-US", "zh-CN", "es-ES", "es-MX", "es-US"],
    defaultNS: "common",
    ns: ["common", "auth", "nav", "dashboard", "training", "coach", "admin", "scoring", "analytics", "conference", "skill", "voice", "meta-skill", "session", "prompts", "avatar"],
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
