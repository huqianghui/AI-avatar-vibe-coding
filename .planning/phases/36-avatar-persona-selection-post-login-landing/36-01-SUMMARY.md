---
phase: 36-avatar-persona-selection-post-login-landing
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, alembic, pydantic-v2, avatar-persona]

# Dependency graph
requires:
  - phase: 35-user-preference-injection
    provides: TimestampMixin, exception hierarchy, require_role auth dependency, migration head d37a_user_preference_table
provides:
  - AvatarPersona SQLAlchemy model + Alembic migration (avatar_personas table)
  - avatar_persona_service.py CRUD + transactional unique-default guard
  - Admin CRUD router (/api/v1/admin/avatar-personas) with set-default action route
  - Public enabled-only router (/api/v1/personas)
  - Idempotent seed_data.py entry producing one enabled default persona
affects: [36-02-admin-persona-frontend, 36-03-persona-03, 36-04-persona-04, 36-05-post-login-landing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transactional unique-default guard: bulk update(Model).values(is_default=False) then set target True in one commit"
    - "409-with-transfer-target guard: disable/delete of current default rejected unless new_default_persona_id supplied, which triggers an atomic promotion first"
    - "JSON-as-Text column with parse_*_voice_map() fallback-to-{} helper (mirrors public_knowledge_config_service.py)"

key-files:
  created:
    - backend/app/models/avatar_persona.py
    - backend/alembic/versions/e38a_create_avatar_persona_table.py
    - backend/app/schemas/avatar_persona.py
    - backend/app/services/avatar_persona_service.py
    - backend/app/api/admin_avatar_personas.py
    - backend/app/api/avatar_personas.py
    - backend/tests/test_avatar_persona_service.py
    - backend/tests/test_admin_avatar_personas_api.py
    - backend/tests/test_avatar_personas_api.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/scripts/seed_data.py

key-decisions:
  - "AppException handler returns {code, message, details} at the JSON top level (not nested under 'detail') — tests must assert body['code'], not body['detail']['code']"
  - "update_persona re-fetches the target via get_persona() after calling set_default_persona() to avoid stale is_default state under expire_on_commit=False + bulk UPDATE identity-map staleness"
  - "Seed persona uses character='lisa' (not 'jeff', which RESEARCH.md flags for Dec-2026 retirement)"
  - "DELETE default-transfer target passed as query param ?new_default_persona_id=, not JSON body, matching existing delete-route conventions in this repo"

patterns-established:
  - "Transactional unique-default guard for singleton-flag entities: clear-all-then-set-one bulk update in a single commit"

requirements-completed: [PERSONA-01, PERSONA-02]

# Metrics
duration: 45min
completed: 2026-08-02
---

# Phase 36 Plan 01: AvatarPersona Backend Catalog Summary

**AvatarPersona backend CRUD catalog with transactional unique-default guard, admin/public FastAPI routers, and idempotent seed producing one enabled default persona.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 (2 code tasks + 1 verification-only regression gate)
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments
- `AvatarPersona` SQLAlchemy model + Alembic migration (`e38a_create_avatar_persona_table`, chained off `d37a_user_preference_table`) creating the `avatar_personas` table with all D-01 fields
- Service layer (`avatar_persona_service.py`) with full CRUD plus a transactional unique-default guard (`set_default_persona`) and 409-with-transfer-target semantics on disable/delete of the current default
- Admin CRUD router (`/api/v1/admin/avatar-personas`, role-guarded) and public enabled-only router (`/api/v1/personas`, no auth) both registered in `main.py`
- Idempotent seed producing exactly one enabled, default `AvatarPersona` ("Lisa") on a fresh install
- 24 new tests (15 service unit tests + 9 API integration tests), all passing; full backend regression suite green (2853 passed, 15 skipped, 28 deselected, 90.19% coverage vs 89% gate)

## Task Commits

1. **Task 1: AvatarPersona model, migration, schemas, and service layer** - `da82ee4` (feat)
2. **Task 2: Admin CRUD router + public enabled-only router + seed data** - `1fd2ef3` (feat)
3. **Task 3: Full backend regression gate** - no commit (verification-only; ruff/format/full-suite all passed on first run, nothing to fix)

## Files Created/Modified
- `backend/app/models/avatar_persona.py` - `AvatarPersona(Base, TimestampMixin)` ORM model
- `backend/app/models/__init__.py` - re-export `AvatarPersona`
- `backend/alembic/versions/e38a_create_avatar_persona_table.py` - migration creating `avatar_personas` table
- `backend/app/schemas/avatar_persona.py` - `AvatarPersonaCreate`/`Update`/`Out` Pydantic v2 schemas
- `backend/app/services/avatar_persona_service.py` - CRUD + `set_default_persona` unique-default guard
- `backend/app/api/admin_avatar_personas.py` - admin CRUD router (create/list/get/update/delete/set-default)
- `backend/app/api/avatar_personas.py` - public enabled-only list router
- `backend/app/api/__init__.py` - router exports
- `backend/app/main.py` - router registration
- `backend/scripts/seed_data.py` - `seed_default_avatar_persona()`
- `backend/tests/test_avatar_persona_service.py` - 15 service unit tests
- `backend/tests/test_admin_avatar_personas_api.py` - 8 admin API integration tests
- `backend/tests/test_avatar_personas_api.py` - 1 public API integration test class

## Decisions Made
- Confirmed via `alembic.script.ScriptDirectory.get_heads()` that `d37a_user_preference_table` is the sole current migration head (filename lettering is not strictly chronological); chained the new migration off it.
- `update_persona` explicitly re-fetches the persona object via `get_persona()` after an internal `set_default_persona()` call, rather than relying on session `synchronize_session` behavior, to guarantee the returned response reflects the post-transfer `is_default` state under `expire_on_commit=False`.
- Seeded character `lisa`/`casual-sitting` chosen deliberately over `jeff` per RESEARCH.md's documented Dec-2026 Azure prebuilt-character retirement pitfall.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect exception-response-shape assertion while authoring test**
- **Found during:** Task 2 (admin API integration tests)
- **Issue:** Initial test draft asserted `body["detail"]["code"] == "CONFLICT"` for the 409 guard response, causing a `KeyError`. The app's global `@app.exception_handler(AppException)` (in `main.py`) returns `{"code", "message", "details"}` at the top level of the JSON body, not nested under a `"detail"` key (that's FastAPI's default `HTTPException` shape, which this app overrides).
- **Fix:** Corrected assertion to `body["code"] == "CONFLICT"`.
- **Files modified:** `backend/tests/test_admin_avatar_personas_api.py`
- **Verification:** Test passes; confirmed shape matches `main.py`'s exception handler.
- **Committed in:** `1fd2ef3` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, test-only — no production code defect)
**Impact on plan:** No scope creep; caught during initial test authoring before commit, not a runtime regression.

## Issues Encountered
- Coverage gate (`--cov-fail-under=89` in `pyproject.toml` `addopts`) produces a spurious failure on any partial/subset pytest run since it measures coverage against the entire `app/` package. Resolved by using `--no-cov` for targeted per-file verification during development, reserving the plan's literal full-suite command (without `--no-cov`) for the final Task 3 regression gate, which correctly reported 90.19% coverage.
- Full backend test suite takes ~15 minutes to run; required blocking Bash calls with large explicit timeouts and PID-polling loops rather than chained `sleep` commands to await completion.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `avatar_persona_service.py`'s six exported functions (`create_persona`, `list_personas`, `get_persona`, `update_persona`, `delete_persona`, `set_default_persona`) and both routers are stable public interfaces ready for 36-02 (admin frontend) to consume via typed HTTP calls.
- Public `GET /api/v1/personas` is ready for PERSONA-03/04 (persona selection/session application) and 36-05 (post-login landing) to consume.
- No blockers identified.

---
*Phase: 36-avatar-persona-selection-post-login-landing*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 9 created files verified present on disk; both task commit hashes (`da82ee4`, `1fd2ef3`) verified present in `git log`.
