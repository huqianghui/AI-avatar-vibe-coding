---
phase: 33-personalized-crm-excel-avatar
plan: 08
subsystem: ui
tags: [react, typescript, tanstack-query, playwright, i18n, radix-ui]

# Dependency graph
requires:
  - phase: 33-personalized-crm-excel-avatar (33-07)
    provides: backend CRUD endpoints for user preferences and personalization summary (GET/POST/PUT/DELETE /users/{user_id}/preferences, /personalization)
provides:
  - Typed frontend API client (user-preferences.ts) and TanStack Query hooks (use-user-preferences.ts) for preference CRUD
  - UserPersonalizationDialog component: read-only CRM match status + preference chip list + add-row, wired into admin Users page action menu
  - Bilingual (zh-CN/en-US) i18n strings for the personalization dialog
  - Playwright E2E coverage of the full admin personalization workflow (open, add, delete+undo)
affects: [phase-34, any-future-personalization-consumer, admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Query hook + typed API object-of-methods pattern extended to a new domain (user-preferences), mirroring users.ts/use-users.ts exactly"
    - "Non-blocking delete via direct mutation + sonner toast.success(...).action Undo affordance (no window.confirm/blocking Dialog)"

key-files:
  created:
    - frontend/src/api/user-preferences.ts
    - frontend/src/api/user-preferences.test.ts
    - frontend/src/hooks/use-user-preferences.ts
    - frontend/src/hooks/use-user-preferences.test.ts
    - frontend/src/components/admin/user-personalization-dialog.tsx
    - frontend/src/components/admin/user-personalization-dialog.test.tsx
    - frontend/e2e/admin-user-personalization.spec.ts
  modified:
    - frontend/src/pages/admin/users.tsx
    - frontend/src/pages/admin/users.test.tsx
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/admin.json

key-decisions:
  - "Used real seeded backend user 'Zhang Wei' (user1) in the new E2E spec instead of the plan's suggested 'Alice Wang', which does not exist in backend/scripts/seed_data.py and only appears in frontend unit-test mocks"
  - "Fixed a self-introduced regression by mocking @/hooks/use-user-preferences in users.test.tsx (unconditional dialog mount needs a QueryClientProvider or hook mock even when closed)"

patterns-established:
  - "Admin dialogs that read live server state via TanStack Query must be mocked at the hook level in any test that renders their parent page, even when the dialog's `open` prop is false, since hooks run unconditionally on every render"

requirements-completed: [PERS-03]

duration: 40min
completed: 2026-08-01
---

# Phase 33 Plan 08: Admin Personalization Dialog Summary

**Admin "Personalization" dialog on the Users page backed by new user-preferences API client + TanStack Query hooks, showing read-only CRM match status and letting admins add/delete free-text preference chips with a toast+undo delete pattern.**

## Performance

- **Duration:** ~40 min (across the API/hooks, component/wiring, and E2E tasks)
- **Started:** 2026-08-01T21:35:17+08:00 (Task 1 commit)
- **Completed:** 2026-08-01T21:52:43+08:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments
- Typed `userPreferencesApi` client + `usePersonalizationSummary`/`useCreatePreference`/`useUpdatePreference`/`useDeletePreference` hooks matching the 33-07 backend contract exactly, with a `CATEGORY_OPTIONS` constant kept in lockstep with the backend's `PREFERENCE_CATEGORIES`.
- `UserPersonalizationDialog` component (CRM status card + preference chip list + add-row) wired into `users.tsx`'s row action menu via a new "Personalization" `DropdownMenuItem`, with full zh-CN/en-US i18n coverage.
- Playwright E2E spec (`admin-user-personalization.spec.ts`) covering open-dialog, add-tag-as-chip, and delete-tag-with-undo-toast against the real running dev backend/frontend — all 3 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Preference API client + TanStack Query hooks** - `13a1754` (feat)
2. **Task 2: UserPersonalizationDialog component + i18n + wiring into users.tsx** - `b8cdbe3` (feat)
3. **Task 3: Playwright E2E — admin personalization workflow** - `06ed84e` (test)

_Note: Tasks 1-2 were TDD (`tdd="true"`); their RED/GREEN sub-steps are folded into the single commit shown above (this matches how the work landed given the compacted session boundary)._

## Files Created/Modified
- `frontend/src/api/user-preferences.ts` - Typed `PreferenceCategory`/`UserPreference`/`PersonalizationSummary` types + `userPreferencesApi.{getSummary,create,update,remove}`
- `frontend/src/api/user-preferences.test.ts` - Unit tests for the API client (4 tests: getSummary, create, update, remove call the right endpoints)
- `frontend/src/hooks/use-user-preferences.ts` - `usePersonalizationSummary`, `useCreatePreference`, `useUpdatePreference`, `useDeletePreference`, `CATEGORY_OPTIONS`
- `frontend/src/hooks/use-user-preferences.test.ts` - Unit tests for the hooks (queryKey, enabled flag, invalidation on mutation success)
- `frontend/src/components/admin/user-personalization-dialog.tsx` - CRM status card + preference chip list + add-row dialog component
- `frontend/src/components/admin/user-personalization-dialog.test.tsx` - 7 component tests (matched/unmatched CRM, empty state, chip rendering, add disabled/enabled, add-mutation call, delete-mutation call/no blocking modal)
- `frontend/src/pages/admin/users.tsx` - Added `UserCog` icon, `personalizationUser` state, "Personalization" `DropdownMenuItem`, and `<UserPersonalizationDialog>` render
- `frontend/src/pages/admin/users.test.tsx` - Added `vi.mock("@/hooks/use-user-preferences")` to fix a regression caused by the unconditional dialog mount
- `frontend/public/locales/zh-CN/admin.json` - New sibling `"personalization"` i18n object (13 keys + 3 nested category keys)
- `frontend/public/locales/en-US/admin.json` - Matching English `"personalization"` i18n object
- `frontend/e2e/admin-user-personalization.spec.ts` - 3 E2E tests: open dialog/sections, add tag as chip, delete tag with undo toast

## Decisions Made
- **Seeded-user substitution in Task 3's E2E spec:** The plan suggested reusing "Alice Wang" from `admin-users.spec.ts` as the known seeded user for the new spec. An exhaustive `grep -rln "alice.wang\|Alice Wang"` across the whole worktree confirmed this name/email exists ONLY in `frontend/e2e/admin-users.spec.ts`, two frontend unit-test mock files, and the plan file itself — never in any backend seed script (`backend/scripts/seed_data.py` seeds exactly `admin`, `user1`/Zhang Wei, `user2`/Li Ming, `user3`/Wang Fang). Rather than deviate from the plan's intent of testing against "a known seeded user," the new spec targets the real seeded user **Zhang Wei** (`user1`) instead. This means `admin-users.spec.ts` (a pre-existing, unmodified-by-this-plan spec) likely already fails against a freshly seeded real backend — that gap is out of scope for plan 33-08 and is called out here for visibility rather than fixed.
- **QueryClientProvider regression fix:** `UserPersonalizationDialog` is unconditionally mounted inside `UserManagementPage` (visibility controlled only by the Radix `Dialog`'s `open` prop), so it always calls `usePersonalizationSummary`, which requires `QueryClientProvider`. This broke all 13 pre-existing tests in `users.test.tsx`. Fixed via `vi.mock("@/hooks/use-user-preferences", () => ({...}))`, mirroring the file's existing `@/hooks/use-users` mock convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed QueryClientProvider regression in users.test.tsx**
- **Found during:** Task 2 (component/wiring)
- **Issue:** Adding `<UserPersonalizationDialog>` (unconditionally rendered) to `UserManagementPage` broke all 13 pre-existing tests in `users.test.tsx` with `Error: No QueryClient set, use QueryClientProvider to set one`, since the dialog's `usePersonalizationSummary` hook runs on every render regardless of the dialog's `open` state.
- **Fix:** Added a `vi.mock("@/hooks/use-user-preferences", () => ({...}))` block stubbing all four exports, matching the existing `@/hooks/use-users` mock pattern already present in the same file.
- **Files modified:** `frontend/src/pages/admin/users.test.tsx`
- **Verification:** `users.test.tsx` alone: 13/13 passed. Full suite: 213/213 files, 2532/2532 tests passed.
- **Committed in:** `b8cdbe3` (Task 2 commit)

**2. [Rule 3 - Blocking] Corrected Playwright config path for verification runs**
- **Found during:** Task 3 verification
- **Issue:** The plan's verify command `npx playwright test ... --config=playwright.config.ts` fails because the config file actually lives at `e2e/playwright.config.ts` (per CLAUDE.md gotcha #5: "Playwright needs `--config=e2e/playwright.config.ts` — Default config path differs").
- **Fix:** Ran verification with `--config=e2e/playwright.config.ts` instead.
- **Files modified:** None (verification command only).
- **Verification:** `npx playwright test e2e/admin-user-personalization.spec.ts --config=e2e/playwright.config.ts` → 5 passed (2 auth setup + 3 spec tests).

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/verification-command correction)
**Impact on plan:** Both fixes were necessary to reach a fully green state; no scope creep beyond the plan's own files.

## Issues Encountered
- Confirmed `.github/workflows/ci.yml` currently has no `e2e-test`/Playwright job (only `changes`, `backend-test`, `frontend-test`, and deploy-related jobs), which contradicts CLAUDE.md's documented "CI Pipeline Overview." This means `frontend/e2e/*.spec.ts` files (including this plan's new spec and the pre-existing `admin-users.spec.ts`) are not currently exercised in CI. Out of scope for this plan; noted for visibility.
- `admin-users.spec.ts` (pre-existing, not modified by this plan) asserts against a 12-user mock roster ("Alice Wang", "Bob Zhang", etc.) that does not exist in the real seeded backend — likely already failing if run against a freshly seeded dev stack. Out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PERS-03's admin UI requirement is fully closed: admins can view/add/delete preference tags end-to-end through real API calls, verified by unit + component + E2E tests.
- This also gives 33-05/33-06 (PERS-02 prompt injection) a real, working admin workflow to populate the preference data those phases read at session start.
- Pre-existing E2E seed-data gap (`admin-users.spec.ts`) and missing CI E2E job remain open items for a future phase/cleanup pass.

---
*Phase: 33-personalized-crm-excel-avatar*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 11 created/modified files confirmed present on disk; all 3 task commit hashes (`13a1754`, `b8cdbe3`, `06ed84e`) confirmed present in git history.
