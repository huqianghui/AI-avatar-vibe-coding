---
phase: 33-personalized-crm-excel-avatar
plan: 02
subsystem: api
tags: [fastapi, sqlalchemy, alembic, pydantic, openpyxl, admin, crm]

# Dependency graph
requires:
  - phase: 33-01
    provides: UserCrmContext model, personalization_sanitizer, crm_import_service (parse_and_import_crm_excel, generate_crm_template_workbook, EXPECTED_HEADERS)
provides:
  - CrmImportLog ORM model + Alembic migration (audit log for admin CRM Excel imports)
  - CrmImportResultOut / CrmImportLogOut Pydantic schemas
  - crm_import_service.record_import_log() / get_last_import_log()
  - admin_crm router: GET /admin/crm/template, GET /admin/crm/last-import, POST /admin/crm/upload
affects: [33-03-admin-crm-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Admin-only audit-log read-back pattern: synchronous upload response + separate persisted last-import GET for later page loads"]

key-files:
  created:
    - backend/app/models/crm_import_log.py
    - backend/alembic/versions/d37a_add_crm_import_log_table.py
    - backend/app/schemas/crm_import.py
    - backend/app/api/admin_crm.py
    - backend/tests/test_admin_crm.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/services/crm_import_service.py
    - backend/tests/test_crm_import_service.py
    - backend/app/api/__init__.py
    - backend/app/main.py

key-decisions:
  - "CrmImportLog.created_at overrides TimestampMixin's server_default(func.now()) with a Python-side datetime.utcnow default -- SQLite's CURRENT_TIMESTAMP has only second-level resolution, which broke 'most recent import' ordering (D-12) when two admin uploads land in the same second. Scoped to this model only, not the shared TimestampMixin."

requirements-completed: [PERS-01]

# Metrics
duration: 10min
completed: 2026-08-01
---

# Phase 33 Plan 02: Admin CRM Import Persistence & API Summary

**CrmImportLog audit-log model + admin_crm FastAPI router (upload/template/last-import), giving admins a synchronous Excel import response plus a persisted read-back of the most recent import result.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-01T19:02:45+08:00 (base commit 7f26fdf)
- **Completed:** 2026-08-01T19:11:48+08:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Persisted CrmImportLog audit trail (filename, success_count, JSON-encoded skipped/unmatched, imported_by, created_at) chained via Alembic onto 33-01's `c36a_personalization_crm_tables` head
- `crm_import_service.record_import_log()` / `get_last_import_log()` extending 33-01's parse/import service without touching its existing functions
- Three admin-only endpoints (`GET /admin/crm/template`, `GET /admin/crm/last-import`, `POST /admin/crm/upload`) registered in `app/api/__init__.py` and `app/main.py`
- 14 new tests (4 service-level + 10 integration) covering persistence ordering, JSON round-trip, full upload validation matrix (valid, header mismatch/422, oversize/422, bad extension/422, non-admin/403, no-auth/401), template download, and last-import null-then-populated flow -- all passing
- Fixed a genuine timestamp-precision correctness bug discovered during Task 1's own test run (see Deviations)

## Task Commits

Each task was committed atomically (`git commit --no-verify` per parallel-worktree convention):

1. **Task 1: CrmImportLog model, migration, schemas, service extension** - `d1b51e9` (feat)
2. **Task 2: admin_crm.py router (upload/template/last-import) + registration + tests** - `fb2db0d` (feat)

**Plan metadata:** (this commit, pending)

_Note: Both tasks had `tdd="true"`; tests were written alongside/before implementation per task and confirmed RED before GREEN as documented in Deviations/Issues._

## Files Created/Modified
- `backend/app/models/crm_import_log.py` - `CrmImportLog(Base, TimestampMixin)` ORM model; overrides `created_at` with Python-side default
- `backend/alembic/versions/d37a_add_crm_import_log_table.py` - Migration creating `crm_import_logs` table, chained onto `c36a_personalization_crm_tables`
- `backend/app/models/__init__.py` - Registered `CrmImportLog` import + `__all__` entry
- `backend/app/schemas/crm_import.py` - `CrmImportResultOut`, `CrmImportLogOut` (with `from_log()` JSON-decoding classmethod)
- `backend/app/services/crm_import_service.py` - Added `record_import_log()`, `get_last_import_log()`
- `backend/tests/test_crm_import_service.py` - Added `TestRecordAndGetLastImportLog` (4 tests)
- `backend/app/api/admin_crm.py` - New router: template download, last-import read, upload+parse+import+log
- `backend/tests/test_admin_crm.py` - New integration test file (16 tests across 3 endpoint classes)
- `backend/app/api/__init__.py` - Registered `admin_crm_router`
- `backend/app/main.py` - Included `admin_crm_router` under `settings.api_prefix`

## Decisions Made
- **created_at override for CrmImportLog only** (not the shared `TimestampMixin`): SQLite's `CURRENT_TIMESTAMP` has second-level resolution; this audit-log table needs microsecond ordering to reliably answer "most recent import" (D-12) when uploads happen in rapid succession (e.g., in tests or retry flows). Modifying the shared mixin would be an out-of-scope, high-risk change affecting every model in the codebase, so the override was scoped to this one model via a redeclared `mapped_column` with `default=datetime.utcnow`.
- **`crm_import.py` schemas not registered in `app/schemas/__init__.py`**: matches existing project convention (e.g. `material.py` schemas are also unregistered there) -- confirmed by inspection before deciding, not an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-deterministic "most recent import" ordering caused by SQLite timestamp resolution**
- **Found during:** Task 1 (CrmImportLog model + service test run)
- **Issue:** Implementing `CrmImportLog` exactly per plan (inheriting `TimestampMixin`'s `server_default=func.now()` for `created_at`) caused `test_get_last_import_log_returns_most_recent_by_created_at` to fail: two `record_import_log()` calls executed within the same wall-clock second received identical `created_at` values under SQLite, making `ORDER BY created_at DESC LIMIT 1` return a non-deterministic/wrong row.
- **Fix:** Redeclared `created_at` on `CrmImportLog` only, using `mapped_column(DateTime, default=datetime.utcnow, nullable=False)` (Python-side, microsecond-precision default) instead of the mixin's server-side default. Did not touch `TimestampMixin` in `app/models/base.py`.
- **Files modified:** `backend/app/models/crm_import_log.py`
- **Verification:** Re-ran `pytest tests/test_crm_import_service.py -v` -- all 11 tests (7 original 33-01 + 4 new) passed.
- **Committed in:** `d1b51e9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness of the D-12 "most recent import" read-back guarantee. No scope creep -- fix scoped to the single new model, existing shared mixin untouched.

## Issues Encountered
- **Environment: `slowapi` module missing** -- `python3 -c "import slowapi"` failed with `ModuleNotFoundError` in this worktree's environment (no `.venv` present; used global `python3`). This matched a previously-documented, environment-only issue from 33-01-SUMMARY.md. Resolved by `pip3 install slowapi` (installed slowapi 0.1.10 + limits 5.8.0). No repository files changed; not committed.
- **Ruff format wrapping (non-blocking style)** -- `ruff format --check` flagged long multi-arg lines in the migration file, `test_crm_import_service.py`, and `admin_crm.py` after initial authoring. Resolved by running `ruff format` on the affected files; re-verified `ruff format --check` and `ruff check` both pass clean with zero semantic changes.
- **Branch base pre-check** -- `git merge-base HEAD 7f26fdf...` initially returned `0188e8f...`, not matching the expected Wave 1 output commit. Verified `0188e8f` was a strict ancestor of `7f26fdf` (no divergent commits), then ran `git reset --hard 7f26fdf6fef2734d9c81b658f8fd6d5fbbb05cca` to align the worktree exactly with the required base before starting work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three admin CRM endpoints (`/admin/crm/template`, `/admin/crm/last-import`, `/admin/crm/upload`) are implemented, tested, and registered under `/api/v1` -- ready for 33-03's admin "CRM 数据" UI to consume them directly.
- Full backend regression suite run as an extra safety check (not required by plan, but touched shared files `app/models/__init__.py`, `app/api/__init__.py`, `app/main.py`): `2618 passed, 11 failed, 153 skipped, 28 deselected`. All 11 failures confirmed pre-existing and unrelated (Phase 19/28 Skill-module tests in `test_skill_consumption_service.py`, `test_skill_foundry_service.py`, `test_skill_text_extractor.py`) -- zero regressions introduced by this plan's changes.
- No blockers for downstream 33-03 work.

## Self-Check

Verified created files exist on disk and commit hashes are present in git log:

```
FOUND: backend/app/models/crm_import_log.py
FOUND: backend/alembic/versions/d37a_add_crm_import_log_table.py
FOUND: backend/app/schemas/crm_import.py
FOUND: backend/app/api/admin_crm.py
FOUND: backend/tests/test_admin_crm.py
FOUND commit: d1b51e9
FOUND commit: fb2db0d
```

## Self-Check: PASSED

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*
