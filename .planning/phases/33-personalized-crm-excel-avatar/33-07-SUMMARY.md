---
phase: 33-personalized-crm-excel-avatar
plan: 07
subsystem: api
tags: [fastapi, sqlalchemy, alembic, idor, pii-sanitization, personalization, admin-crud]

# Dependency graph
requires:
  - phase: 33-01
    provides: "UserCrmContext model + personalization_sanitizer.py (sanitize_field), reused verbatim for write-time value sanitization"
  - phase: 33-04
    provides: "personalization_injection_service.py's _load_preferences() try/except-ImportError degrade contract that this plan's UserPreference model shape satisfies"
provides:
  - "UserPreference ORM model (user_id FK, category, value) + Alembic migration chained on d37a_personalized_avatar_session"
  - "UserPreference Pydantic schemas: UserPreferenceCreate/Update/Out, PersonalizationSummary, PREFERENCE_CATEGORIES"
  - "GET /api/v1/users/{user_id}/personalization (CRM match status + preference list, admin-only)"
  - "POST/PUT/DELETE /api/v1/users/{user_id}/preferences[/{preference_id}] admin CRUD, IDOR-safe, write-time sanitized"
affects: [33-08 (admin personalization UI consumes this API directly)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IDOR-safe mutation: UPDATE/DELETE queries filter by BOTH preference_id AND user_id in the same WHERE clause, identical 404 for missing/foreign rows"
    - "Router registration via app/api/__init__.py re-export + app.include_router in main.py (matched existing project convention, not the plan's literal direct-import snippet)"

key-files:
  created:
    - backend/app/models/user_preference.py
    - backend/alembic/versions/d37a_user_preference_table.py
    - backend/app/schemas/user_preference.py
    - backend/app/api/admin_user_preferences.py
    - backend/tests/test_admin_user_preferences.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py

key-decisions:
  - "Registered admin_user_preferences_router through app/api/__init__.py's re-export pattern (matching every other router in the codebase) instead of the plan's literal main.py direct-import snippet, since main.py imports all routers from the app.api package, not individual modules"
  - "Left personalization_injection_service.py and its test file untouched per this plan's explicit ownership note and the worktree branch-check guidance (plan does not include wiring UserPreference into the injection service/tests) -- verified via existing test_personalization_injection_service.py (5/5 still passing) that _load_preferences() now succeeds automatically now that UserPreference exists, with zero code changes needed"

patterns-established:
  - "Personalization admin CRUD pattern: read-only combined summary endpoint (PersonalizationSummary) + separate mutation endpoints, mirroring the admin_users.py router/auth pattern exactly"

requirements-completed: [PERS-03]

# Metrics
duration: ~15min
completed: 2026-08-01
---

# Phase 33 Plan 07: Preference Storage + Admin CRUD API Summary

**UserPreference table (independent of UserCrmContext per D-10) + admin-only CRUD API with a combined PersonalizationSummary read endpoint, IDOR-safe mutation queries, and write-time sanitize_field() reuse from 33-01's double-gate sanitizer.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-01 (approx, first task work)
- **Completed:** 2026-08-01
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `UserPreference` ORM model + Alembic migration (`d37a_user_preference_table`, chained cleanly on `d37a_personalized_avatar_session`) -- verified `alembic upgrade head` / `downgrade -1` / `upgrade head` round-trip
- `PersonalizationSummary`, `UserPreferenceCreate/Update/Out`, `PREFERENCE_CATEGORIES` Pydantic schemas
- `GET /api/v1/users/{user_id}/personalization` (admin-only, read-only, surfaces `customer_name`/`company` only -- never `crm_notes`/`contact_person`) + full preference CRUD (`POST`/`PUT`/`DELETE`), all admin-only, IDOR-safe on mutation, sanitized at write time via `sanitize_field()`
- 8/8 new tests passing; confirmed no regression in `test_personalization_injection_service.py` (5/5) or `test_personalized_avatar_api.py`/`test_personalized_session_service.py`

## Task Commits

Each task was committed atomically (`--no-verify`, per parallel-worktree convention -- orchestrator validates hooks later):

1. **Task 1: UserPreference model + Alembic migration + Pydantic schemas** - `54b99dd` (feat)
2. **Task 2: Admin CRUD API + main.py wiring + tests** - `92db39f` (test, RED) → `faabedf` (feat, GREEN)

_TDD Task 2 combines RED+GREEN as two separate commits per this plan's TDD convention; RED was verified to fail (7/8 tests failing on missing route) before GREEN was implemented._

## Files Created/Modified
- `backend/app/models/user_preference.py` - `UserPreference` ORM model (`user_id` FK CASCADE, `category`, `value`)
- `backend/alembic/versions/d37a_user_preference_table.py` - migration creating `user_preferences` table + index on `user_id`
- `backend/app/models/__init__.py` - registered `UserPreference` in package exports (alphabetical, after `UserCrmContext`)
- `backend/app/schemas/user_preference.py` - `UserPreferenceCreate/Update/Out`, `PersonalizationSummary`, `PreferenceCategory`/`PREFERENCE_CATEGORIES`
- `backend/app/api/admin_user_preferences.py` - `GET /{user_id}/personalization`, `POST/PUT/DELETE /{user_id}/preferences[/{preference_id}]`, all `require_role("admin")`-gated
- `backend/app/api/__init__.py` - re-exported `admin_user_preferences_router` (alphabetical, after `admin_crm_router`)
- `backend/app/main.py` - imported and `app.include_router(admin_user_preferences_router, ...)` immediately after `admin_users_router`
- `backend/tests/test_admin_user_preferences.py` - 8 tests: empty summary, CRM-matched summary (field allowlist), create+sanitize, invalid category 422, non-admin 403, update+sanitize, delete, IDOR delete-with-wrong-user-id

## Decisions Made
- Registered the new router via `app/api/__init__.py`'s established re-export pattern (every existing router follows `from app.api.X import router as X_router` + `__all__` entry, then `main.py` imports from `app.api` as a package) rather than the plan's literal main.py snippet (`from app.api.admin_user_preferences import router as admin_user_preferences_router` directly in `main.py`) -- functionally identical, but consistent with all 26 other routers in the codebase
- Left `personalization_injection_service.py` and `test_personalization_injection_service.py` untouched: this plan's own `<objective>` explicitly states "no changes to `personalization_injection_service.py` are needed or expected here", and the worktree branch-check note's conditional ("if your plan includes wiring UserPreference into the injection service or its tests, honor that flag; otherwise follow your plan as written") did not apply since this plan excludes that scope. Verified `_load_preferences()` now succeeds automatically (existing 5 injection-service tests still pass unmodified) now that `UserPreference` exists -- zero code changes were needed in that file, confirming 33-04's forward-compatible design worked as intended.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ruff E501 line-length violations in the Alembic migration file**
- **Found during:** Task 1
- **Issue:** The plan's literal `created_at`/`updated_at` `sa.Column(...)` lines exceeded the 100-char Ruff limit by 2 characters each
- **Fix:** Ran `ruff format`, which wrapped the two `sa.Column()` calls across multiple lines
- **Files modified:** `backend/alembic/versions/d37a_user_preference_table.py`
- **Verification:** `ruff check`/`ruff format --check` clean; re-ran `alembic downgrade -1` → `alembic upgrade head` round-trip to confirm the migration logic was unaffected by the reformat
- **Committed in:** `54b99dd` (Task 1 commit)

**2. [Rule 3 - Blocking] Ruff E501 line-length violations in the test file**
- **Found during:** Task 2 (post-GREEN)
- **Issue:** Three lines in the plan's literal test code (two `db_session.execute(select(...).where(...))` one-liners and one long test method signature) exceeded the 100-char Ruff limit
- **Fix:** Ran `ruff format`, which wrapped the offending lines
- **Files modified:** `backend/tests/test_admin_user_preferences.py`
- **Verification:** `ruff check`/`ruff format --check` clean; re-ran `pytest tests/test_admin_user_preferences.py -v` (8/8 still passing) after reformat
- **Committed in:** `faabedf` (Task 2 GREEN commit)

**3. [Router registration convention - not a defect] Wired router via `app/api/__init__.py` instead of the plan's literal `main.py` snippet**
- **Found during:** Task 2
- **Issue:** The plan's `<action>` block for wiring `main.py` assumed a direct `from app.api.admin_user_preferences import router as admin_user_preferences_router` import inside `main.py`, but `main.py` actually imports every router from the `app.api` package (`from app.api import (admin_crm_router, admin_users_router, ...)`), which itself re-exports from each submodule in `app/api/__init__.py`
- **Resolution:** Added the re-export line to `app/api/__init__.py` (alphabetically, matching the existing 26-router pattern) and imported `admin_user_preferences_router` from `app.api` in `main.py`, rather than importing directly from the submodule -- functionally identical routing behavior, fully consistent with every other router registration in the codebase
- **Files modified:** `backend/app/api/__init__.py`, `backend/app/main.py`
- **Verification:** `grep "admin_user_preferences_router" backend/app/main.py backend/app/api/__init__.py` matches; `python3 -c "from app.main import app"` succeeds; all 8 endpoint tests pass
- **Committed in:** `faabedf` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (2 blocking/lint, 1 convention adjustment)
**Impact on plan:** All fixes mechanical (lint formatting) or convention-alignment (router registration path) with zero behavioral difference from the plan's intent. No scope creep -- no files outside the plan's declared `files_modified` list were touched, and `personalization_injection_service.py` was deliberately left untouched per the plan's own ownership note.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `UserPreference` model, schemas, and full admin CRUD API are importable/tested and ready for 33-08's admin UI to consume `GET /api/v1/users/{user_id}/personalization` and the preference CRUD endpoints directly
- `personalization_injection_service.py`'s `_load_preferences()` now resolves `UserPreference` successfully with zero code changes -- 33-05's chat-turn prompt injection will automatically start including preference tags for any user with rows in `user_preferences`
- No blockers identified

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 5 created files verified present on disk; all 3 commit hashes (54b99dd, 92db39f, faabedf) verified present in `git log`.
