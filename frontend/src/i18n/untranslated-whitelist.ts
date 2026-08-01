/**
 * Untranslated-value whitelist (D-03, Pitfall 6 guardrail -- 34-RESEARCH.md).
 *
 * Entries are "{namespace}.{dotted.key.path}" strings for leaf values that
 * are LEGITIMATELY identical across en-US and all 3 es-* locales (brand
 * names, proper nouns, or -- per UI-SPEC's Copywriting Contract -- the
 * `common.lang.*` switcher identity labels, which are fixed native-language
 * self-names never translated per viewer locale). Scope entries to
 * individual leaf keys, never a whole namespace. If this grows past ~15
 * entries, stop and re-review for skipped translations rather than adding
 * more.
 */
export const UNTRANSLATED_WHITELIST: readonly string[] = [
  // Switcher identity labels (UI-SPEC Copywriting Contract): fixed
  // native-language self-names, identical in every locale's common.json.
  "common.lang.zhCN",
  "common.lang.enUS",
  "common.lang.esES",
  "common.lang.esMX",
  "common.lang.esUS",
  // Brand/product names, unchanged across locales (D-03).
  "common.appName",
  "common.poweredBy",
  // admin.json (34-02): bare AI model version codes with no translatable
  // content (pure alphanumeric SKU identifiers -- "GPT-4o", "GPT-4.1",
  // "GPT-5" carry no generic English word to localize, unlike sibling
  // entries such as modelGptRealtime/modelGpt5Chat/modelGpt5Mini which were
  // genuinely translated instead of whitelisted).
  "admin.hcp.modelGpt4o",
  "admin.hcp.modelGpt41",
  "admin.hcp.modelGpt5",
  // admin.json (34-02): "HCP" is this platform's own domain abbreviation
  // (Healthcare Professional), used as a bare table-column header here;
  // kept as the established untranslated term used throughout the app.
  "admin.scenarios.table.hcp",
  // admin.json (34-02): bare Azure/Microsoft product names with zero
  // translatable surrounding words (unlike list items such as
  // azureConfig.services.openai which gained a translated parenthetical
  // descriptor to legitimately differ from en-US).
  "admin.azureConfig.aiFoundry.title",
  "admin.voiceLive.name",
  "admin.voiceLive.nav",
];
