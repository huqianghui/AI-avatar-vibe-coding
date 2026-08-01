---
phase: 32-anonymous-grounded-avatar-q-a
reviewed: 2026-08-01T08:12:06Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - backend/alembic/versions/b35a_add_anonymous_avatar_tables.py
  - backend/app/api/__init__.py
  - backend/app/api/public_avatar.py
  - backend/app/config.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/models/__init__.py
  - backend/app/models/anonymous_avatar_session.py
  - backend/app/models/avatar_interaction_log.py
  - backend/app/models/public_knowledge_config.py
  - backend/app/schemas/public_avatar.py
  - backend/app/services/anonymous_session_service.py
  - backend/app/services/avatar_search_service.py
  - backend/app/services/avatar_service.py
  - backend/app/services/public_knowledge_config_service.py
  - backend/app/services/rate_limit.py
  - backend/app/services/voice_live_webrtc.py
  - backend/app/utils/exceptions.py
  - backend/pyproject.toml
  - backend/scripts/verify_knowledge_source_fields.py
  - backend/tests/test_avatar_interaction_log.py
  - backend/tests/test_avatar_models.py
  - backend/tests/test_avatar_search_service.py
  - backend/tests/test_avatar_service.py
  - backend/tests/test_public_avatar_api.py
  - backend/tests/test_public_webrtc_session.py
  - backend/tests/test_rate_limiting.py
  - frontend/e2e/anonymous-avatar-qa.spec.ts
  - frontend/e2e/anonymous-avatar-voice.spec.ts
  - frontend/public/locales/en-US/avatar.json
  - frontend/public/locales/zh-CN/avatar.json
  - frontend/src/api/public-avatar.ts
  - frontend/src/components/avatar/avatar-input-bar.tsx
  - frontend/src/components/avatar/mic-permission-dialog.tsx
  - frontend/src/components/avatar/sources-panel.test.tsx
  - frontend/src/components/avatar/sources-panel.tsx
  - frontend/src/hooks/use-anonymous-avatar-chat.test.ts
  - frontend/src/hooks/use-anonymous-avatar-chat.ts
  - frontend/src/hooks/use-anonymous-avatar-session.test.ts
  - frontend/src/hooks/use-anonymous-avatar-session.ts
  - frontend/src/hooks/use-anonymous-voice-live.test.ts
  - frontend/src/hooks/use-anonymous-voice-live.ts
  - frontend/src/i18n/index.ts
  - frontend/src/pages/avatar-page.test.tsx
  - frontend/src/pages/avatar-page.tsx
  - frontend/src/router/index.tsx
  - frontend/vite.config.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-08-01T08:12:06Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Phase 32's anonymous grounded avatar Q&A implementation is well-structured and its trust-boundary/security design decisions are clearly documented in module docstrings, and heavily test-covered (dual-key rate limiting, DB-authoritative session expiry, strict full-field citation gating, exactly-one-audit-row-per-turn). No injection, hardcoded-secret, or auth-bypass vulnerabilities were found: the anonymous surface never accepts a client-suppliable `agent_id`/`kb_name`/character override, the anonymous fetch client (`public-avatar.ts`) structurally avoids the JWT-bearer axios singleton, and `get_anonymous_session` runs (and can 401) before any Azure credential call.

The issues found are all Warning/Info level: a refusal-message locale that never reflects the visitor's actual UI language, a per-IP rate-limit key that will likely collapse to one shared bucket behind a reverse proxy in the deployed topology, an audit "touch" helper that is fully tested but never wired into any real request path, unvalidated citation URL schemes on both the write path (backend) and render path (frontend), and a missing fail-closed guard on the anonymous WebRTC path analogous to the authenticated D-08 gate. None of these are exploitable to leak the JWT-authenticated surface or bypass the anonymous rate limiter's basic per-key mechanics (which the dedicated `test_rate_limiting.py` suite proves correct in isolation).

## Warnings

### WR-01: Refusal message is always Chinese regardless of the visitor's UI locale

**File:** `backend/app/services/avatar_service.py:39-45` (see also `backend/app/api/public_avatar.py:62` and `backend/app/schemas/public_avatar.py:19-26`)
**Issue:** `handle_anonymous_turn(db, session, message, public_config, locale="zh-CN")` defaults `locale` to `"zh-CN"`, and the `chat` route handler (`public_avatar.py:62`) never passes a `locale` argument: `result = await handle_anonymous_turn(db, session, body.message, public_config)`. `ChatRequest` (`schemas/public_avatar.py`) has no `locale` field at all. This means every refusal answer — the fixed template shown when zero grounded citations are found — is hard-locked to the Chinese string in `REFUSAL_TEMPLATES["zh-CN"]` no matter what language the frontend UI (`i18n.language`, already `en-US` or `zh-CN` per `avatar-page.tsx`) is running in. This violates the project's mandatory multi-language avatar-output requirement (CLAUDE.md AI Avatar Domain Rule #5: "Multi-language support is mandatory across UI, voice, and avatar output for Chinese, English, and Spanish"). It is also inconsistent with the WebRTC path, which *does* thread a `locale` field (`WebrtcSessionRequest.locale`) all the way through to voice selection.
**Fix:** Add an optional `locale` field to `ChatRequest` (a UI-language selector is not a client-controllable security parameter like `agent_id`/`kb_name` — it doesn't affect which agent/KB is used, only which fixed string is shown), and thread it through:
```python
# schemas/public_avatar.py
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    locale: str = Field(default="zh-CN", pattern="^(zh-CN|en-US)$")

# api/public_avatar.py
result = await handle_anonymous_turn(db, session, body.message, public_config, locale=body.locale)
```
And have the frontend pass `i18n.language` in `sendAnonymousChat`/`useAnonymousAvatarChat` the same way `fetchAnonymousWebrtcSession` already does.

### WR-02: Per-IP rate-limit key likely collapses to one shared bucket behind the deployed reverse proxy

**File:** `backend/app/services/rate_limit.py:36-43` (also affects `backend/app/api/public_avatar.py`'s three `@limiter_ip.limit(...)` call sites)
**Issue:** `limiter_ip`/`get_anon_session_key`'s IP fallback both ultimately resolve through slowapi's `get_remote_address`, which reads `request.client.host` only — it does **not** consult `X-Forwarded-For`/`Forwarded`. The project's own architecture puts the FastAPI backend behind Azure Container Apps' ingress (and nginx for the frontend container), and grep across `backend/` found no `--proxy-headers`/`ProxyHeadersMiddleware`/`X-Forwarded-For` handling anywhere in the ASGI startup path. In that topology `request.client.host` is the proxy's own connection IP for *every* visitor, so the "dual-key (IP + session)" defense collapses to a single shared IP bucket in production: one abusive visitor can exhaust `anon_rate_limit_session_create`/`anon_rate_limit_chat_ip`/`anon_rate_limit_webrtc_ip` for *all* other anonymous visitors behind the same ingress (a self-inflicted DoS on the IP-keyed half of the dual-key design). This directly weakens the "rate limiting correctness" property this phase is meant to guarantee — the session-keyed half (`limiter_session`) still works correctly since it reads a per-visitor header, but the IP-keyed half degrades to a global limit.
**Fix:** Either run uvicorn with `--forwarded-allow-ips` + Starlette/uvicorn's `ProxyHeadersMiddleware` (trusting only the known Azure ingress hop) and switch `limiter_ip`'s key func to slowapi's `get_ipaddr` (which does read `X-Forwarded-For`), or confirm/document that Azure Container Apps' ingress already rewrites `request.client.host` to the real client IP before reaching the container (some ingress controllers do) — and add a regression test asserting that behavior end-to-end rather than only the in-process `test_rate_limiting.py` unit proof (which never exercises a real proxy hop).

### WR-03: `touch_session()` is fully tested but never called from any real request path

**File:** `backend/app/services/anonymous_session_service.py:72-82`
**Issue:** `touch_session` is described as the "sliding activity marker for audit/abuse-detection purposes" and has dedicated unit test coverage (`test_public_avatar_api.py::TestTouchSession`), but a repo-wide search shows it is only ever called directly from that test file — never from `get_anonymous_session`, `handle_anonymous_turn`, or any router in `public_avatar.py`. As a result, `AnonymousAvatarSession.request_count` stays `0` and `last_activity_at` stays frozen at session-creation time for every real anonymous visitor, for the lifetime of the session. This silently defeats the abuse-detection purpose the docstring claims and is effectively dead code in the production request path (though the DB column itself is exercised, the increment logic is not).
**Fix:** Call `await touch_session(db, session)` from `get_anonymous_session` (or from `handle_anonymous_turn`/`webrtc_session` after a successful auth check) on every authenticated anonymous request, or remove the function/rows if this data is intentionally deferred to a later phase — but don't leave a tested-but-unwired function whose docstring claims a guarantee that doesn't hold in production.

### WR-04: Citation URLs are accepted/rendered with no scheme allowlist (`javascript:` URI risk if the index is ever poisoned)

**File:** `backend/app/services/avatar_search_service.py:52-58`, `frontend/src/components/avatar/sources-panel.tsx:62-76`
**Issue:** `retrieve_citations()`'s full-field gate only checks that `title`, `url`, and `page` are truthy (`if title and url and page:`) — it never validates that `url` is an `http(s)://` URL. The value flows unmodified into `SourcesPanel`, which renders it directly as `<a href={citation.url} target="_blank" rel="noopener noreferrer">`. `rel="noopener noreferrer"` mitigates reverse-tabnabbing but does **not** block a `javascript:`/`data:` URI from executing on click. Since `url`/`title` originate from the Foundry IQ/AI Search index's `sourceData` (admin-managed content, but content that could originate from crawled/ingested documents), a compromised or mis-ingested source document that ends up with a crafted `url` field would produce a click-to-execute XSS in the anonymous, unauthenticated surface — the exact kind of "citation-URL-injection" the file's own docstring says it mitigates, but the mitigation covers only tab-nabbing, not scheme injection.
**Fix:** Add a scheme allowlist at the strictest point (backend, so the frontend never sees a bad URL at all):
```python
from urllib.parse import urlparse

def _is_safe_citation_url(url: str) -> bool:
    return urlparse(url).scheme in ("http", "https")

...
if title and url and page and _is_safe_citation_url(url):
    citations.append({"title": title, "url": url, "page": page})
```
Optionally add a defense-in-depth check in `sources-panel.tsx` as well.

### WR-05: Anonymous WebRTC path has no fail-closed guard for an empty/misconfigured `agent_id` (unlike the authenticated D-08 gate)

**File:** `backend/app/services/voice_live_webrtc.py:233-309`, `backend/app/api/public_avatar.py:66-85`
**Issue:** `create_webrtc_session_config` (the authenticated path) has an explicit D-08 guard: it raises `AGENT_SYNC_REQUIRED` (409) *before* building any signaling URL or exchanging a bearer token if `profile.agent_id` is empty/unsynced. `create_public_webrtc_session_config` (the anonymous path added by this phase) has no equivalent check: it unconditionally builds `wss://.../voice-live/realtime/calls?...&agent_id={agent_id}&...` and exchanges a real Azure bearer token even when `agent_id` is `""` (the `PublicKnowledgeConfig.agent_id` column's own default value, per `models/public_knowledge_config.py:16`). An admin who activates a `PublicKnowledgeConfig` row before filling in `agent_id` would silently ship anonymous visitors a broken/garbage signaling URL (and burn a real STS bearer-token exchange call) instead of getting a clear, fail-closed 409 the way the authenticated path does.
**Fix:** Mirror the authenticated gate:
```python
if not agent_id:
    raise AppException(
        status_code=409,
        code="PUBLIC_AGENT_MISSING",
        message="Public knowledge config has no agent_id configured",
    )
```
placed before the STS bearer-token exchange in `create_public_webrtc_session_config`.

## Info

### IN-01: Spanish is not supported anywhere in the anonymous avatar path despite being a mandated language

**File:** `backend/app/services/avatar_service.py:31-36` (`REFUSAL_TEMPLATES`), `backend/app/schemas/public_avatar.py:51` (`WebrtcSessionRequest.locale` pattern `^(zh-CN|en-US)$`), `frontend/src/i18n/index.ts:12` (`supportedLngs: ["en-US", "zh-CN"]`)
**Issue:** CLAUDE.md's AI Avatar Domain Rule #5 and the top-level constraints both mandate Chinese + English + **Spanish** support across UI, voice, and avatar output. None of the Phase 32 anonymous surfaces (refusal templates, WebRTC locale validation, i18n `supportedLngs`) include any Spanish variant. This may be an intentional, tracked scope reduction for this specific phase, but it's worth confirming that's a deliberate decision rather than an oversight, since it's a hardcoded pattern (`^(zh-CN|en-US)$`) that will reject a Spanish locale outright with a 422 rather than degrading gracefully.
**Fix:** If Spanish is deferred to a later phase, note that explicitly in the phase's scope docs; otherwise extend `REFUSAL_TEMPLATES`, the `WebrtcSessionRequest.locale` pattern, and `i18n/index.ts`'s `supportedLngs` together.

### IN-02: Malformed admin-authored `voice_map` JSON causes an unhandled 500 instead of a structured error

**File:** `backend/app/api/public_avatar.py:80`
**Issue:** `voice_map = json.loads(public_config.voice_map or "{}")` has no `try`/`except`. `PublicKnowledgeConfig.voice_map` is admin-managed (per the model's docstring), so this is a low-likelihood path, but a malformed value would raise an uncaught `json.JSONDecodeError`, surfacing only as a generic `INTERNAL_ERROR` 500 via `main.py`'s catch-all handler rather than a clear, structured `CONFLICT`/`VALIDATION_ERROR` pointing at the misconfigured row.
**Fix:**
```python
try:
    voice_map = json.loads(public_config.voice_map or "{}")
except json.JSONDecodeError:
    raise AppException(409, "PUBLIC_CONFIG_INVALID", "voice_map is not valid JSON") from None
```

### IN-03: Anonymous WebRTC ephemeral bearer token is appended to the signaling URL as a plain query parameter

**File:** `frontend/src/hooks/use-anonymous-voice-live.ts:390-394`
**Issue:** `const signalingUrl = \`${session.signaling_url}${separator}api-key=${encodeURIComponent(session.auth_token)}\`;` puts the short-lived Azure bearer token directly in a URL (query string), which risks the token being captured in browser history, devtools network logs, or any intermediary access log that logs full request URLs (WebSocket handshake URLs are logged by some proxies/CDNs). This mirrors an existing pattern already used by the authenticated `use-voice-live-webrtc.ts` hook (browsers cannot set custom headers on the WebSocket handshake, so this is a documented, unavoidable Azure constraint per the code comment), so it is not a new class of risk introduced by this phase, but it is a second call site carrying the same exposure and worth tracking alongside the authenticated one if that risk is ever mitigated (e.g. via a one-time-use signaling ticket instead of the raw bearer token).
**Fix:** No action required specific to this phase beyond what the authenticated hook already accepts; if/when the authenticated path adopts a short-lived one-time ticket instead of the raw bearer token in the URL, apply the same fix here.

---

_Reviewed: 2026-08-01T08:12:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
