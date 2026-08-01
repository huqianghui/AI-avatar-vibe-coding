---
phase: 33-personalized-crm-excel-avatar
reviewed: 2026-08-01T00:00:00Z
depth: standard
files_reviewed: 67
files_reviewed_list:
  - backend/app/services/personalization_sanitizer.py
  - backend/app/services/personalization_injection_service.py
  - backend/app/api/personalized_avatar.py
  - backend/app/api/admin_crm.py
  - backend/app/api/admin_user_preferences.py
  - backend/app/services/personalized_avatar_service.py
  - backend/app/services/personalized_session_service.py
  - backend/app/services/crm_import_service.py
  - backend/app/services/rate_limit.py
  - backend/app/services/agent_chat_service.py
  - backend/app/schemas/personalized_avatar.py
  - backend/app/schemas/user_preference.py
  - backend/app/schemas/crm_import.py
  - backend/app/models/user_crm_context.py
  - backend/app/models/user_preference.py
  - backend/app/models/personalized_avatar_session.py
  - backend/app/models/crm_import_log.py
  - backend/app/models/avatar_interaction_log.py
  - backend/alembic/versions/c36a_personalization_crm_tables.py
  - backend/alembic/versions/d37a_add_crm_import_log_table.py
  - backend/alembic/versions/d37a_personalized_avatar_session.py
  - backend/alembic/versions/d37a_user_preference_table.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/app/api/__init__.py
  - backend/app/models/__init__.py
  - backend/tests/test_admin_crm.py
  - backend/tests/test_personalization_sanitizer.py
  - backend/tests/test_personalized_avatar_api.py
  - backend/tests/test_admin_user_preferences.py
  - backend/tests/test_crm_import_service.py
  - backend/tests/test_personalization_injection_service.py
  - backend/tests/test_personalized_avatar_service.py
  - backend/tests/test_personalized_session_service.py
  - backend/tests/test_agent_chat_service.py
  - frontend/src/api/personalized-avatar.ts
  - frontend/src/api/personalized-avatar.test.ts
  - frontend/src/api/user-preferences.ts
  - frontend/src/api/user-preferences.test.ts
  - frontend/src/api/crm.ts
  - frontend/src/types/crm.ts
  - frontend/src/hooks/use-personalized-avatar-chat.ts
  - frontend/src/hooks/use-personalized-avatar-chat.test.tsx
  - frontend/src/hooks/use-personalized-avatar-session.ts
  - frontend/src/hooks/use-personalized-avatar-session.test.ts
  - frontend/src/hooks/use-user-preferences.ts
  - frontend/src/hooks/use-user-preferences.test.ts
  - frontend/src/hooks/use-crm-import.ts
  - frontend/src/pages/avatar-page.tsx
  - frontend/src/pages/avatar-page.test.tsx
  - frontend/src/pages/admin/crm-data.tsx
  - frontend/src/pages/admin/crm-data.test.tsx
  - frontend/src/pages/admin/users.tsx
  - frontend/src/pages/admin/users.test.tsx
  - frontend/src/components/admin/user-personalization-dialog.tsx
  - frontend/src/components/admin/user-personalization-dialog.test.tsx
  - frontend/src/router/index.tsx
  - frontend/src/components/layouts/admin-layout.tsx
  - frontend/public/locales/en-US/admin.json
  - frontend/public/locales/zh-CN/admin.json
  - frontend/public/locales/en-US/avatar.json
  - frontend/public/locales/zh-CN/avatar.json
  - frontend/public/locales/en-US/nav.json
  - frontend/public/locales/zh-CN/nav.json
  - frontend/e2e/admin-crm-data.spec.ts
  - frontend/e2e/admin-user-personalization.spec.ts
  - frontend/e2e/personalized-avatar-qa.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-08-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 67
**Status:** issues_found

## Summary

Phase 33 implements PERS-01 (CRM Excel import with prompt-injection sanitization), PERS-02 (personalized avatar sessions with context injection), and PERS-03 (admin preference management). The review focused specifically on the five explicitly requested security-sensitive areas, all of which check out as correctly implemented:

- **Double-gate prompt-injection sanitization**: `personalization_sanitizer.py` sanitizes at write-time (CRM import / admin preference CRUD), and `personalization_injection_service.py` independently re-sanitizes the same fields at read-time immediately before building the "## User Background" prompt segment — a genuine second gate, not a passthrough. PII redaction (ID card / bank card / phone / email regexes) is layered on top of general control-character/delimiter/injection-phrase stripping, with correct regex ordering (18-digit ID card checked before 16–19-digit bank card) and a documented rationale for the digit-only lookaround design (CJK `\b` incompatibility).
- **IDOR protection**: `get_owned_session()` in `personalized_session_service.py` collapses missing/foreign/expired/revoked sessions into a single indistinguishable `not_found()` — verified against dedicated tests. `admin_user_preferences.py`'s update/delete routes filter by the compound `(preference_id, user_id)` pair, confirmed IDOR-safe by `test_delete_with_wrong_user_id_returns_404_and_does_not_delete`. The chat route in `personalized_avatar.py` calls the ownership check before invoking the (expensive, potentially leaky) agent.
- **Admin-only route guards**: All three `admin_crm.py` routes and all `admin_user_preferences.py` routes are gated by `Depends(require_role("admin"))`. Frontend mirrors this with `AdminRoute` wrapping `/admin/crm-data` in `router/index.tsx`.
- **File upload handling**: Extension allowlist (`.xlsx` only), size-limit enforcement, and header-validation-driven rejection are all present and tested — see Warnings below for two robustness gaps in the exact sequencing/exception handling.
- **PII containment**: `PersonalizationSummary` schema and `UserPersonalizationDialog.tsx` both expose only `customer_name`/`company` — never `crm_notes`/`contact_person`. This is backed by an explicit e2e regression guard (`FORBIDDEN_CRM_TERMS` check in `personalized-avatar-qa.spec.ts` and an equivalent unit-test assertion in `avatar-page.test.tsx`) that scans the full rendered DOM text for CRM-internal field names and Chinese match-status terms, and by a unit test in `user-personalization-dialog.test.tsx` asserting `crm_notes`/`contact_person` are never present.

No critical issues were found. Two warning-level findings relate to the file-upload endpoint's size-check ordering and exception handling; two info-level observations are noted for completeness.

## Warnings

### WR-01: File is fully buffered into memory before the size limit is enforced

**File:** `backend/app/api/admin_crm.py:63-68`
**Issue:** `content = await file.read()` reads the entire uploaded file into memory *before* `len(content) > settings.crm_max_file_size_bytes` is checked. An attacker (or a mistaken admin) uploading a very large file will have the full payload buffered in server memory prior to rejection, defeating the intent of the size limit as a resource-exhaustion guard. `UploadFile` supports chunked reads (`file.read(chunk_size)`) that can enforce the limit incrementally.
**Fix:**
```python
MAX_READ = settings.crm_max_file_size_bytes
chunks: list[bytes] = []
total = 0
while chunk := await file.read(1024 * 1024):
    total += len(chunk)
    if total > MAX_READ:
        bad_request(
            f"File size exceeds maximum of {MAX_READ // (1024 * 1024)}MB"
        )
    chunks.append(chunk)
content = b"".join(chunks)
```

### WR-02: Non-header-validation exceptions from the Excel parser are not caught

**File:** `backend/app/api/admin_crm.py:70-73`
**Issue:** The `try/except` around `parse_and_import_crm_excel()` only catches `CrmHeaderValidationError`. A corrupt or non-`.xlsx`-formatted file (e.g. a renamed `.csv`, a truncated binary, or a password-protected workbook) will raise an uncaught `openpyxl` exception (e.g. `zipfile.BadZipFile`, `KeyError`), which falls through to the generic global exception handler and returns a 500 rather than the intended 422 "expected format" contract described in the endpoint's own docstring (D-04).
**Fix:**
```python
try:
    result = await crm_import_service.parse_and_import_crm_excel(db, content)
except CrmHeaderValidationError as exc:
    bad_request(str(exc))
except Exception as exc:  # openpyxl parse failures, corrupt workbook, etc.
    bad_request(f"Could not read the uploaded file as a valid .xlsx workbook: {exc}")
```

## Info

### IN-01: Raw email addresses surface in the `unmatched` result/log without redaction

**File:** `backend/app/services/crm_import_service.py` (unmatched-row construction); also `backend/app/schemas/crm_import.py:CrmImportResultOut`/`CrmImportLogOut`, and rendered in `frontend/src/pages/admin/crm-data.tsx`
**Issue:** Rows that don't match any existing user are surfaced with their raw `user_email` value in both the synchronous upload response and the persisted `CrmImportLog.unmatched` field. This is PII, and unlike CRM notes/contact fields it is not passed through the sanitizer (nor does it need to be, since it is never injected into a prompt) — but it is stored unredacted in the audit log table and shown verbatim in the admin UI. Risk is low since this data is visible only to admins (who already uploaded the source file), and it is never sent to an LLM.
**Fix:** No action strictly required. If audit-log data retention policy requires PII minimization at rest, consider truncating/hashing the email in `CrmImportLog.unmatched` (e.g., `j***@domain.com`) while keeping the full value only in the transient (non-persisted) API response.

### IN-02: No edit-in-place UI for existing preference values

**File:** `frontend/src/components/admin/user-personalization-dialog.tsx`
**Issue:** The backend supports `PUT /users/{user_id}/preferences/{preference_id}` (via `useUpdatePreference` in `use-user-preferences.ts`, fully tested), but the dialog only exposes add (`handleAdd`) and delete (`handleDelete`) — there is no affordance to edit a preference's value in place. Admins must delete and re-add to change a value.
**Fix:** Not a security or correctness issue — a UX completeness gap. If in scope for this phase, add an inline edit control (e.g., click-to-edit on the badge) wired to `useUpdatePreference`.

---

_Reviewed: 2026-08-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
