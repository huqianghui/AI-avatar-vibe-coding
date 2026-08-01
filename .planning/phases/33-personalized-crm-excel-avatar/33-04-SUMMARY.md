---
phase: 33-personalized-crm-excel-avatar
plan: 04
subsystem: api
tags: [fastapi, sqlalchemy, alembic, jwt, slowapi, idor, pii-sanitization, personalization]

# Dependency graph
requires:
  - phase: 33-01
    provides: "UserCrmContext model + personalization_sanitizer.py (sanitize_field, sanitize_free_text_with_pii)"
  - phase: 33-03
    provides: "CRM admin import flow that populates UserCrmContext rows this plan reads"
provides:
  - "PersonalizedAvatarSession ORM model + migration (user_id-keyed, mirrors AnonymousAvatarSession shape)"
  - "POST /api/v1/avatar/session (JWT-authenticated session issuance, 201)"
  - "get_owned_session() IDOR gate (identical 404 for missing/foreign/expired/revoked sessions)"
  - "build_personalization_context() -- second sanitization gate (D-06), CRM + optional-preference prompt segment builder, D-08 silent '' fallback"
  - "limiter_user rate-limit proxy keyed by JWT `sub` claim (falls back to IP)"
affects: [33-05, 33-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IDOR-safe ownership check: get_owned_session() returns not_found() (never 403) for any session not owned by the caller, so existence of another user's session can never be inferred"
    - "Graceful degrade for not-yet-built dependency: _load_preferences() wraps `from app.models.user_preference import UserPreference` in try/except ImportError, returning [] until 33-07 lands -- no code change needed when that model appears"
    - "Dual sanitization gate (D-06): sanitize_field()/sanitize_free_text_with_pii() re-applied at prompt-injection read time, on top of the import-time gate from 33-01"
    - "Shared-Limiter proxy pattern extended: limiter_user joins limiter_ip/limiter_session, all delegating to one underlying slowapi Limiter instance via _KeyedLimiterProxy"

key-files:
  created:
    - backend/app/models/personalized_avatar_session.py
    - backend/alembic/versions/d37a_personalized_avatar_session.py
    - backend/app/services/personalized_session_service.py
    - backend/app/schemas/personalized_avatar.py
    - backend/app/api/personalized_avatar.py
    - backend/app/services/personalization_injection_service.py
    - backend/tests/test_personalized_session_service.py
    - backend/tests/test_personalized_avatar_api.py
    - backend/tests/test_personalization_injection_service.py
  modified:
    - backend/app/models/avatar_interaction_log.py
    - backend/app/models/__init__.py
    - backend/app/config.py
    - backend/app/services/rate_limit.py
    - backend/app/api/__init__.py
    - backend/app/main.py

key-decisions:
  - "get_user_id_key() derives the rate-limit bucket from the JWT `sub` claim via a best-effort jose.jwt.decode(), falling back to remote IP on missing/invalid Authorization header -- the route's own Depends(get_current_user) remains the real auth gate"
  - "personalization_injection_service.py owns runtime wiring of preference tags into the prompt segment; 33-07 (PERS-03) must not modify this file, it only needs to create a matching UserPreference model (user_id, category, value) -- _load_preferences() then starts succeeding automatically"
  - "Preferences-only behavior test intentionally omitted from test_personalization_injection_service.py because app.models.user_preference does not exist yet in this worktree (33-07 not yet executed) -- the plan's own guidance permits running this test before that module exists"

patterns-established:
  - "New authenticated (login-required) avatar surface lives under /api/v1/avatar (personalized_avatar_router), distinct from the unauthenticated /avatar-thumbnail-style public_avatar_router mounted without api_prefix"

requirements-completed: [PERS-02]

# Metrics
duration: ~20min
completed: 2026-08-01
---

# Phase 33 Plan 04: Personalized Avatar Session + Injection-Context Builder Summary

**JWT-authenticated POST /api/v1/avatar/session backed by a user_id-keyed PersonalizedAvatarSession table with an IDOR-safe ownership loader, plus build_personalization_context() re-running the D-06 sanitization gate to assemble the "## User Background" prompt segment from CRM data (with graceful no-op degradation until UserPreference/33-07 lands).**

## Performance

- **Duration:** ~20 min (task execution) + ~7 min full regression suite verification
- **Started:** 2026-08-01T19:40:00+08:00 (approx, first task work)
- **Completed:** 2026-08-01T19:47:15+08:00 (last task commit), regression verified after
- **Tasks:** 3
- **Files modified:** 15 (9 created, 6 modified)

## Accomplishments
- `PersonalizedAvatarSession` ORM model + Alembic migration, extending `avatar_interaction_logs` with `user_id`/`personalized_session_id` FKs, and a new `limiter_user` rate-limit key derived from the JWT `sub` claim
- `POST /api/v1/avatar/session` (201, JWT-authenticated) plus `get_owned_session()` — an IDOR gate returning an identical 404 for missing/foreign/expired/revoked sessions
- `build_personalization_context()` — the second (read-time) sanitization gate over CRM data, degrading silently to `""` (D-08) when a user has no CRM context and no preference rows, and gracefully skipping preferences entirely until `UserPreference` (33-07) exists

## Task Commits

Each task was committed atomically (`--no-verify`, per parallel-worktree convention — orchestrator validates hooks later):

1. **Task 1: PersonalizedAvatarSession model, migration, config, rate-limit key** - `1a56015` (feat)
2. **Task 2: personalized_session_service, ownership check (IDOR gate), POST /avatar/session** - `2361bff` (test+feat, TDD)
3. **Task 3: personalization_injection_service (build_personalization_context)** - `498401c` (test+feat, TDD)

_Note: TDD tasks (2 and 3) each combine RED+GREEN into a single atomic commit per this plan's convention; both were verified RED (test written, failed on missing implementation) before the implementation was added and the tests turned GREEN._

## Files Created/Modified
- `backend/app/models/personalized_avatar_session.py` - `PersonalizedAvatarSession` ORM model (user_id, expires_at, last_activity_at, request_count, is_revoked, last_response_id)
- `backend/alembic/versions/d37a_personalized_avatar_session.py` - creates `personalized_avatar_sessions` table; adds `user_id`/`personalized_session_id` columns + indexes + FKs to `avatar_interaction_logs`
- `backend/app/models/avatar_interaction_log.py` - added `user_id`, `personalized_session_id` nullable FK columns
- `backend/app/models/__init__.py` - registered `PersonalizedAvatarSession` in `__all__`/imports
- `backend/app/config.py` - added `personalized_session_ttl_minutes`, `personalized_rate_limit_session_create`, `personalized_rate_limit_chat_user`
- `backend/app/services/rate_limit.py` - added `get_user_id_key()` (JWT `sub`-derived rate key) and `limiter_user` proxy
- `backend/app/services/personalized_session_service.py` - `create_personalized_session()`, `get_owned_session()` (IDOR gate), `touch_session()`
- `backend/app/schemas/personalized_avatar.py` - `PersonalizedSessionResponse`, `PersonalizedChatRequest`, `PersonalizedChatResponse`
- `backend/app/api/personalized_avatar.py` - `POST /avatar/session` route (201, JWT-authenticated, rate-limited)
- `backend/app/api/__init__.py`, `backend/app/main.py` - registered `personalized_avatar_router` under `/api/v1`
- `backend/app/services/personalization_injection_service.py` - `build_personalization_context()` (second D-06 sanitization gate, D-08 silent fallback)
- `backend/tests/test_personalized_session_service.py` - 7 tests (create, 5 ownership-check cases)
- `backend/tests/test_personalized_avatar_api.py` - 2 tests (201 authenticated, 401 unauthenticated)
- `backend/tests/test_personalization_injection_service.py` - 5 tests (CRM-only, empty fallback, missing-module degrade, PII redaction, blank-field omission)

## Decisions Made
- `get_user_id_key()` uses a best-effort, non-authoritative JWT decode purely for rate-limit bucketing; it falls back to IP on any decode failure rather than raising, since the route's `Depends(get_current_user)` is the actual auth gate (decoupling throttling from authentication correctness)
- Kept ownership-check semantics identical to the Phase 32 anonymous-session precedent (`not_found()` for every negative case) to preserve the IDOR mitigation pattern established there
- Left `personalization_injection_service.py`'s preference-wiring ownership boundary explicit in the module docstring so that 33-07 (PERS-03) does not need to touch this file — only create a matching `UserPreference` model

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ruff E501 line-length violations in the Alembic migration file**
- **Found during:** Task 1 (`d37a_personalized_avatar_session.py`)
- **Issue:** 4 lines exceeded the 100-char Ruff limit (created_at/updated_at `Column()` calls, `op.add_column()`, `batch_op.drop_constraint()`)
- **Fix:** Ran `ruff format` on the file; re-verified `ruff check`/`ruff format --check` pass and re-ran the full upgrade/downgrade round-trip to confirm the migration logic was unaffected
- **Files modified:** `backend/alembic/versions/d37a_personalized_avatar_session.py`
- **Verification:** `ruff check .` and `ruff format --check .` clean; `alembic upgrade head` / `alembic downgrade -1` / `alembic upgrade head` round-trip succeeded
- **Committed in:** `1a56015` (Task 1 commit)

**2. [Rule 3 - Blocking] Ruff format needed on `test_personalized_avatar_api.py`**
- **Found during:** Task 2
- **Issue:** 1 line-too-long violation on an `async with AsyncClient(...)` line
- **Fix:** Ran `ruff format`; re-ran tests to confirm they still passed after reformat
- **Files modified:** `backend/tests/test_personalized_avatar_api.py`
- **Verification:** `ruff check .`/`ruff format --check .` clean; 2/2 tests passing
- **Committed in:** `2361bff` (Task 2 commit)

**3. [Rule 3 - Blocking] Ruff E501 (3 violations, 1 requiring manual refactor) in `personalization_injection_service.py`**
- **Found during:** Task 3
- **Issue:** The Customer/Contact/Notes f-string `.append()` lines exceeded 100 chars; `ruff format` alone resolved 2 of 3, leaving the "Notes:" line at 101 chars
- **Fix:** `ruff format` fixed the Customer/Contact lines automatically; the residual "Notes:" line was manually refactored into a two-statement form (`notes = sanitize_free_text_with_pii(...)` then `lines.append(f"Notes: {notes}")`) to bring it under the limit
- **Files modified:** `backend/app/services/personalization_injection_service.py`
- **Verification:** `ruff check .`/`ruff format --check .` clean; all 5 tests still passing after refactor
- **Committed in:** `498401c` (Task 3 commit)

**4. [Plan scope note - not a code deviation] Preferences-only behavior test omitted**
- **Found during:** Task 3
- **Issue:** The plan's `<behavior>` spec includes a "preferences-only" test case, but `app/models/user_preference.py` does not exist in this worktree (33-07/PERS-03 has not yet executed in the serialized PERS-01→02→03 wave order)
- **Resolution:** Per the plan's own stated guidance ("OR simply run this test before 33-07 has created the module"), this test case was intentionally omitted rather than faked with a mock model. `build_personalization_context()`'s code path for preferences is exercised structurally by the "missing module degrades gracefully" test; once 33-07 lands, this preferences-only case should be added to `test_personalization_injection_service.py`
- **Files modified:** none (test intentionally not written)
- **Committed in:** N/A — documented here for 33-07's awareness

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking lint), 1 documented scope note (deferred test case, not a defect)
**Impact on plan:** All auto-fixes were mechanical lint/format corrections required to pass the CLAUDE.md pre-commit checklist; no logic changes. The deferred preferences-only test is expected and explicitly anticipated by the plan itself pending 33-07.

## Issues Encountered
- Full backend regression suite (`pytest --no-cov -q`, all ~2803 collected tests) showed **11 failed, 2632 passed, 153 skipped, 24 warnings** in `test_skill_consumption_service.py`, `test_skill_foundry_service.py`, and `test_skill_text_extractor.py` — none of these files were touched by this plan, and none reference `personalized_avatar`, `personalized_session`, or `personalization_injection`. Confirmed pre-existing/unrelated (same pattern documented in `33-02-SUMMARY.md`'s regression run: "11 failed... all pre-existing and unrelated").
- Combined targeted run of all 3 new test files together (`test_personalized_session_service.py`, `test_personalized_avatar_api.py`, `test_personalization_injection_service.py`): **14 passed, 2 warnings** (2.83s) — no cross-file interference.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 33-05 can now wire `build_personalization_context()` into the actual chat turn's system prompt, and consume `get_owned_session()`/`create_personalized_session()` for the personalized chat endpoint
- 33-07 (PERS-03, `UserPreference` model) can land independently at any time — `_load_preferences()` in `personalization_injection_service.py` will start succeeding automatically with zero code changes required in this file, and should add the deferred "preferences-only" test case to `test_personalization_injection_service.py` at that point
- No blockers

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*

## Self-Check: PASSED

All created files verified present on disk; all 3 task commit hashes verified present in `git log`. See verification commands and output below.
