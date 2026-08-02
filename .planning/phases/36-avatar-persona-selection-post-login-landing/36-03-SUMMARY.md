---
phase: 36-avatar-persona-selection-post-login-landing
plan: 03
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, pii-sanitization, voice-live, personalization]

# Dependency graph
requires:
  - phase: 36-avatar-persona-selection-post-login-landing (36-01)
    provides: AvatarPersona model + CRUD service (avatar_persona_service.py), unique-default guard, seed data
provides:
  - "resolve_active_persona() + resolve_voice_for_locale() helpers in avatar_persona_service.py"
  - "Gate-1 PII sanitization of prompt_fragment at persona create/update time"
  - "Persona-aware anonymous WebRTC session config: resolved voice_name via 3-tier fallback chain, resolved greeting"
  - "handle_anonymous_turn() and handle_personalized_turn() now inject the resolved persona's sanitized prompt fragment into personalization_context"
  - "Gate-2 PII re-sanitization at chat-injection time (defense-in-depth alongside gate 1)"
affects: [36-04-persona-04-frontend, 36-05-post-login-landing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-gate PII sanitization: sanitize_free_text_with_pii() applied once at admin-save time (create_persona/update_persona) and again at chat-injection time (handle_anonymous_turn/handle_personalized_turn), so a fragment that somehow bypasses gate 1 (legacy row, direct DB edit) still never reaches a live prompt unsanitized"
    - "Silent-fallback persona resolution: any client-supplied persona_id/user-preference that is disabled/unknown/missing degrades to the single is_default=True,enabled=True persona with zero error surfaced (never reveals existence/enabled-state of an id)"
    - "3-tier voice fallback chain: persona.voice_map -> PublicKnowledgeConfig.voice_map (Phase 34 admin default) -> DEFAULT_PUBLIC_VOICE_BY_LOCALE hardcoded constant"

key-files:
  created: []
  modified:
    - backend/app/services/avatar_persona_service.py
    - backend/app/schemas/public_avatar.py
    - backend/app/schemas/voice_live.py
    - backend/app/services/voice_live_webrtc.py
    - backend/app/api/public_avatar.py
    - backend/app/services/avatar_service.py
    - backend/app/services/personalized_avatar_service.py
    - backend/tests/test_avatar_persona_service.py
    - backend/tests/test_public_webrtc_session.py
    - backend/tests/test_avatar_service.py
    - backend/tests/test_personalized_avatar_service.py
    - backend/tests/test_avatar_interaction_log.py

key-decisions:
  - "resolve_active_persona() raises NotFoundException when the catalog has zero default personas, rather than returning None -- matches the plan's -> AvatarPersona (non-Optional) signature; this is a true misconfiguration that never happens in production thanks to seed_data.py + the unique-default guard from 36-01"
  - "greeting: str | None = None added to the base WebRTCSessionResponse schema (schemas/voice_live.py), not just the public_avatar.py subclass -- create_public_webrtc_session_config() constructs and returns the base type directly, and Pydantic v2 forbids setting an undeclared attribute at construction time"
  - "Every pre-existing test file that drives handle_anonymous_turn/handle_personalized_turn directly against an in-memory DB (test_avatar_service.py, test_personalized_avatar_service.py, test_avatar_interaction_log.py) gained the same autouse _default_persona fixture, since persona resolution is now a mandatory dependency of both handlers"

patterns-established:
  - "Autouse per-file _default_persona pytest fixture: any test file that calls handle_anonymous_turn/handle_personalized_turn against a real in-memory DB session must seed one enabled+is_default AvatarPersona via an autouse fixture, mirroring the exact same AvatarPersonaCreate payload across files"

requirements-completed: [PERSONA-04]

# Metrics
duration: ~85min
completed: 2026-08-02
---

# Phase 36 Plan 3: Persona Resolution + Voice/Greeting/Prompt-Fragment Wiring Summary

**Wired the 36-01 AvatarPersona catalog into real sessions: `resolve_active_persona()`/`resolve_voice_for_locale()` helpers, persona-aware anonymous WebRTC voice+greeting, and two-gate-sanitized prompt-fragment injection into both anonymous and personalized chat.**

## Performance

- **Duration:** ~85 min
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- `resolve_active_persona(db, *, user_id=None, requested_persona_id=None)` implements the full silent-fallback chain (explicit id -> user preference -> default), enforcing an enabled-only whitelist at every branch (T-36-10/T-36-11)
- `resolve_voice_for_locale(persona, locale, *, public_config=None)` implements the 3-tier voice fallback chain (persona voice_map -> admin PublicKnowledgeConfig voice_map -> `DEFAULT_PUBLIC_VOICE_BY_LOCALE`)
- Gate-1 sanitization (`sanitize_free_text_with_pii`) applied to `prompt_fragment` in both `create_persona` and `update_persona`
- `/public/avatar/webrtc/session` now resolves persona + voice + greeting server-side; an invalid/disabled client `persona_id` degrades to the default persona with a 200, never an error
- `handle_anonymous_turn` injects the default persona's re-sanitized (gate 2) fragment alone as `personalization_context`
- `handle_personalized_turn` injects the user's active persona's re-sanitized fragment concatenated ahead of their existing CRM/preference context (`"\n\n".join(filter(None, [...]))`)
- Full backend regression: 2876 passed, 15 skipped, 28 deselected, ruff check/format-check clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Persona resolution + voice fallback chain** - `77afec8` (feat)
2. **Task 2: Wire voice + greeting into the WebRTC session endpoint** - `46590ae` (feat)
3. **Task 3: Persona prompt-fragment injection (anonymous + personalized chat) and full regression** - `19b0e09` (feat)

_Note: all three tasks were TDD (test-first per the plan); each commit includes both the new/updated test file(s) and the corresponding implementation change, since tests and implementation for a given task landed together after RED was confirmed._

## Files Created/Modified
- `backend/app/services/avatar_persona_service.py` - added `resolve_active_persona()`, `resolve_voice_for_locale()`, `_get_default_persona()`; gate-1 sanitization in `create_persona`/`update_persona`
- `backend/app/schemas/public_avatar.py` - `WebrtcSessionRequest.persona_id`, `WebrtcSessionResponse` docstring update
- `backend/app/schemas/voice_live.py` - `WebRTCSessionResponse.greeting: str | None = None`
- `backend/app/services/voice_live_webrtc.py` - `create_public_webrtc_session_config()` gained `greeting` kwarg, set on the returned response
- `backend/app/api/public_avatar.py` - `webrtc_session` handler resolves persona + voice via the new helpers before building the session config
- `backend/app/services/avatar_service.py` - `handle_anonymous_turn` resolves the default persona and injects its sanitized fragment as `personalization_context`
- `backend/app/services/personalized_avatar_service.py` - `handle_personalized_turn` resolves the user's active persona and concatenates its sanitized fragment ahead of the CRM context
- `backend/tests/test_avatar_persona_service.py` - resolver + fallback-chain + gate-1 sanitization test coverage (29 tests)
- `backend/tests/test_public_webrtc_session.py` - persona resolution coverage for the WebRTC endpoint (greeting field, voice-map precedence, fallback on invalid/disabled persona_id)
- `backend/tests/test_avatar_service.py` - autouse default-persona fixture + persona-injection assertions for the anonymous path
- `backend/tests/test_personalized_avatar_service.py` - autouse default-persona fixture + persona-injection/concatenation assertions for the personalized path; updated 2 pre-existing forwarding tests to the new concatenated-context shape
- `backend/tests/test_avatar_interaction_log.py` - autouse default-persona fixture (pre-existing direct-call test needed one once persona resolution became mandatory)

## Decisions Made
- `resolve_active_persona()` raises `NotFoundException` (never `None`) when the catalog has no default persona — matches the plan's non-Optional return type and the guaranteed-default invariant from 36-01.
- `WebRTCSessionResponse.greeting` was added to the base schema class (not only the `public_avatar.py` subclass) because `create_public_webrtc_session_config()` constructs that base type directly and Pydantic v2 rejects undeclared attributes at construction time — a deliberate, necessary deviation from the plan's literal `files_modified` list (which only named `schemas/public_avatar.py`), required to satisfy the plan's own `<action>` instruction to "set it on the returned response."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `greeting` field to the base `WebRTCSessionResponse` schema, not just the public subclass**
- **Found during:** Task 2
- **Issue:** The plan's `<action>` block instructs setting `greeting` "on the returned response" inside `create_public_webrtc_session_config()`, which constructs and returns the base `WebRTCSessionResponse` type (not the `public_avatar.py` subclass). Pydantic v2 forbids assigning an undeclared field to a model instance, so the literal instruction was unsatisfiable without adding the field to the base class.
- **Fix:** Added `greeting: str | None = None` to `WebRTCSessionResponse` in `backend/app/schemas/voice_live.py`, with a comment noting it's `None` on the authenticated HCP training path.
- **Files modified:** `backend/app/schemas/voice_live.py`
- **Verification:** `test_public_webrtc_session.py`'s `greeting` field-presence assertions pass; full suite green.
- **Committed in:** `46590ae` (Task 2 commit)

**2. [Rule 3 - Blocking] Added autouse default-persona fixture to `test_avatar_interaction_log.py`**
- **Found during:** Task 3 full-regression run
- **Issue:** Task 3 makes persona resolution (via `resolve_active_persona`) a mandatory, non-catchable-by-existing-try/except step at the top of `handle_anonymous_turn`. `test_avatar_interaction_log.py` drives that function directly against an in-memory DB with no persona seeded, so it started raising `NotFoundException` ("No default persona configured") instead of running its 3-turn scenario.
- **Fix:** Added the same autouse `_default_persona` fixture pattern already used in `test_avatar_service.py`/`test_personalized_avatar_service.py` (creates one enabled, `is_default=True` `AvatarPersona` before each test).
- **Files modified:** `backend/tests/test_avatar_interaction_log.py`
- **Verification:** `pytest tests/test_avatar_interaction_log.py` passes; full suite re-run green (2876 passed).
- **Committed in:** `19b0e09` (Task 3 commit)

**3. [Rule 1 - Bug] Updated 2 pre-existing `TestHandlePersonalizedTurnForwarding` tests to the new concatenated-context shape**
- **Found during:** Task 3 GREEN verification
- **Issue:** Two tests asserted `personalization_context` forwarded *verbatim* from `build_personalization_context()`'s return value — a contract Task 3 intentionally supersedes by prepending the resolved persona's sanitized fragment.
- **Fix:** Updated both assertions/docstrings to expect `"<persona fragment>\n\n<crm context>"` (non-empty CRM case) and `"<persona fragment>"` alone (empty CRM case, no stray separator).
- **Files modified:** `backend/tests/test_personalized_avatar_service.py`
- **Verification:** Both tests pass under the new production behavior.
- **Committed in:** `19b0e09` (Task 3 commit)

**4. [Rule 1 - Bug] Removed unused `stream_mock` local variable (ruff F841)**
- **Found during:** Task 3 lint pass
- **Issue:** `test_default_persona_fragment_passed_as_personalization_context` in `test_avatar_service.py` assigned `stream_mock = AsyncMock()` but never used it (the test patches with `side_effect=_stream_side_effect` directly).
- **Fix:** Removed the dead assignment.
- **Files modified:** `backend/tests/test_avatar_service.py`
- **Verification:** `ruff check .` passes clean.
- **Committed in:** `19b0e09` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug-fix/test-alignment)
**Impact on plan:** All four were direct, necessary consequences of implementing the plan's own specified behavior (Pydantic schema construction requirement; persona resolution becoming a mandatory dependency of both chat handlers). No scope creep — nothing was added beyond what Task 2/3's behavior blocks already required.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `resolve_active_persona()` and `resolve_voice_for_locale()` are stable, tested public interfaces ready for 36-04 (frontend persona selector) to call via the existing `/public/avatar/webrtc/session` `persona_id` param and a future authenticated persona-selection endpoint.
- Two-gate sanitization pattern is fully wired end-to-end (admin save -> chat injection) for `prompt_fragment`; no further sanitization work needed for 36-04/36-05.
- No blockers for 36-04 (frontend persona selection) or 36-05 (post-login landing).

---
*Phase: 36-avatar-persona-selection-post-login-landing*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: backend/app/services/avatar_persona_service.py
- FOUND: backend/app/schemas/voice_live.py
- FOUND: .planning/phases/36-avatar-persona-selection-post-login-landing/36-03-SUMMARY.md
- FOUND: 77afec8 (Task 1 commit)
- FOUND: 46590ae (Task 2 commit)
- FOUND: 19b0e09 (Task 3 commit)
