---
phase: 34-spanish-es-i18n
plan: 01
subsystem: i18n
tags: [i18next, react-i18next, vitest, locale-parity, translation]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a
    provides: avatar page i18n.language-driven session rebuild pattern (D-11 reused unchanged)
provides:
  - 5-locale supportedLngs (en-US, zh-CN, es-ES, es-MX, es-US) with D-10 prefix-match ordering
  - Global recursive locale-parity vitest suite (key set, empty-value, interpolation-token, untranslated-value checks) enumerating namespaces via fs.readdirSync
  - untranslated-whitelist.ts contract consumed by all later namespace-translation plans (34-02..04)
  - 5-option language switcher (zh-CN/en-US/es-ES/es-MX/es-US)
  - Fully translated common.json in es-ES/es-MX/es-US (51 top-level keys, formal usted register)
affects: [34-02, 34-03, 34-04, 35-clean-avatar-ui-legacy-coach-hiding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global namespace-agnostic locale-parity test (fs.readdirSync-driven, not a hardcoded namespace array) as the shared verification contract for all namespace-translation plans in this phase"
    - "namespace.key string entries in a small, capped (<=15) untranslated-value whitelist for legitimately-identical brand-name/identity-label leaf values"

key-files:
  created:
    - frontend/src/i18n/locale-parity.test.ts
    - frontend/src/i18n/untranslated-whitelist.ts
    - frontend/public/locales/es-ES/common.json
    - frontend/public/locales/es-MX/common.json
    - frontend/public/locales/es-US/common.json
  modified:
    - frontend/src/i18n/index.ts
    - frontend/src/i18n/index.test.ts
    - frontend/src/components/shared/language-switcher.tsx
    - frontend/src/components/shared/language-switcher.test.tsx
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/zh-CN/common.json

key-decisions:
  - "supportedLngs ordered [en-US, zh-CN, es-ES, es-MX, es-US] with es-ES before es-MX/es-US to satisfy D-10's prefix-match resolution for bare 'es'/unlisted es-* variants, per RESEARCH.md verified i18next source behavior"
  - "Added common.appName and common.poweredBy to UNTRANSLATED_WHITELIST as legitimate brand-name exemptions discovered while translating common.json (Task 3's 'add to whitelist' instruction), bringing the whitelist to 7 of its <=15 soft cap"
  - "locale-parity.test.ts enumerates namespaces via fs.readdirSync on the en-US directory (not a hardcoded array) so future namespace additions are automatically covered without editing the test"

requirements-completed: [LANG-01]

# Metrics
duration: 4min
completed: 2026-08-02
---

# Phase 34 Plan 01: i18n Foundation (5-Locale Config, Switcher, Parity Test, common.json) Summary

**Widened i18next to 5 locales with D-10-safe ordering, extended the language switcher to 5 options, and shipped a fs.readdirSync-driven global key-parity test plus a capped untranslated-value whitelist that every later namespace-translation plan in this phase will be checked against.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-01T23:59:45+08:00
- **Completed:** 2026-08-02T00:03:44+08:00
- **Tasks:** 3
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments
- `supportedLngs` now lists all 5 locales in the D-10-required order, with a dedicated unit test asserting the ordering invariant (not just the exact array)
- New global `locale-parity.test.ts` — the single verification contract (key parity, non-empty values, interpolation-token parity, untranslated-value detection) that plans 34-02/03/04 will run scoped to their own namespace
- `untranslated-whitelist.ts` created with the 5 `lang.*` identity-label exemptions plus 2 brand-name exemptions (`appName`, `poweredBy`) discovered during translation, well under the 15-entry soft guardrail
- Language switcher renders and wires all 5 options (es-US intentionally shares en-US's flag per D-09, disambiguated by label only)
- `common.json` fully translated into es-ES (Iberian vocabulary), es-MX and es-US (Latin-American vocabulary), all in the formal `usted` register per D-02 — verified byte-for-byte key-set parity against en-US

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen i18n supportedLngs to 5 locales (D-10)** - `24a5087` (feat)
2. **Task 2: Create locale-parity test + untranslated-whitelist (D-04/D-05, Wave 0)** - `1e81604` (test)
3. **Task 3: Extend language switcher to 5 options + translate common.json (D-01/D-02/D-09)** - `db5efdb` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `frontend/src/i18n/index.ts` — `supportedLngs` widened to 5 entries with a load-bearing ordering comment
- `frontend/src/i18n/index.test.ts` — updated exact-array assertion + new ordering-invariant test
- `frontend/src/i18n/locale-parity.test.ts` — new global parity suite, namespace list derived from disk, not hardcoded
- `frontend/src/i18n/untranslated-whitelist.ts` — new whitelist export, 7 entries
- `frontend/src/components/shared/language-switcher.tsx` — `languages` array extended to 5 entries
- `frontend/src/components/shared/language-switcher.test.tsx` — 3 new click/render assertions for es-ES/es-MX/es-US
- `frontend/public/locales/es-ES/common.json` — new, 51 keys, Iberian vocabulary
- `frontend/public/locales/es-MX/common.json` — new, 51 keys, Latin-American vocabulary
- `frontend/public/locales/es-US/common.json` — new, 51 keys, Latin-American vocabulary
- `frontend/public/locales/en-US/common.json` — `lang.*` extended from 2 to 5 entries
- `frontend/public/locales/zh-CN/common.json` — `lang.*` extended from 2 to 5 entries

## Decisions Made
- Followed RESEARCH.md's verified-safe `supportedLngs` ordering exactly (es-ES before es-MX/es-US) — no custom `convertDetectedLanguage` or object-form `fallbackLng` needed
- Added `common.appName`/`common.poweredBy` to the whitelist rather than force-translating brand names, per Task 3's explicit instruction to route legitimately-identical values through the whitelist instead of leaving them silently untranslated
- Kept es-MX and es-US textually near-identical to each other (both Latin-American register) since D-02 only requires es-ES to diverge from the other two; the parity test only checks es-* vs en-US divergence, not es-* vs es-* divergence

## Deviations from Plan

None — plan executed exactly as written. The RED state of `locale-parity.test.ts` for the 15 non-`common` namespaces after Task 2's commit, and its transition to GREEN for `common` after Task 3, is the plan's own explicitly documented expected behavior (see Task 2's `<action>` note), not a deviation.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Plans 34-02/03/04 (namespace translation batches) can now run `npx vitest run src/i18n/locale-parity.test.ts -t "<namespace>"` as their scoped automated verify once they add es-* files for their assigned namespaces
- The full `locale-parity.test.ts` run (no `-t` filter) will remain partially RED — by design — until all 16 namespaces have es-* translations across plans 34-02 through 34-04; this is not a regression to fix in this plan
- `common.json`'s 5-entry `lang.*` block and the 5-option switcher are ready for LANG-02 voice-path plans (34-05+) to reference without further i18n-config changes

---
*Phase: 34-spanish-es-i18n*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 12 created/modified files verified present on disk; all 3 task commit hashes (24a5087, 1e81604, db5efdb) verified present in git history.
