---
phase: 33-personalized-crm-excel-avatar
plan: 01
subsystem: database
tags: [sqlalchemy, alembic, openpyxl, regex, pii-redaction, prompt-injection, sanitization]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a
    provides: AvatarInteractionLog audit infrastructure, session lifecycle patterns, TimestampMixin conventions
provides:
  - UserCrmContext ORM model + Alembic migration (user_crm_contexts table)
  - personalization_sanitizer.py (sanitize_field, sanitize_free_text_with_pii) — double-gate PII/prompt-injection defense
  - crm_import_service.py (parse_and_import_crm_excel, generate_crm_template_workbook, CrmHeaderValidationError)
  - crm_max_file_size_bytes / crm_field_max_length / crm_notes_max_length config settings
affects: [33-02 (admin CRM upload API), 33-05 (prompt injection using this sanitizer), 33-08 (admin read view)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Double-gate sanitization: same sanitize_field()/sanitize_free_text_with_pii() called at write time (this plan) and again at prompt-injection time (33-05), no LLM-based review pass (D-06)"
    - "Digit-only lookaround `(?<!\\d)`/`(?!\\d)` instead of `\\b` for PII regexes touching CJK-adjacent digit runs (Python's \\b treats CJK chars as word chars)"
    - "Upsert-by-matched-user-id (never full-table replace) for re-uploadable admin data imports"

key-files:
  created:
    - backend/app/models/user_crm_context.py
    - backend/alembic/versions/c36a_personalization_crm_tables.py
    - backend/app/services/personalization_sanitizer.py
    - backend/app/services/crm_import_service.py
    - backend/tests/test_personalization_sanitizer.py
    - backend/tests/test_crm_import_service.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/config.py

key-decisions:
  - "Fixed digit-run PII regexes (id_card/bank_card/phone) to use (?<!\\d)/(?!\\d) lookaround instead of \\b, since Chinese text directly adjacent to digits (no space) does not create a \\b boundary in Python regex"

patterns-established:
  - "Sanitizer module is regex-only (no LLM call) per D-06 — auditable, deterministic, testable in isolation"
  - "CrmImportResult dataclass (success_count/skipped/unmatched) as the row-level reporting contract for tiered validation (D-04)"

requirements-completed: [PERS-01]

# Metrics
duration: 6min
completed: 2026-08-01
---

# Phase 33 Plan 01: CRM Excel Storage & Sanitization Foundation Summary

**UserCrmContext table + regex-only double-gate sanitizer (PII redaction + prompt-injection stripping) + Excel parse/upsert service enforcing fixed-template header validation and email-match upsert.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-01T10:55:26Z
- **Completed:** 2026-08-01
- **Tasks:** 3 completed
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- `UserCrmContext` ORM model + Alembic migration (`c36a_personalization_crm_tables`, chained on `b35a_add_anonymous_avatar_tables`) — clean `alembic upgrade head`
- `personalization_sanitizer.py`: `sanitize_field()` (control-char/delimiter/injection-phrase stripping + truncation) and `sanitize_free_text_with_pii()` (adds ID-card/bank-card/phone/email regex redaction) — 12/12 tests passing
- `crm_import_service.py`: `parse_and_import_crm_excel()` with strict header validation (`CrmHeaderValidationError`), case-insensitive email matching, upsert-by-user_id (D-03), row-level skip/unmatched reporting without raising (D-04), and `generate_crm_template_workbook()` — 7/7 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: UserCrmContext model + Alembic migration + config settings** - `d0ef1ef` (feat) + `e30a090` (chore: ruff-format line-length fix)
2. **Task 2: Sanitizer module (double-gate foundation, D-06/D-07)** - `2641fbf` (test, RED) → `29d50c7` (feat, GREEN)
3. **Task 3: CRM Excel parse/validate/upsert service + template generator** - `689689f` (test, RED) → `c80264a` (feat, GREEN)

_TDD tasks 2 and 3 each had two commits (test → feat), per plan._

## Files Created/Modified
- `backend/app/models/user_crm_context.py` - `UserCrmContext` ORM model (user_id unique FK, customer_name, company, role, crm_notes, contact_person)
- `backend/alembic/versions/c36a_personalization_crm_tables.py` - migration creating `user_crm_contexts` table + unique index on `user_id`
- `backend/app/models/__init__.py` - registered `UserCrmContext` in package exports
- `backend/app/config.py` - added `crm_max_file_size_bytes`, `crm_field_max_length`, `crm_notes_max_length`
- `backend/app/services/personalization_sanitizer.py` - `sanitize_field()`, `sanitize_free_text_with_pii()`
- `backend/app/services/crm_import_service.py` - `parse_and_import_crm_excel()`, `generate_crm_template_workbook()`, `CrmHeaderValidationError`, `CrmImportResult`
- `backend/tests/test_personalization_sanitizer.py` - 12 tests covering every documented sanitizer behavior
- `backend/tests/test_crm_import_service.py` - 7 tests covering header validation, upsert, skip/unmatched, PII redaction on persist, re-upload update-not-duplicate, template generator

## Decisions Made
- Fixed PII digit-run regexes (id_card, bank_card, phone) to use `(?<!\d)`/`(?!\d)` lookaround instead of `\b` — Python's `\b` treats CJK characters as word characters, so a digit run directly following Chinese text with no space (e.g. `联系电话13812345678`) never had a `\b` boundary and silently failed to match. This was caught by the plan's own behavior spec (`sanitize_free_text_with_pii("联系电话13812345678")`), which is exactly this pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `slowapi` dependency in venv**
- **Found during:** Task 2 (first test run)
- **Issue:** `tests/conftest.py` imports `app.main`, which imports `slowapi` (declared in `pyproject.toml` but not installed in the available Python environment), blocking every test collection.
- **Fix:** `pip install slowapi` into the environment's venv (declared dependency, not a new one).
- **Files modified:** none (environment-only, no repo changes)
- **Verification:** `pytest` collection succeeds afterward.
- **Committed in:** N/A (no file changes)

**2. [Rule 1 - Bug] PII regex `\b` boundary silently fails on CJK-adjacent digits**
- **Found during:** Task 2 (GREEN run — 2 of 12 sanitizer tests failed: phone and ID-card redaction)
- **Issue:** `re.compile(r"\b\d{17}[\dXx]\b")` and the phone/bank-card equivalents never matched digits directly preceded by Chinese characters, because Python's `\b` treats Unicode word characters (including CJK) as word chars — there's no transition, hence no boundary, between "证" and "1".
- **Fix:** Replaced `\b` with digit-only lookaround `(?<!\d)` / `(?!\d)` for the three digit-run patterns (id_card, bank_card, phone); left the email pattern's `\b` unchanged since it tested correctly.
- **Files modified:** `backend/app/services/personalization_sanitizer.py`
- **Verification:** All 12 sanitizer tests pass, including the exact `"联系电话13812345678"` and `"身份证110101199001011234"` cases from the plan's `<behavior>` spec.
- **Committed in:** `29d50c7` (Task 2 GREEN commit)

**3. [Rule 3 - Blocking] Ruff line-length (E501) failures on plan-provided code**
- **Found during:** post-implementation lint pass (Tasks 1 and 3)
- **Issue:** Two lines in the plan's literal code blocks (`user_crm_context.py`'s `user_id` mapped_column call, and `crm_import_service.py`'s `crm_notes` assignment) plus two test lines exceeded the project's 100-char Ruff limit.
- **Fix:** `ruff format` (auto-wrap), verified `ruff check` passes clean afterward on all 8 touched files.
- **Files modified:** `backend/app/models/user_crm_context.py`, `backend/app/services/crm_import_service.py`, `backend/tests/test_crm_import_service.py`
- **Verification:** `ruff check` and `ruff format --check` both pass on every file touched by this plan.
- **Committed in:** `e30a090` (model fix), `c80264a` (service + test fix, part of Task 3 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking/environment, 1 bug, 1 blocking/lint)
**Impact on plan:** All fixes necessary for correctness (PII redaction must actually work) or for passing the CLAUDE.md-mandated pre-commit lint gate. No scope creep — no files outside the plan's declared `files_modified` list were touched.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `UserCrmContext` table, sanitizer, and import service are all importable and fully unit-tested; ready for 33-02 to build the admin upload API endpoint on top of `parse_and_import_crm_excel()` / `generate_crm_template_workbook()`.
- 33-05 (prompt injection) can import `personalization_sanitizer` directly for the second sanitization gate at prompt-build time.
- No blockers identified.

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 6 created files verified present on disk; all 6 commit hashes (d0ef1ef, e30a090, 2641fbf, 29d50c7, 689689f, c80264a) verified present in git log.
