---
phase: 32-anonymous-grounded-avatar-q-a
plan: 03
subsystem: api
tags: [fastapi, azure-voice-live, webrtc, rtcpeerconnection, slowapi, react, vitest]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a plan 01
    provides: dual-key limiter_ip/limiter_session, anon_rate_limit_webrtc_ip/_session Settings, PublicKnowledgeConfig ORM model
  - phase: 32-anonymous-grounded-avatar-q-a plan 02
    provides: get_anonymous_session dependency (X-Anon-Session trust boundary), get_active_public_config() fail-closed resolver, POST /public/avatar/session
provides:
  - create_public_webrtc_session_config() — agent-mode WebRTC ephemeral-credential builder driven by an explicit agent_id/voice_name rather than an HCP profile
  - POST /public/avatar/webrtc/session — anonymous-token-gated WebRTC ephemeral-credential issuance, avatar identity 100% server-resolved from PublicKnowledgeConfig
  - frontend/src/api/public-avatar.ts — fetch-based (non-JWT) client for the /public/avatar/* surface: createAnonymousSession, sendAnonymousChat, fetchAnonymousWebrtcSession
  - frontend/src/hooks/use-anonymous-voice-live.ts — useAnonymousVoiceLive(), drop-in-compatible WebRTC voice hook gated by anonymous session token instead of JWT
affects: [32-04-anonymous-grounded-avatar-q-a]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling ephemeral-credential builder: rather than retrofitting the HCP-profile-coupled create_webrtc_session_config(), add a parallel create_public_webrtc_session_config(db, *, agent_id, voice_name) that reuses only the shared building blocks (config_service resolution, to_cognitive_services_endpoint, _exchange_api_key_for_bearer_token, AVATAR_WARNING) — avoids forcing an unrelated (HCP/training-session) code path to also serve an anonymous, PublicKnowledgeConfig-driven identity model"
    - "Dedicated fetch-based frontend API module for the anonymous trust boundary: frontend/src/api/public-avatar.ts intentionally does not reuse the JWT-bearing apiClient axios singleton, making 'never send Authorization on this path' a structural property of the module rather than something that must be remembered per-call"
    - "Hook duplication over shared-module extraction: use-anonymous-voice-live.ts duplicates the minimal WebRTC/RTCPeerConnection connection-bootstrap from use-voice-live-webrtc.ts (SDP offer/answer over signaling WebSocket, voice-live-events data channel, 3-attempt reconnect) rather than extracting a shared helper, since that logic was not already factored out and the authenticated hook is a live production dependency of voice-session.tsx with no existing test coverage to safely refactor against"

key-files:
  created:
    - backend/tests/test_public_webrtc_session.py
    - frontend/src/api/public-avatar.ts
    - frontend/src/hooks/use-anonymous-voice-live.ts
    - frontend/src/hooks/use-anonymous-voice-live.test.ts
  modified:
    - backend/app/services/voice_live_webrtc.py
    - backend/app/schemas/public_avatar.py
    - backend/app/api/public_avatar.py

key-decisions:
  - "The plan's guessed backend function name (issue_ephemeral_credential) does not exist; the real function is create_webrtc_session_config, which is tightly coupled to HCP-profile/training-session resolution with no character/style/voice parameters. Per the plan's own 'read_first, don't guess' instruction, added a new sibling function create_public_webrtc_session_config(db, *, agent_id, voice_name) in the same module that reuses the shared Azure config-resolution and STS bearer-exchange logic but builds the agent-mode signaling URL directly from an explicit agent_id sourced from PublicKnowledgeConfig"
  - "avatar_character/avatar_style on PublicKnowledgeConfig are not actually consumable by WebRTC session construction today — WebRTC audio transport does not support avatar video (existing AVATAR_WARNING constant, unchanged). Only voice_map[locale] flows into the credential's session_config.voice.name; agent_id flows into the signaling URL. This is the same limitation the authenticated WebRTC path already has, not something this plan introduces or needs to fix"
  - "AnonymousSessionResponse/WebrtcSessionResponse in the frontend API client use snake_case field names (session_token, expires_at, signaling_url, auth_token, ...) matching the real backend Pydantic schemas verbatim, correcting the plan's literal <action> code template which guessed camelCase (sessionToken, expiresAt) — consistent with the project's existing convention in frontend/src/types/voice-live.ts of no camelCase transformation layer for this wire format"
  - "frontend/src/api/public-avatar.ts deliberately does not import or reuse @/api/client.ts's apiClient axios singleton, since that instance auto-attaches a JWT bearer header to every request; a small dedicated fetch-based module is used instead so the anonymous path structurally cannot leak a JWT header"

patterns-established:
  - "Anonymous WebRTC credential issuance always runs Depends(get_anonymous_session) before any Azure-facing call (T-32-14), verified by tests asserting the Azure bearer-exchange mock was never invoked on missing/invalid token"
  - "WebrtcSessionRequest (backend) and the frontend hook's connect() both accept only a locale — no character/style/voice/agent_id override field exists anywhere in the anonymous request path (T-32-12)"

requirements-completed: [ANON-04]

# Metrics
duration: ~50min (Task 1 backend completed in a prior session of this same plan; this session covered Task 2 frontend work plus final verification and SUMMARY)
completed: 2026-08-01
---

# Phase 32 Plan 03: Anonymous WebRTC Voice Session Summary

**Anonymous-token-gated WebRTC ephemeral-credential endpoint (`POST /public/avatar/webrtc/session`) reusing Azure Voice Live's agent-mode signaling/bearer-token machinery with identity sourced from `PublicKnowledgeConfig`, plus a frontend `useAnonymousVoiceLive()` hook exposing the exact same connect/disconnect/transcript surface as the authenticated `useVoiceLiveWebRTC` hook.**

## Performance

- **Duration:** ~50 min total (Task 1 backend work + tests completed and committed in a prior session; this session completed Task 2 frontend work, ran full targeted backend + frontend verification, and wrote this summary)
- **Completed:** 2026-08-01
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Anonymous visitors with a valid `X-Anon-Session` token can obtain a short-TTL WebRTC ephemeral credential (`POST /public/avatar/webrtc/session`) with the exact same response shape as the authenticated `/voice-live/webrtc/session` route
- The issued credential's `agent_id` and voice always come from the active `PublicKnowledgeConfig` row (keyed by `locale`) — never a hardcoded default, never a client-supplied override
- A request with no or an invalid anonymous session token is rejected with 401 before any Azure bearer-token exchange is attempted (verified by asserting the mock was never called)
- `POST /public/avatar/webrtc/session` is dual (IP + session) rate limited, matching the chat/session endpoints' established pattern
- `useAnonymousVoiceLive()` gives Plan 04's avatar page a drop-in-compatible WebRTC voice hook — same return-shape key set as `useVoiceLiveWebRTC` — authenticated purely by the anonymous session token, with no code path that can attach a JWT `Authorization` header
- `frontend/src/api/public-avatar.ts` provides the full anonymous-surface client trio (`createAnonymousSession`, `sendAnonymousChat`, `fetchAnonymousWebrtcSession`) as a `fetch`-based module structurally isolated from the JWT-bearing `apiClient` axios singleton

## Task Commits

1. **Task 1: Anonymous WebRTC ephemeral-credential endpoint** - `bc02732` (feat)
2. **Task 2: Frontend anonymous voice-live hook + typed API client function** - `7f5edbc` (feat)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `backend/app/services/voice_live_webrtc.py` - added `create_public_webrtc_session_config(db, *, agent_id, voice_name)` — agent-mode signaling URL + STS bearer-token exchange, reusing the shared config-resolution helpers already used by `create_webrtc_session_config`
- `backend/app/schemas/public_avatar.py` - added `WebrtcSessionRequest` (locale only, pattern-constrained) and `WebrtcSessionResponse(WebRTCSessionResponse)` (empty subclass, inherits the authenticated response's exact field set)
- `backend/app/api/public_avatar.py` - added `POST /webrtc/session`, dual `limiter_ip`/`limiter_session` decorated, gated by `Depends(get_anonymous_session)` before resolving `get_active_public_config()` and calling `create_public_webrtc_session_config()`
- `backend/tests/test_public_webrtc_session.py` - 5 tests: credential shape, admin-config-sourced identity (not client/default), 401-before-Azure-call for missing and invalid tokens, 429 rate limit with structured `RATE_LIMITED` code
- `frontend/src/api/public-avatar.ts` - `createAnonymousSession`, `sendAnonymousChat`, `fetchAnonymousWebrtcSession` — dedicated `fetch`-based client targeting the bare `/public/avatar/...` routes, snake_case wire types, `X-Anon-Session` header only
- `frontend/src/hooks/use-anonymous-voice-live.ts` - `useAnonymousVoiceLive(sessionToken, options?)` — full WebRTC connection bootstrap (RTCPeerConnection, data channel, signaling WebSocket SDP exchange, 3-attempt reconnect) mirroring `use-voice-live-webrtc.ts`, but issuing its session via `fetchAnonymousWebrtcSession` instead of the JWT-authenticated `fetchWebRTCSession`
- `frontend/src/hooks/use-anonymous-voice-live.test.ts` - 4 tests: request header/body shape for `fetchAnonymousWebrtcSession`, absence of `Authorization` at the API-client level, return-shape key parity with `useVoiceLiveWebRTC`, absence of `Authorization` anywhere in the hook's full connect() request path

## Decisions Made
- Replaced the plan's guessed `issue_ephemeral_credential` call with a new sibling function `create_public_webrtc_session_config` in `voice_live_webrtc.py`, since the real existing function (`create_webrtc_session_config`) is too tightly coupled to HCP-profile/training-session resolution to directly serve an identity model driven by `PublicKnowledgeConfig.agent_id`/`voice_map` — this follows the plan's own explicit "don't guess, follow the real shape" instruction
- `WebrtcSessionResponse` mirrors `WebRTCSessionResponse` via empty-subclass inheritance rather than duplicating fields, keeping the two schemas structurally identical without copy-paste drift
- Frontend `AnonymousSessionResponse`/`WebrtcSessionResponse` types use snake_case (matching the real backend wire format) rather than the plan's guessed camelCase — consistent with the project's existing `voice-live.ts` convention
- `use-anonymous-voice-live.ts` duplicates the minimal WebRTC bootstrap from `use-voice-live-webrtc.ts` instead of extracting a shared helper module, per the plan's explicit fallback guidance; the authenticated hook is a live production dependency of `voice-session.tsx` with no existing dedicated test file, making an in-place refactor a higher-risk option than a small, well-tested duplicate

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's literal backend action code referenced a non-existent function name**
- **Found during:** Task 1, `read_first` step
- **Issue:** The plan's `<action>` block called `issue_ephemeral_credential(character=..., style=..., voice=...)`, a guessed name/signature. The real function in `backend/app/services/voice_live_webrtc.py` is `create_webrtc_session_config(db, hcp_profile_id=None, ...)`, with no character/style/voice parameters and heavy coupling to HCP-profile/training-session resolution that doesn't apply to the anonymous, `PublicKnowledgeConfig`-driven identity model.
- **Fix:** Added a new function `create_public_webrtc_session_config(db, *, agent_id, voice_name)` reusing the shared Azure config-resolution and bearer-token-exchange building blocks, and wired `public_avatar.py`'s new route to call it instead.
- **Files modified:** `backend/app/services/voice_live_webrtc.py`, `backend/app/api/public_avatar.py`
- **Verification:** `pytest tests/test_public_webrtc_session.py -v` (5/5 passed), plus full `test_voice_live_webrtc.py` (12/12) and `test_public_avatar_api.py` (12/12) confirming no regression to the existing authenticated path.
- **Committed in:** `bc02732` (Task 1 commit)

**2. [Rule 1 - Bug] Plan's literal frontend types guessed camelCase instead of the real snake_case wire format**
- **Found during:** Task 2, `read_first` step (re-checking `frontend/src/types/voice-live.ts` and the actual backend Pydantic schemas)
- **Issue:** The plan's `<action>` block for `AnonymousSessionResponse` used `{ sessionToken: string; expiresAt: string; }`, but the real backend response (`backend/app/schemas/public_avatar.py`, `ConfigDict(from_attributes=False)`, no field aliasing) and the project's own established frontend convention are both snake_case verbatim.
- **Fix:** Defined `AnonymousSessionResponse`, `ChatResponse`, `CitationOut`, and `WebrtcSessionResponse` in `frontend/src/api/public-avatar.ts` using snake_case field names matching the real backend shapes exactly.
- **Files modified:** `frontend/src/api/public-avatar.ts`
- **Verification:** `npx tsc -b` exits 0; `use-anonymous-voice-live.test.ts`'s request-shape test asserts the actual serialized body/response fields.
- **Committed in:** `7f5edbc` (Task 2 commit)

**3. [Rule 1 - Bug] Doc comments in `public-avatar.ts` literally contained the string "Authorization", failing the plan's acceptance criterion**
- **Found during:** Task 2, post-implementation acceptance-criteria check (`grep -c "Authorization" frontend/src/api/public-avatar.ts` returned 3, all in comments describing the absence of that header)
- **Issue:** The plan's acceptance criteria require the file to literally not contain the string `Authorization` (a structural guard against JWT-header leakage), but explanatory comments referencing "no Authorization header" tripped that same literal check.
- **Fix:** Reworded the three comments to say "JWT bearer header" instead of "Authorization" while preserving the same explanatory intent.
- **Files modified:** `frontend/src/api/public-avatar.ts`
- **Verification:** `grep -n "Authorization" frontend/src/api/public-avatar.ts` returns no matches; `npx tsc -b` and `npx vitest run src/hooks/use-anonymous-voice-live.test.ts` both still pass.
- **Committed in:** `7f5edbc` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bug fixes — one architectural-naming correction, one wire-format correction, one literal-string acceptance-criterion fix)
**Impact on plan:** All three were necessary corrections to match the plan's own stated "follow the real shape, don't guess" principle and its literal acceptance criteria. No scope creep — only the files already in the plan's `files_modified` list were touched.

## Issues Encountered
None beyond the deviations above. All targeted `pytest`/`ruff`/`vitest`/`tsc`/`npm run build` verification commands passed on first or second attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full anonymous voice vertical slice (session token → grounded chat → WebRTC ephemeral credential → frontend hook) is complete and independently testable end-to-end
- Plan 04's avatar page can compose `useAnonymousVoiceLive()` exactly like `useVoiceLiveWebRTC()` (same return-shape keys), swapping in `fetchAnonymousWebrtcSession`-backed session issuance with zero prop-shape changes
- Known gap (not in this plan's scope): `frontend/vite.config.ts`'s dev-server proxy only forwards `/api/*` to the backend — the bare `/public/avatar/...` paths this plan's frontend code calls are not yet proxied for local `npm run dev` testing. Plan 04 (or its own dev-environment setup) should add a `/public` proxy entry alongside the existing `/api` one before manual browser verification of the anonymous flow.
- No blockers identified for Plan 04

---
*Phase: 32-anonymous-grounded-avatar-q-a*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 7 created/modified files confirmed present on disk; both task commit hashes (`bc02732`, `7f5edbc`) confirmed present in `git log --oneline`.
