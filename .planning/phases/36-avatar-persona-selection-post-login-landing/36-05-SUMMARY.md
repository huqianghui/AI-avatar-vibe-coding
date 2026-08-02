---
phase: 36-avatar-persona-selection-post-login-landing
plan: 5
subsystem: routing
tags: [react-router, playwright, e2e, auth, redirect]

# Dependency graph
requires:
  - phase: 35-avatar-page-ui-personalization
    provides: "/ avatar page (AVUI-01), personalization badge + email header state (PERS-02)"
  - phase: 36-avatar-persona-selection-post-login-landing (36-04)
    provides: "persona-switcher UI mounted on the / avatar page header"
provides:
  - "Regular-user post-login redirect target changed from /user/dashboard to / (LAND-01)"
  - "Admin post-login redirect unchanged (/admin/dashboard)"
  - "New E2E spec proving both landing outcomes + the D-10 direct-access regression guard"
affects: [routing, auth-e2e, avatar-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-auth redirect target is a pure client-side literal-string change at two call sites (login.tsx onSuccess, GuestRoute ternary) -- no router-tree change needed since / is already mounted outside both ProtectedRoute and GuestRoute/AdminRoute"

key-files:
  created:
    - frontend/e2e/post-login-landing.spec.ts
  modified:
    - frontend/src/pages/login.tsx
    - frontend/src/router/auth-guard.tsx
    - frontend/e2e/routing.spec.ts
    - frontend/e2e/auth.setup.ts
    - frontend/e2e/login.spec.ts

key-decisions:
  - "Only routing.spec.ts line 30's assertion was updated to expect / -- the other two /user/dashboard references (AdminRoute non-admin fallback, direct-URL logout test) were left untouched per D-10/Pitfall 4, exactly as the plan specified"
  - "Fixed auth.setup.ts's post-login waitForURL('**/user/dashboard') for the regular-user flow -- it is the Playwright 'setup' project every 'chromium' test depends on, so it would have blocked all E2E execution, not just this plan's own tests"
  - "Fixed login.spec.ts's now-stale 'redirects to user dashboard' assertion for the same reason (Rule 1 -- an assertion of the old, now-intentionally-changed behavior)"

patterns-established:
  - "New E2E specs proving a real-browser login->redirect flow mock the avatar page's anonymous session/WebRTC/personalized-session/persona-selection endpoints with deterministic fixtures rather than depending on real dev-DB seed state, matching the established convention in anonymous-avatar-qa.spec.ts / personalized-avatar-qa.spec.ts / persona-switch.spec.ts"

requirements-completed: [LAND-01]

# Metrics
duration: 9min
completed: 2026-08-02
---

# Phase 36 Plan 5: Post-Login Landing Redirect Summary

**Two-line redirect-target change (login.tsx, GuestRoute) sends regular users to `/` instead of `/user/dashboard` post-login, closing the loop between Phase 36's persona work and Phase 35's avatar-page landing.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-02T12:31:00Z
- **Completed:** 2026-08-02T12:40:00Z
- **Tasks:** 2
- **Files modified:** 6 (2 created/modified beyond the plan's own list, as a Rule 1/Rule 3 fix -- see Deviations)

## Accomplishments
- Regular-user post-login now lands on `/` (the avatar page), where the persona/personalization work from earlier 36-xx plans is already active
- Admin post-login landing is completely unchanged (`/admin/dashboard`)
- `/user/dashboard` and all other legacy coach routes remain directly reachable by URL (D-10) -- verified by both the pre-existing `routing.spec.ts` direct-nav test and a new explicit acceptance test in `post-login-landing.spec.ts`
- New `post-login-landing.spec.ts` proves the full LAND-01 user story end-to-end through the real `/login` form: regular-user landing + personalized header, D-10 direct access, admin landing
- Confirmed the chrome-absence regression guard (`anonymous-avatar-qa.spec.ts`'s `nav` count-0 assertion on `/`) still holds now that regular users land there directly post-login

## Task Commits

Each task was committed atomically:

1. **Task 1: Update redirect targets + the one intentional routing.spec.ts assertion** - `8a1423f` (feat)
2. **Task 2: New E2E for the post-login landing user story + full regression** - `71397a6` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `frontend/src/pages/login.tsx` - non-admin `onSuccess` branch now calls `navigate("/")` instead of `navigate("/user/dashboard")`
- `frontend/src/router/auth-guard.tsx` - `GuestRoute`'s ternary else-branch now targets `"/"`; `AdminRoute`/`ProtectedRoute` untouched
- `frontend/e2e/routing.spec.ts` - line 30's assertion (`"authenticated user on /login is redirected to dashboard"`) now expects `"/"`; the other two `/user/dashboard` references (lines 36, 44) are untouched
- `frontend/e2e/post-login-landing.spec.ts` - new: three tests covering regular-user landing + personalized header, D-10 direct-access, and admin landing
- `frontend/e2e/auth.setup.ts` - fixed the regular-user setup flow's `waitForURL`/assertion to match the new `/` landing target (Rule 3 blocking fix -- this is the Playwright "setup" project every "chromium" test depends on)
- `frontend/e2e/login.spec.ts` - fixed the now-stale "successful login as regular user redirects to user dashboard" test to match the new intentional behavior (renamed + reasserted for `/`)

## Decisions Made
- Left `AdminRoute`'s non-admin fallback (`/user/dashboard`) and `routing.spec.ts`'s other two `/user/dashboard` assertions completely untouched, per the plan's explicit instruction and 36-RESEARCH.md's Pitfall 4/Open Question 1 (unauthorized-access redirect is a different concern from post-login landing, and D-09/D-10 only name the latter)
- Reused the real `/login` form + real backend for the new spec's login flow (rather than a pre-seeded `storageState`) since the point of the spec is proving the redirect itself fires, which a pre-authenticated state would skip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `auth.setup.ts`'s regular-user `waitForURL("**/user/dashboard")`**
- **Found during:** Task 1 verification (running `routing.spec.ts`)
- **Issue:** `auth.setup.ts`'s "authenticate as regular user" setup test clicked submit and then called `page.waitForURL("**/user/dashboard")` -- after the redirect-target change, a regular user now lands on `/`, so this would time out and never complete. Since Playwright's `chromium` project declares `dependencies: ["setup"]` in `playwright.config.ts`, this setup test runs before *every* other test file, including `routing.spec.ts`'s own Task 1 verification -- so this was a genuine blocker for the plan's own required verification, not an unrelated pre-existing issue.
- **Fix:** Changed the wait/assertion to expect `/` instead of `/user/dashboard` for the regular-user flow. The admin flow (still `/admin/dashboard`) was left unchanged. The captured `storageState` (auth token in localStorage) is unaffected by which URL the page ends on.
- **Files modified:** `frontend/e2e/auth.setup.ts`
- **Verification:** `npx playwright test e2e/routing.spec.ts` -- the `[setup]` project's two tests plus all `routing.spec.ts` tests pass (15/15)
- **Committed in:** `8a1423f` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `login.spec.ts`'s now-stale "redirects to user dashboard" assertion**
- **Found during:** Task 1 verification
- **Issue:** `login.spec.ts` had its own direct test of the exact behavior this plan intentionally changes ("successful login as regular user redirects to user dashboard", asserting `toHaveURL(/\/user\/dashboard/)`), which is not in the plan's `files_modified` list but became a false-negative assertion of superseded behavior the moment `login.tsx` changed.
- **Fix:** Renamed the test to "successful login as regular user redirects to the avatar page" and updated its assertion to expect `/`, with an inline comment linking back to LAND-01.
- **Files modified:** `frontend/e2e/login.spec.ts`
- **Verification:** `npx playwright test e2e/login.spec.ts` -- all 6 tests pass
- **Committed in:** `8a1423f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking/bug-fix, both necessary consequences of the intentional redirect-target change; no scope creep beyond fixing tests that directly asserted the old, now-superseded behavior)
**Impact on plan:** Both fixes were required for the plan's own verification commands to run at all (the `auth.setup.ts` fix) or to keep the suite green (the `login.spec.ts` fix). No architectural changes, no new files beyond the plan's own `post-login-landing.spec.ts`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LAND-01 is complete; Phase 36's post-login landing loop is fully closed -- regular users now land where their persona/personalization state (36-03/36-04, Phase 33) is already active
- Full verification gate green: `routing.spec.ts` (7), `post-login-landing.spec.ts` (3), `anonymous-avatar-qa.spec.ts` (5), plus regression on `login.spec.ts` (6) -- 21 E2E tests total across the touched surface, `tsc -b` clean, `npm run build` succeeds
- This was Plan 5 of 5 for Phase 36 -- phase is now complete pending `/gsd-verify-work`

---
*Phase: 36-avatar-persona-selection-post-login-landing*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: frontend/e2e/post-login-landing.spec.ts
- FOUND: .planning/phases/36-avatar-persona-selection-post-login-landing/36-05-SUMMARY.md
- FOUND: commit 8a1423f (Task 1)
- FOUND: commit 71397a6 (Task 2)
