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
];
