---
phase: 34-spanish-es-i18n
plan: 08
subsystem: api
tags: [fastapi, pydantic, i18next, admin, voice-map]

# Dependency graph
requires:
  - phase: 34-spanish-es-i18n
    plan: 06
    provides: "DEFAULT_PUBLIC_VOICE_BY_LOCALE constant (5-locale voice defaults) in voice_live_webrtc.py"
  - phase: 34-spanish-es-i18n
    plan: 02
    provides: "es-ES/es-MX/es-US admin.json namespace files (16 namespaces) to append voiceMap.* keys into"
provides:
  - "GET/PUT /api/v1/admin/public-knowledge-config/voice-map — admin-gated endpoints to read/write PublicKnowledgeConfig.voice_map (D-06)"
  - "PublicKnowledgeConfigVoiceMapOut/Update schemas with a 5-locale allowlist validator (unknown keys -> 422; empty-string values for known locales accepted per D-07)"
  - "admin.json voiceMap.title/helper/save/error keys across all 5 locales, ready for 34-09's UI"
affects:
  - "34-09 (admin voice_map Card UI — consumes this endpoint and these i18n keys)"
  - "34-10 (es-* voice E2E gate — LANG-02 closes only after that plan's gate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin singleton-config GET/PUT mirrors azure_config.py's require_role('admin')-gated pattern; reuses get_active_public_config(db) as the single source of the config row rather than a second query"

key-files:
  created:
    - backend/app/schemas/public_knowledge_config.py
    - backend/app/api/admin_public_knowledge_config.py
    - backend/tests/test_admin_public_knowledge_config.py
  modified:
    - backend/app/api/__init__.py
    - backend/app/main.py
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/es-ES/admin.json
    - frontend/public/locales/es-MX/admin.json
    - frontend/public/locales/es-US/admin.json

key-decisions:
  - "GET response bundles both the persisted voice_map override and DEFAULT_PUBLIC_VOICE_BY_LOCALE defaults in one payload so 34-09's UI can render defaults as placeholder text without a second request or duplicating the constant"
  - "PUT accepts an empty-string value for any known locale key without rejecting it (D-07: empty means 'fall back to built-in default at session time', not an invalid voice name) — validated by a dedicated test case"
  - "voiceMap.error wording is identical across es-ES/es-MX/es-US (no Iberian-vs-Latin-American divergence for this specific string), matching 34-06's precedent for REFUSAL_TEMPLATES es-* strings"

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-02
---

# Phase 34 Plan 08: Admin Voice-Map Backend API + i18n Keys Summary

**New admin-gated GET/PUT `/admin/public-knowledge-config/voice-map` endpoints backed by a 5-locale allowlist Pydantic validator, plus `voiceMap.*` i18n strings added to `admin.json` in all 5 locales — unblocking 34-09's frontend Card UI.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-02
- **Tasks:** 2
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments
- Built the admin voice_map API from scratch (confirmed by direct code inspection that no route, schema, or write path existed for this model before this plan) — mirrors `azure_config.py`'s singleton-config admin GET/PUT pattern exactly
- `PublicKnowledgeConfigVoiceMapOut`/`Update` schemas: `field_validator` rejects any locale key outside the closed 5-entry allowlist (`zh-CN`/`en-US`/`es-ES`/`es-MX`/`es-US`) with 422; empty-string values for known locales pass validation (D-07)
- GET returns the current admin override plus `DEFAULT_PUBLIC_VOICE_BY_LOCALE` (imported from 34-06's `voice_live_webrtc.py`, zero duplication) so the UI can show defaults as placeholders
- Both routes gated by `Depends(require_role("admin"))`; router registered in `app/api/__init__.py` and `app/main.py` alongside the other admin routers, under the standard `/api/v1` prefix
- 6 new integration tests covering: admin GET with defaults, non-admin 403 on GET, admin PUT persists (verified via subsequent GET), unknown-locale key 422, empty-string value accepted, non-admin 403 on PUT — all passing
- `voiceMap.title/helper/save/error` keys added to `admin.json` in all 5 locales; `locale-parity.test.ts` full suite (65 tests: key parity, no-empty-values, interpolation-placeholder consistency, untranslated-value detection) passes with the new keys included

## Task Commits

1. **Task 1: Create voice_map schemas + admin router (GET/PUT)** — `50ea9ae` (feat)
2. **Task 2: Add voiceMap.\* i18n keys to admin.json across all 5 locales** — `a224475` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `backend/app/schemas/public_knowledge_config.py` — `VOICE_MAP_LOCALES` allowlist, `PublicKnowledgeConfigVoiceMapOut`/`Update` schemas
- `backend/app/api/admin_public_knowledge_config.py` — GET/PUT `/admin/public-knowledge-config/voice-map` router
- `backend/app/api/__init__.py` — re-exports `admin_public_knowledge_config_router`
- `backend/app/main.py` — registers the new router under `settings.api_prefix`
- `backend/tests/test_admin_public_knowledge_config.py` — 6 integration tests (admin/non-admin, GET/PUT, allowlist rejection, empty-value acceptance)
- `frontend/public/locales/{zh-CN,en-US,es-ES,es-MX,es-US}/admin.json` — `voiceMap.title/helper/save/error` keys added

## Decisions Made
See `key-decisions` in frontmatter. No architectural deviations from the plan's literal interfaces block — the code matches the plan's proposed schema/router shape almost verbatim, confirmed against the actual import paths in `azure_config.py`/`admin_crm.py` before finalizing.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment was purely cosmetic: the initial module docstring in `public_knowledge_config.py` exceeded the 100-char Ruff line-length limit and was shortened to pass `ruff check .` (not a deviation from plan intent, just a lint-driven wording trim).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 34-09 (admin voice_map Card UI) can now call the real GET/PUT endpoint and consume the translated `voiceMap.*` strings across all 5 locales on day one.
- LANG-02 remains open per plan directive — it closes only after 34-10's E2E gate (real es-* voice verification). REQUIREMENTS.md was intentionally NOT updated for LANG-02 in this plan.

---
*Phase: 34-spanish-es-i18n*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 3 created files confirmed present on disk; both task commit hashes (`50ea9ae`, `a224475`) confirmed present in `git log`.
