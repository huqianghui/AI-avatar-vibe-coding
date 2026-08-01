---
phase: 34-spanish-es-i18n
verified: 2026-08-02T04:35:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 34: Spanish (es) i18n Verification Report

**Phase Goal:** The platform fully supports Spanish across UI text and avatar voice, alongside existing zh-CN/en-US, shipped as three full locale variants (es-ES/es-MX/es-US).
**Verified:** 2026-08-02T04:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + CONTEXT decisions D-01..D-11)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: User can switch UI language to Spanish and see fully translated text with no missing-key fallback gaps, verified by automated key-parity check across zh-CN/en-US/es-ES/es-MX/es-US | ✓ VERIFIED | `npx vitest run src/i18n/locale-parity.test.ts` → 65/65 tests green (16 namespaces × 5 locales: key-set parity, non-empty values, interpolation-token parity, untranslated-value detection with capped 15-entry whitelist) |
| 2 | SC-2: User can select Spanish and hear the avatar respond using an es-* neural voice, mid-session switch may rebuild session (MVP) | ✓ VERIFIED | `DEFAULT_PUBLIC_VOICE_BY_LOCALE` in `voice_live_webrtc.py` maps es-ES→ElviraNeural, es-MX→DaliaNeural, es-US→PalomaNeural (D-06/D-07); `avatar-page.tsx` `useEffect([i18n.language])` still rebuilds the session on language change (D-11 unchanged); E2E `anonymous-avatar-voice-es.spec.ts` proves all 3 variants negotiate WebRTC session with correct locale + default voice |
| 3 | D-01: Three independent full locale variants (not one neutral Spanish) — UI/translation/voice all distinguished | ✓ VERIFIED | 3 distinct `public/locales/{es-ES,es-MX,es-US}/` dirs × 16 namespaces each (48 JSON files); 3 distinct default voices; 3 distinct REFUSAL_TEMPLATES keys; switcher shows 3 distinct labels (Español (España)/México/EE. UU.) |
| 4 | D-09: 5-option switcher in defined order with es-US sharing en-US flag by design | ✓ VERIFIED | `language-switcher.tsx` / `settings.tsx` both render 5 options zh-CN/en-US/es-ES/es-MX/es-US; es-US 🇺🇸 shared with en-US is an explicitly-commented, reviewed decision (REVIEW.md IN-05) |
| 5 | D-10: browser detection normalizes bare `es`/unlisted es-* to es-ES; supportedLngs config correct | ✓ VERIFIED | `frontend/src/i18n/index.test.ts` (9/9 green) asserts supportedLngs order and fallback behavior |
| 6 | D-06/D-08: voice_map admin-editable + REFUSAL_TEMPLATES cover all 5 locales | ✓ VERIFIED | `backend/tests/test_admin_public_knowledge_config.py` green (GET/PUT voice-map, role-gated); `avatar_service.py` REFUSAL_TEMPLATES has es-ES/es-MX/es-US entries; `settings.tsx` "Voice per Language" Card renders 5 rows wired to the endpoint |
| 7 | LANG-02 backend locale plumbing: WebrtcSessionRequest/ChatRequest accept es-* (no 422), fallback never masks to en-US-AvaNeural | ✓ VERIFIED | `public_avatar.py` schemas use `pattern="^(zh-CN\|en-US\|es-ES\|es-MX\|es-US)$"`; `test_public_webrtc_session.py`/`test_voice_live_webrtc.py` green (fallback + precedence tests) |
| 8 | Anonymous text-chat forwards active i18n locale (not hardcoded zh-CN) | ✓ VERIFIED | `use-anonymous-avatar-chat.ts` resolves `i18n.language` via `useTranslation()` and passes to `sendAnonymousChat`; `ChatRequest.locale` 5-entry allowlist in backend |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/i18n/locale-parity.test.ts` | Global 5-locale/16-namespace parity suite | ✓ VERIFIED | Exists, 65/65 tests pass, recursive fs.readdirSync-driven (not hardcoded namespace list) |
| `frontend/src/i18n/untranslated-whitelist.ts` | Capped whitelist for legitimate brand/SKU collisions | ✓ VERIFIED | 15/15 entries, guarded by a test assertion `length <= 15` |
| `frontend/public/locales/{es-ES,es-MX,es-US}/*.json` | 16 namespaces × 3 variants (48 files) | ✓ VERIFIED | `find frontend/public/locales -mindepth 2 -name '*.json'` confirms 5 locale dirs × 16 files each |
| `frontend/src/components/shared/language-switcher.tsx` | 5-option switcher | ✓ VERIFIED | Renders zh-CN/en-US/es-ES/es-MX/es-US with distinct labels; test file 7/7 green |
| `backend/app/services/voice_live_webrtc.py` (DEFAULT_PUBLIC_VOICE_BY_LOCALE) | Per-locale default voice fallback | ✓ VERIFIED | Dict with 5 keys, distinct es-* neural voices; used in fallback expression at line 294 |
| `backend/app/services/avatar_service.py` (REFUSAL_TEMPLATES) | 5-locale refusal templates | ✓ VERIFIED | es-ES/es-MX/es-US entries present, consumed by both anonymous and personalized paths |
| `backend/app/schemas/public_knowledge_config.py`, `backend/app/api/admin_public_knowledge_config.py` | Admin voice_map GET/PUT | ✓ VERIFIED | Role-gated endpoints exist, tested in `test_admin_public_knowledge_config.py`; value-format validation added post-review (WR-01, commit `5864c21`) |
| `frontend/src/pages/admin/settings.tsx` ("Voice per Language" Card) | 5-row admin voice_map editor | ✓ VERIFIED | 5 flag+label rows wired to `useVoiceMap()`/`useUpdateVoiceMap()`; one-time-seed guard applied post-review (WR-03, commit `eb2edbb`) |
| `frontend/e2e/language-switcher-es.spec.ts` | E2E: es-* switch renders translated UI | ✓ VERIFIED | 3/3 green (es-ES/es-MX/es-US) |
| `frontend/e2e/anonymous-avatar-voice-es.spec.ts` | E2E: es-* voice session negotiation (mocked) | ✓ VERIFIED | 3/3 green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `language-switcher.tsx` | `i18n.changeLanguage()` | onClick handler | WIRED | Confirmed by switcher test + E2E persistence assertion |
| `avatar-page.tsx` | `useAnonymousVoiceLive` / chat mutation | `i18n.language` prop, `useEffect([i18n.language])` | WIRED | Session rebuild on language change unchanged from Phase 32 (D-11); E2E proves locale reaches the WebRTC session payload |
| `use-anonymous-avatar-chat.ts` | `sendAnonymousChat` API client | `i18n.language` argument | WIRED | Traced end-to-end into `ChatRequest.locale` (backend schema, allowlisted) |
| `public_avatar.py` (session create) | `voice_live_webrtc.py` (`DEFAULT_PUBLIC_VOICE_BY_LOCALE`) | `locale=body.locale` param | WIRED | Explicit `voice_name` override wins; unconfigured locale falls back to that locale's own default (D-07), never silently to en-US |
| `settings.tsx` (Voice per Language Card) | `admin_public_knowledge_config.py` (GET/PUT voice-map) | `useVoiceMap()`/`useUpdateVoiceMap()` TanStack Query hooks | WIRED | Confirmed via hook + endpoint code inspection and passing admin test suite |
| `avatar_service.py` (REFUSAL_TEMPLATES) | anonymous + personalized chat handlers | `.get(locale, REFUSAL_TEMPLATES["zh-CN"])` | WIRED | `personalized_avatar_service.py` reuses the shared dict unchanged (confirmed in 34-06-SUMMARY) |

### Behavioral Spot-Checks (Automated Gates Run in Foreground)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 16×5 locale-parity suite | `cd frontend && npx vitest run src/i18n/locale-parity.test.ts` | 65/65 tests passed | ✓ PASS |
| i18n config + switcher unit tests | `cd frontend && npx vitest run src/i18n/index.test.ts src/components/shared/language-switcher.test.tsx` | 16/16 tests passed (9 + 7) | ✓ PASS |
| Backend locale/voice/refusal/admin-config unit+integration tests | `cd backend && pytest tests/test_public_webrtc_session.py tests/test_voice_live_webrtc.py tests/test_avatar_service.py tests/test_admin_public_knowledge_config.py -q` | 42 passed, 0 failed (the reported `--cov-fail-under=89` failure is an artifact of running a 4-file subset against the whole-repo coverage gate configured in `pyproject.toml`, not a test failure — no test in this run failed) | ✓ PASS |
| E2E: language switcher + voice session negotiation for all 3 es-* variants | `cd frontend && npm run test:e2e -- language-switcher-es.spec.ts anonymous-avatar-voice-es.spec.ts` | 8/8 passed (2 auth setup + 3 voice-es + 3 switcher-es) | ✓ PASS |
| Voice fallback distinctness spot-check | `grep DEFAULT_PUBLIC_VOICE_BY_LOCALE -A6 voice_live_webrtc.py` | es-ES-ElviraNeural / es-MX-DaliaNeural / es-US-PalomaNeural, 3 distinct values | ✓ PASS |
| Anonymous chat locale-forwarding spot-check | `grep i18n use-anonymous-avatar-chat.ts` | `i18n.language` passed to `sendAnonymousChat` (not hardcoded) | ✓ PASS |
| Admin settings 5-language config spot-check | `grep es-ES\|es-MX\|es-US settings.tsx` | 5-entry `VOICE_MAP_LOCALES`, 5 `<SelectItem>` for default language, "Voice per Language" Card with 5 rows | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| LANG-01 | 34-01, 34-02, 34-03, 34-04, 34-05 | UI 全量支持西班牙语，语言切换器含 es，含 key-parity 校验 | ✓ SATISFIED | 65/65 parity tests green; switcher 5 options; E2E `language-switcher-es.spec.ts` 3/3 green; REQUIREMENTS.md marks Complete — consistent with codebase |
| LANG-02 | 34-06, 34-07, 34-08, 34-09, 34-10 | 数字人可用西班牙语语音回答 (es-* neural voice) | ✓ SATISFIED | Distinct es-* default voices wired with locale-aware fallback (D-07); anonymous+personalized refusal templates cover es-*; anonymous chat forwards locale; admin voice_map editable; E2E `anonymous-avatar-voice-es.spec.ts` 3/3 green. REQUIREMENTS.md marks Complete, matching the roadmap's "Requirement gate status" narrative that documents the post-34-10 orchestrator triage (SplashScreen `h1` fix, stale health.spec fix) that closed the gate — consistent with the codebase (both fixes verified present: `splash-screen.tsx` uses `<p>` not `<h1>`, and the 34 residual full-suite E2E failures are pre-existing legacy-coach debt, not Phase-34-introduced) |

No orphaned requirements found for Phase 34 in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

None. Scanned all key files touched by 34-01..34-10 (schemas, admin API, settings.tsx, voice-map hook) for `TODO`/`FIXME`/`PLACEHOLDER`/empty-handler/hardcoded-empty-return patterns — no matches. The 3 code-review warnings raised in `REVIEW.md` (WR-01 unvalidated voice-name value, WR-02 unguarded `json.loads`, WR-03 unsaved-edit overwrite) were all confirmed fixed in dedicated follow-up commits (`5864c21`, `023b988`, `eb2edbb`), verified present in the current codebase during this verification pass.

### Human Verification Required

None required to reach a `passed` verdict for this phase's automated gates. One item remains explicitly Manual-Only per `34-VALIDATION.md` and is not a blocker:

1. **Real es-* Azure Voice Live audio quality/accent**
   **Test:** Open `/`, switch to es-ES/es-MX/es-US, ask a question, listen to the avatar's spoken response.
   **Expected:** Avatar speaks with the accent/register matching the selected variant (Elvira/Dalia/Paloma neural voices).
   **Why human:** Real WebRTC/Azure Voice Live connection is not available in this CI/sandbox environment; E2E coverage uses a mocked RTCPeerConnection/WebSocket transport, which proves correct locale/voice-name negotiation but cannot judge actual audio output quality.

### Gaps Summary

No gaps found. All 8 derived observable truths (roadmap's 2 success criteria plus the D-01/D-06/D-08/D-09/D-10/D-11 context decisions that operationalize them) verified directly against the codebase: 65/65 locale-parity tests, 16/16 i18n-config/switcher unit tests, 42/42 targeted backend tests (the `--cov-fail-under=89` message is a whole-repo coverage-gate artifact of running a 4-file subset, not a failing test), and 8/8 E2E tests (language-switcher-es + anonymous-avatar-voice-es) all pass in the foreground. Direct code inspection confirms three fully-distinguished es variants at the UI/translation/voice level (D-01), locale-aware voice fallback that never silently degrades to en-US (D-07), es-* refusal templates (D-08), and admin-editable voice_map wired end-to-end (D-06). All 3 code-review warnings were fixed in dedicated commits, verified present. The known 34 pre-existing legacy-coach full-suite E2E failures (documented in `deferred-items.md`, none touching any Phase 34 `files_modified` path) and the Manual-Only real-audio-quality check were treated as accepted context per the verification brief and do not affect this phase's verdict.

---

_Verified: 2026-08-02T04:35:00Z_
_Verifier: Claude (gsd-verifier)_
