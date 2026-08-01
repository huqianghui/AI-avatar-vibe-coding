---
phase: 34-spanish-es-i18n
reviewed: 2026-08-01T20:06:18Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - backend/app/schemas/public_avatar.py
  - backend/app/services/voice_live_webrtc.py
  - backend/app/api/public_avatar.py
  - backend/app/services/avatar_service.py
  - backend/app/schemas/public_knowledge_config.py
  - backend/app/api/admin_public_knowledge_config.py
  - backend/app/main.py
  - backend/app/api/__init__.py
  - backend/tests/test_admin_public_knowledge_config.py
  - backend/tests/test_avatar_service.py
  - backend/tests/test_public_avatar_api.py
  - backend/tests/test_public_webrtc_session.py
  - backend/tests/test_voice_live_webrtc.py
  - backend/tests/test_personalized_avatar_service.py
  - backend/tests/test_avatar_interaction_log.py
  - frontend/src/i18n/index.ts
  - frontend/src/i18n/locale-parity.test.ts
  - frontend/src/i18n/untranslated-whitelist.ts
  - frontend/src/components/shared/language-switcher.tsx
  - frontend/src/hooks/use-anonymous-avatar-chat.ts
  - frontend/src/hooks/use-anonymous-voice-live.ts
  - frontend/src/types/public-knowledge-config.ts
  - frontend/src/api/public-knowledge-config.ts
  - frontend/src/hooks/use-voice-map.ts
  - frontend/src/pages/admin/settings.tsx
  - frontend/src/components/shared/splash-screen.tsx
  - frontend/e2e/language-switcher-es.spec.ts
  - frontend/e2e/anonymous-avatar-voice-es.spec.ts
  - frontend/e2e/health.spec.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-08-01T20:06:18Z
**Depth:** standard
**Files Reviewed:** 24 (+ locale JSON/test files spot-checked)
**Status:** issues_found

## Summary

Phase 34 (LANG-01 Spanish UI i18n + LANG-02 es-* neural voice) is a clean, well-scoped, well-tested change set. The backend locale-widening changes (`ChatRequest.locale`, `WebrtcSessionRequest.locale`, `REFUSAL_TEMPLATES`, `DEFAULT_PUBLIC_VOICE_BY_LOCALE`) are minimal, additive, and covered by targeted unit/integration tests including precedence tests (explicit voice_name wins over locale default) and negative tests (unlisted locale → 422). The new admin `voice_map` GET/PUT endpoints correctly reuse the existing `require_role("admin")` JWT dependency (401/403 verified by tests) and Pydantic-validate the locale-key allowlist. No SQL/command injection, no hardcoded secrets, no `eval`/`innerHTML` usage, and no auth bypass were found in the reviewed diff.

Issues found are all Warning/Info severity — mostly robustness/defense-in-depth gaps (unvalidated voice-name value content, no malformed-JSON guard on `voice_map`, no explicit onSuccess/error UI feedback, a stale doc comment) rather than exploitable vulnerabilities or functional regressions. None of these block merge; they are worth a follow-up pass.

## Warnings

### WR-01: Admin `voice_map` PUT accepts arbitrary unvalidated string values

**Status:** Fixed in commit `5864c21`.

**File:** `backend/app/schemas/public_knowledge_config.py:15-30`
**Issue:** `PublicKnowledgeConfigVoiceMapUpdate.validate_locale_keys` only validates the dict *keys* against the 5-locale allowlist (`VOICE_MAP_LOCALES`). The *values* (the Azure neural voice name string, e.g. `"es-ES-ElviraNeural"`) have no format, length, or allowlist validation — any string (including empty, multi-megabyte, or garbage text) is accepted and persisted verbatim into `PublicKnowledgeConfig.voice_map` (a `Text` column with no `String(N)` cap). This value later flows unmodified into the `session.update` payload sent to Azure Voice Live over the signaling WebSocket (`frontend/src/hooks/use-anonymous-voice-live.ts` `session.session_config`), so a bad value doesn't get validated until Azure rejects the session at connect time — degrading anonymous voice sessions for all visitors of that locale with no earlier feedback.

The endpoint is admin-only (`require_role("admin")`), so this is not exploitable by an unauthenticated attacker; it's a data-integrity / fail-fast gap, not a security vulnerability.

**Fix:**
```python
import re

AZURE_VOICE_NAME_RE = re.compile(r"^$|^[a-zA-Z]{2}-[a-zA-Z]{2}-[A-Za-z0-9]+Neural$")

@field_validator("voice_map")
@classmethod
def validate_locale_keys(cls, value: dict[str, str]) -> dict[str, str]:
    unknown = set(value.keys()) - VOICE_MAP_LOCALES
    if unknown:
        raise ValueError(f"Unknown locale key(s): {sorted(unknown)}")
    for locale, voice in value.items():
        if not AZURE_VOICE_NAME_RE.match(voice):
            raise ValueError(f"Invalid voice name for {locale}: {voice!r}")
    return value
```

---

### WR-02: `json.loads(config.voice_map or "{}")` has no exception handling in 3 call sites

**Status:** Fixed in commit `023b988`.

**File:** `backend/app/api/admin_public_knowledge_config.py:27,45`; `backend/app/api/public_avatar.py:82`
**Issue:** All three reads of `PublicKnowledgeConfig.voice_map` call `json.loads(...)` with no `try/except`. In normal operation this is safe because the only writer (`update_voice_map`) always calls `json.dumps` on a Pydantic-validated dict, so the column should always contain valid JSON. However, the column is a bare `Text` field editable directly via DB tooling/migrations/seed scripts (no DB-level JSON constraint), and a malformed value there would surface as an unhandled `JSONDecodeError` → uncaught 500 on every GET/PUT-voice-map and every anonymous WebRTC session request (`/public/avatar/webrtc/session`) — a wider blast radius than the admin surface alone, since the public anonymous voice path is also gated on this same parse.

**Fix:** Wrap with a defensive fallback, e.g.:
```python
try:
    voice_map = json.loads(config.voice_map or "{}")
except (json.JSONDecodeError, TypeError):
    logger.warning("Malformed voice_map JSON on PublicKnowledgeConfig %s; using {}", config.id)
    voice_map = {}
```

---

### WR-03: `settings.tsx` Voice-per-Language form can silently lose unsaved edits on background refetch

**Status:** Fixed in commit `eb2edbb`.

**File:** `frontend/src/pages/admin/settings.tsx:52-56`
**Issue:**
```tsx
useEffect(() => {
  if (voiceMapQuery.data?.voice_map) {
    setVoiceMapValues(voiceMapQuery.data.voice_map);
  }
}, [voiceMapQuery.data]);
```
This effect re-syncs local form state from the query's `data` on *every* change to `voiceMapQuery.data`, not just the initial load. The global `QueryClient` (`frontend/src/App.tsx`) sets `staleTime: 5 * 60 * 1000` with default `refetchOnWindowFocus: true`; if an admin leaves the Settings tab open, edits some voice-name fields, then tabs away and back after the 5-minute staleTime window has elapsed (a realistic scenario for a slow-typing admin), TanStack Query will silently background-refetch and this effect will overwrite the in-progress, unsaved edits with the server's last-saved values — with no warning to the user.

**Fix:** Only seed from the query once (e.g. guard with a `hasInitialized` ref, or use `initialData`/`select` with a one-time flag), or disable `refetchOnWindowFocus` for this specific query:
```tsx
const voiceMapQuery = useVoiceMap(); // in use-voice-map.ts: useQuery({ ..., refetchOnWindowFocus: false })
```

## Info

### IN-01: Stale doc comment understates the locale allowlist

**File:** `frontend/src/hooks/use-anonymous-voice-live.ts:27`
**Issue:** `/** Locale for voice selection; must match the backend's WebrtcSessionRequest.locale pattern ("zh-CN" | "en-US"). */` — this comment predates Phase 34 and was not updated when the backend pattern was widened to 5 locales (`^(zh-CN|en-US|es-ES|es-MX|es-US)$`, see `backend/app/schemas/public_avatar.py:54`). Not a functional bug (the hook itself doesn't enforce the pattern client-side), but misleading for future maintainers reading this file in isolation.
**Fix:** Update the comment to list all 5 supported locale codes.

### IN-02: No success feedback after saving the Voice per Language form

**File:** `frontend/src/pages/admin/settings.tsx:58-63`
**Issue:** `handleSaveVoiceMap` wires `onError` (toast error) but no `onSuccess` callback — a successful save gives the admin no confirmation beyond the button returning to its default label. Contrast with the pattern elsewhere in the same file (e.g. other Settings cards) and with typical UX expectations for a "Save" action. Test suite (`settings.test.tsx`) correspondingly only covers the error-toast path, not a success-toast path — confirming this is an intentional-but-incomplete implementation rather than an untested regression.
**Fix:** Add `onSuccess: () => toast.success(t("voiceMap.saved"))` (with a matching i18n key across all 5 locales).

### IN-03: `useVoiceMap()` query has no error-state UI

**File:** `frontend/src/pages/admin/settings.tsx:48-56`, `frontend/src/hooks/use-voice-map.ts:7-12`
**Issue:** If `GET /admin/public-knowledge-config/voice-map` 404s (no active `PublicKnowledgeConfig` row — a real possibility on a fresh deployment per `get_active_public_config`'s fail-closed design) or otherwise errors, `voiceMapQuery.isLoading`/`isError` are never read in the component. The card silently renders with empty inputs and empty placeholders, giving the admin no indication that voice-map data failed to load versus "there is simply no config yet."
**Fix:** Render a loading/error state, e.g. `{voiceMapQuery.isError && <p className="text-sm text-danger-600">{t("voiceMap.loadError")}</p>}`.

### IN-04: `PersonalizedChatRequest.locale` still has no pattern validation (pre-existing, not introduced by Phase 34, flagged for consistency)

**File:** `backend/app/schemas/personalized_avatar.py:29`
**Issue:** Unlike the two schemas Phase 34 *did* touch (`ChatRequest.locale`, `WebrtcSessionRequest.locale` — both now `pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$"`), the personalized (authenticated) chat path's `locale: str = "zh-CN"` field has no `Field(pattern=...)` constraint at all — any string is accepted and passed to `REFUSAL_TEMPLATES.get(locale, REFUSAL_TEMPLATES["zh-CN"])`, which degrades gracefully (safe default), so this is not exploitable, just an inconsistency. This file was not in Phase 34's `files_modified` list and predates the phase, so it's out of scope for this review's severity classification — noted for awareness/consistency only, in case a future phase tightens this.
**Fix (future):** Apply the same `pattern="^(zh-CN|en-US|es-ES|es-MX|es-US)$"` constraint to `PersonalizedChatRequest.locale` for consistency with the anonymous-path schemas.

### IN-05: `es-US` shares the `en-US` flag emoji by design — confirm this is intentional, not a copy-paste oversight

**File:** `frontend/src/components/shared/language-switcher.tsx:15`; `frontend/src/pages/admin/settings.tsx:28`
**Issue:** Both files use 🇺🇸 for both `en-US` and `es-US`. This is explicitly called out as intentional in an inline comment ("same flag as en-US, intentional (D-09) -- disambiguated by label, not flag") and is consistent across both files and the E2E fixture data, so this is **not** a bug — flagging only as a design decision worth a second pair of eyes given it's an unusual UI choice (most language switchers use a distinct flag or no flag for a language variant sharing a country). No action required if D-09 was a deliberate, reviewed UX decision.

### IN-06: Locale-parity `untranslated-whitelist.ts` is at its self-imposed cap (15/15)

**File:** `frontend/src/i18n/untranslated-whitelist.ts:13-47`
**Issue:** The whitelist guardrail test (`locale-parity.test.ts:81-85`) asserts `UNTRANSLATED_WHITELIST.length <= 15`, and the list currently contains exactly 15 entries. This isn't a bug today, but any future PR that needs to add one more legitimately-untranslated key (e.g. a new brand name or SKU code) will immediately fail this guardrail test and require either genuinely translating something that shouldn't be translated, or bumping the cap. Flagging so the next contributor isn't surprised.
**Fix:** No action needed now; consider bumping the cap slightly (e.g. to 20) preemptively, or leave as-is if the team wants to force a re-review at every addition (which appears to be the intent, per the comment `"If this grows past ~15 entries, stop and re-review"`).

---

_Reviewed: 2026-08-01T20:06:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
