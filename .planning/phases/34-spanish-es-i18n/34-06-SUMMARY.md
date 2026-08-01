---
phase: 34-spanish-es-i18n
plan: 06
subsystem: backend-voice
tags: [pydantic, locale-validation, azure-voice-live, webrtc, refusal-templates, fallback]

# Dependency graph
requires:
  - phase: 34-spanish-es-i18n
    plan: 05
    provides: "LANG-01 fully closed (parity suite + switcher E2E green, committed and pushed) — per-requirement sequencing gate satisfied before any LANG-02 work"
provides:
  - "WebrtcSessionRequest.locale accepts es-ES/es-MX/es-US (closed 5-entry allowlist, fr-FR still 422s)"
  - "DEFAULT_PUBLIC_VOICE_BY_LOCALE constant in voice_live_webrtc.py — unconfigured voice_map locales fall back to that locale's own default neural voice (es-ES-ElviraNeural / es-MX-DaliaNeural / es-US-PalomaNeural), never en-US-AvaNeural (D-07)"
  - "REFUSAL_TEMPLATES covers all 5 locales (D-08); shared dict automatically serves both anonymous and personalized refusal paths"
affects:
  - "34-07 (anonymous chat locale forwarding), 34-08/34-09 (admin voice_map), 34-10 (es-* voice E2E)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locale-aware fallback via module-level dict constant + `voice_name or DICT.get(locale, DICT['zh-CN'])` — explicit voice_map override always wins over the locale default"

key-files:
  created: []
  modified:
    - backend/app/schemas/public_avatar.py
    - backend/app/api/public_avatar.py
    - backend/app/services/voice_live_webrtc.py
    - backend/app/services/avatar_service.py
    - backend/tests/test_public_webrtc_session.py
    - backend/tests/test_voice_live_webrtc.py
    - backend/tests/test_avatar_service.py
    - backend/tests/test_personalized_avatar_service.py

key-decisions:
  - "create_public_webrtc_session_config gained a `locale: str = 'zh-CN'` keyword param; the single production call site in public_avatar.py passes `locale=body.locale` so the default never masks a real locale in production paths"
  - "The 3 es-* REFUSAL_TEMPLATES strings are intentionally identical — 'sitio web oficial' has no Iberian-vs-Latin-American divergence for this sentence (per plan directive: linguistically correct, not a copy-paste shortcut)"
  - "personalized_avatar_service.py required zero code changes — it already imports and reuses the shared REFUSAL_TEMPLATES dict; only its test file gained an es-* refusal-path case"

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-08-02
---

# Phase 34 Plan 06: Backend es-* Locale Validation, Voice Fallback, Refusal Templates Summary

**Unblocked the LANG-02 voice pipeline's schema/fallback layer: widened `WebrtcSessionRequest.locale` to a 5-entry closed allowlist, added the `DEFAULT_PUBLIC_VOICE_BY_LOCALE` locale-aware fallback (never en-US-AvaNeural for es-* sessions), and completed `REFUSAL_TEMPLATES` for all 5 locales.**

## Performance

- **Duration:** ~15 min (task work) + full-suite verification
- **Completed:** 2026-08-02
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `WebrtcSessionRequest.locale` pattern widened to `^(zh-CN|en-US|es-ES|es-MX|es-US)$` — es-* session requests no longer 422; `fr-FR` still rejected (T-34-07 mitigated)
- `DEFAULT_PUBLIC_VOICE_BY_LOCALE` (5 entries) wired into `create_public_webrtc_session_config` via new `locale` param; production call site in `public_avatar.py` passes `locale=body.locale` (T-34-08 mitigated — a valid non-empty neural voice name is always sent)
- Explicit non-empty `voice_name` (voice_map override) still wins over the locale fallback, verified by test
- `REFUSAL_TEMPLATES` extended to 5 locales; anonymous (`handle_anonymous_turn`) and personalized refusal paths verified to return the exact es-* string per locale
- Plan-scoped tests: `test_public_webrtc_session.py` + `test_voice_live_webrtc.py` + `test_avatar_service.py` + `test_personalized_avatar_service.py` — **38 passed, 0 failures**
- Full backend suite: **2811 passed, 15 skipped**, coverage 90.07% (≥89% gate); the single failure (`test_agent_sync_service.py::TestRealAgentSyncOperations::test_three_profiles_mixed_create_and_update`) is a pre-existing timing flake unrelated to this plan — it passes in isolation on rerun
- `ruff check .` + `ruff format --check .` clean (one pre-existing format drift in `tests/test_avatar_interaction_log.py` from phase 32 reformatted in the docs commit)

## Task Commits

1. **Task 1: Widen locale validation + locale-aware default-voice fallback** — `8fe4a56` (feat)
2. **Task 2: es-ES/es-MX/es-US REFUSAL_TEMPLATES entries (D-08)** — `6c4ec24` (feat)

**Plan metadata:** (this commit)

## Next Steps

- 34-07 (wave 5): forward the active i18n locale from the anonymous text-chat frontend into the backend request
- 34-08/34-09 (waves 5-6): admin voice_map API + UI
- LANG-02 remains open — closes only after 34-10's E2E gate
