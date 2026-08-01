---
phase: 33-personalized-crm-excel-avatar
plan: 03
subsystem: frontend
tags: [react, typescript, tanstack-query, react-dropzone, vitest, playwright, admin, crm]

# Dependency graph
requires:
  - phase: 33-02
    provides: admin_crm router (POST /admin/crm/upload, GET /admin/crm/template, GET /admin/crm/last-import)
provides:
  - CrmImportRowIssue / CrmImportResult / CrmImportLog TypeScript type contracts
  - crm.ts API client (uploadCrmExcel, downloadCrmTemplate, getLastCrmImport)
  - use-crm-import.ts TanStack Query hooks (useUploadCrmExcel, useLastCrmImport, useDownloadCrmTemplate)
  - /admin/crm-data admin page (dropzone upload, template download, last-import result card)
  - Admin sidebar "CRM 数据" nav entry + router wiring
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Stateful page.route() mocks for TanStack Query mutation-invalidation E2E flows: a route handler that mutates a closure variable before fulfilling lets a subsequent refetch (triggered by queryClient.invalidateQueries) observe post-mutation state without a live backend"]

key-files:
  created:
    - frontend/src/types/crm.ts
    - frontend/src/api/crm.ts
    - frontend/src/hooks/use-crm-import.ts
    - frontend/src/pages/admin/crm-data.tsx
    - frontend/src/pages/admin/crm-data.test.tsx
    - frontend/e2e/admin-crm-data.spec.ts
  modified:
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/nav.json
    - frontend/public/locales/en-US/nav.json
    - frontend/src/components/layouts/admin-layout.tsx
    - frontend/src/router/index.tsx

key-decisions:
  - "E2E upload-success/skipped-unmatched tests use a mutable closure variable in the page.route() handler for GET /admin/crm/last-import rather than a fixed JSON body -- the upload mutation invalidates the ['crm-import','last'] query on success, and the result card only updates via that refetch, not the upload response itself. A static mock would leave the result card stuck on the pre-upload (null) state."

requirements-completed: [PERS-01]

# Metrics
duration: 15min
completed: 2026-08-01
---

# Phase 33 Plan 03: Admin CRM Data Upload UI Summary

**React admin page for CRM Excel upload/parse/store (dropzone + TanStack Query), completing PERS-01 end-to-end with the destructive-banner/result-card mutual exclusivity required by 33-UI-SPEC.md's Interaction States contract.**

## Performance

- **Duration:** ~15 min (task commits span 19:23-19:38+08:00, off base commit `83e1416`)
- **Started:** 2026-08-01T19:23+08:00
- **Completed:** 2026-08-01T19:38+08:00
- **Tasks:** 3
- **Files created/modified:** 16 (6 created, 10 modified/appended)

## Accomplishments
- Typed CRM API/hook layer (`crm.ts`, `use-crm-import.ts`, `types/crm.ts`) mirroring `materials.ts`'s upload/blob-download conventions, with cache invalidation on upload success
- Full i18n coverage (4 locale files: zh-CN/en-US × admin/nav namespaces) for the new `crmData` feature keys plus `errors.crmUploadFailed`
- `/admin/crm-data` page: dropzone upload with 4MB/.xlsx client-side guard, template download, last-import result card (success/skipped/unmatched badges + collapsible row-level detail), and a destructive 422 header-mismatch banner that is strictly mutually exclusive with the result card in the same render pass
- Sidebar nav entry (`Database` icon) and lazy-loaded route wired into the existing `AdminLayout`/`AdminRoute` guard, matching every other admin page's pattern
- 5 vitest component tests (title/description, empty state, populated summary, upload-button enable/disable via captured `onDrop`, 422 banner/result-card exclusivity) — all passing, zero `act()` warnings
- 5 Playwright E2E scenarios (empty state, successful upload, 422 rejection banner, template download via real browser download event, non-error skipped/unmatched tone) — all passing against the real dev server + backend with `page.route()` mocking, no live-backend dependency
- `npx tsc -b` passes with zero errors across all new/modified files

## Task Commits

Each task was committed atomically (`git commit --no-verify` per parallel-worktree convention):

1. **Task 1: CRM types, API client, TanStack Query hooks, i18n strings** - `e417a98` (feat)
2. **Task 2: CRM Data admin page + sidebar/router wiring + component tests** - `3dbaeb3` (feat)
3. **Task 3: Playwright E2E coverage for the CRM Data admin flow** - `06ce718` (test)

**Plan metadata:** (this commit, pending)

_Note: Tasks 1 and 2 had `tdd="true"`; verification (tsc/JSON validity for Task 1, vitest+tsc for Task 2) was run and confirmed passing before each commit. Task 3 (E2E, no `tdd` flag) was implemented then iterated once to fix two initially-failing scenarios (see Deviations)._

## Files Created/Modified
- `frontend/src/types/crm.ts` - `CrmImportRowIssue`, `CrmImportResult`, `CrmImportLog` type contracts
- `frontend/src/api/crm.ts` - `uploadCrmExcel()`, `downloadCrmTemplate()`, `getLastCrmImport()`
- `frontend/src/hooks/use-crm-import.ts` - `useUploadCrmExcel()`, `useLastCrmImport()`, `useDownloadCrmTemplate()`
- `frontend/public/locales/{zh-CN,en-US}/admin.json` - `crmData.*` (19 keys) + `errors.crmUploadFailed`
- `frontend/public/locales/{zh-CN,en-US}/nav.json` - `crmData` sidebar label
- `frontend/src/pages/admin/crm-data.tsx` - CRM Data admin page (default export)
- `frontend/src/pages/admin/crm-data.test.tsx` - 5 vitest component tests
- `frontend/src/components/layouts/admin-layout.tsx` - `Database` icon import + sidebar nav entry after `settings`
- `frontend/src/router/index.tsx` - `CrmDataPage` lazy import + `/admin/crm-data` route
- `frontend/e2e/admin-crm-data.spec.ts` - 5 Playwright E2E scenarios

## Decisions Made
- **Stateful `page.route()` mocks in E2E tests for upload-success paths**: `useUploadCrmExcel()`'s `onSuccess` invalidates `["crm-import","last"]`, causing `useLastCrmImport()` to refetch `GET /admin/crm/last-import` after a successful upload. A route mock with a fixed `null` body for that endpoint would never reflect the post-upload state, since the result card is driven by the refetch, not the upload response. Fixed by capturing a mutable closure variable that the upload route handler updates before fulfilling, which the last-import route handler then serves on the subsequent refetch. This is a reusable pattern documented in `tech-stack.patterns` above for any future TanStack Query mutation-invalidation E2E test in this codebase.
- **Per-file `@/components/ui/*` imports** (not the barrel `@/components/ui` import used by `admin-layout.tsx`) for `crm-data.tsx`, matching `training-materials.tsx`'s convention rather than `admin-layout.tsx`'s — both are valid per the barrel file re-exporting the same symbols; chosen to match the more directly analogous upload-page donor.
- **Exactly 5 E2E test cases** in `admin-crm-data.spec.ts` (no extra non-admin-access test), strictly matching the plan's acceptance criterion ("contains exactly 5 test cases") even though the donor `admin-training-materials.spec.ts` includes a 6th non-admin-redirect test in a separate `describe` block. Route-guard behavior for `/admin/*` is already covered generically elsewhere in the E2E suite (e.g. `admin-training-materials.spec.ts`'s own non-admin test), so omitting a duplicate here is not a coverage gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale last-import mock causing 2 E2E test failures on first run**
- **Found during:** Task 3, first `npx playwright test` run
- **Issue:** "successful upload shows result summary" and "skipped/unmatched counts render in non-error tone" both timed out waiting for the result card to update after upload. Root cause: both tests mocked `GET /admin/crm/last-import` with a static `null` body, but the page's result card only updates via `useLastCrmImport()`'s refetch triggered by `useUploadCrmExcel()`'s `queryClient.invalidateQueries()` call on success — not from the upload mutation's own response payload. The static mock kept returning `null` on the post-upload refetch, so the result card never left its empty state.
- **Fix:** Introduced a mutable `let lastImport: unknown = null` closure variable in each affected test; the `POST /admin/crm/upload` route handler now sets `lastImport` to the expected post-upload payload before fulfilling, and the `GET /admin/crm/last-import` route handler serves the current value of `lastImport` on every request (including the refetch after invalidation).
- **Files modified:** `frontend/e2e/admin-crm-data.spec.ts`
- **Verification:** Re-ran `npx playwright test admin-crm-data.spec.ts --config=e2e/playwright.config.ts` — all 5 tests (7 including the 2 auth-setup tests) passed.
- **Committed in:** `06ce718` (Task 3 commit; fix applied before the single Task 3 commit, not as a separate commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, test-only, no application code changed)
**Impact on plan:** No scope creep — the underlying `crm-data.tsx` implementation was already correct (it does rely on cache invalidation, exactly as the plan's Task 2 `<behavior>` specifies); the bug was solely in the Task 3 test mocks not modeling that behavior. Fixed before the first (and only) Task 3 commit, so no separate fix-up commit was needed.

## Issues Encountered
- **Environment: `node_modules` entirely missing in this worktree** — `npx tsc -b` initially failed with dozens of `TS2307: Cannot find module` errors across many pre-existing files (not just this plan's new files). Resolved by running `npm ci` (installed 644 packages). This matches the previously-documented pattern of environment-only gaps in fresh parallel worktrees (analogous to the `slowapi` missing-dependency issue noted in 33-01-SUMMARY.md and 33-02-SUMMARY.md for the backend). No repository files changed; not committed.
- **Environment: backend Python deps** — `python3 -c "import fastapi, sqlalchemy, slowapi"` succeeded via the system Python (no `.venv` present in this worktree), so the Playwright `webServer` config's `uvicorn app.main:app --port 8000` command started cleanly with no additional installs required for this plan's E2E run.
- **Playwright auth state** — `frontend/e2e/.auth/` did not yet exist in this worktree; the `setup` project (`auth.setup.ts`) ran automatically as a dependency of the `chromium` project (per `playwright.config.ts`'s `dependencies: ["setup"]`), creating `admin.json`/`user.json` storage state files with no manual intervention needed.

## User Setup Required

None — no external service configuration required. All E2E tests use `page.route()` mocking exclusively; no live backend data dependency beyond the auth-setup login flow (which uses seeded admin/user credentials already present in this environment).

## Next Phase Readiness

- PERS-01 is now fully implemented end-to-end across all three plans in this phase:
  - **33-01** (data layer): `UserCrmContext` model, `personalization_sanitizer`, `crm_import_service` (parse/validate/upsert)
  - **33-02** (API): `CrmImportLog` audit persistence + `admin_crm` router (`POST /admin/crm/upload`, `GET /admin/crm/template`, `GET /admin/crm/last-import`)
  - **33-03** (this plan, admin UI): typed API/hook layer, `/admin/crm-data` page, sidebar nav, full vitest + Playwright coverage
- An admin can now perform the complete CRM-mapping-table workflow (download template → fill → upload → view success/skipped/unmatched result, with correct destructive/non-destructive tone separation) entirely through the UI, with no direct database or API client access required.
- No blockers for downstream phases. This is the final plan in phase 33-personalized-crm-excel-avatar.

## Self-Check

Verified created files exist on disk and commit hashes are present in git log:

```
FOUND: frontend/src/types/crm.ts
FOUND: frontend/src/api/crm.ts
FOUND: frontend/src/hooks/use-crm-import.ts
FOUND: frontend/src/pages/admin/crm-data.tsx
FOUND: frontend/src/pages/admin/crm-data.test.tsx
FOUND: frontend/e2e/admin-crm-data.spec.ts
FOUND commit: e417a98
FOUND commit: 3dbaeb3
FOUND commit: 06ce718
```

## Self-Check: PASSED

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*
