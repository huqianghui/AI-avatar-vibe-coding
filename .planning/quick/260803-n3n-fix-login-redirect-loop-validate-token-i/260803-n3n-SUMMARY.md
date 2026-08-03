---
phase: quick
plan: 260803-n3n
subsystem: frontend-auth
tags: [auth, routing, react-router, tanstack-query, playwright]
dependency-graph:
  requires: []
  provides:
    - "GuestRoute validates token via useMe() before redirecting away from /login"
  affects:
    - "frontend/src/router/auth-guard.tsx"
    - "frontend/src/router/auth-guard.test.tsx"
    - "frontend/e2e/login.spec.ts"
tech-stack:
  added: []
  patterns:
    - "Guard components gate redirect decisions on server-resolved identity (useMe()), not raw token presence, mirroring ProtectedRoute's existing loading-state pattern"
key-files:
  created: []
  modified:
    - "frontend/src/router/auth-guard.tsx"
    - "frontend/src/router/auth-guard.test.tsx"
    - "frontend/e2e/login.spec.ts"
decisions:
  - "GuestRoute now short-circuits to Outlet when user is null after useMe() resolves (stale/invalid token), instead of redirecting on token presence alone -- fixes the redirect-away-from-/login lockout bug"
  - "Fixed a pre-existing failing unit test ('redirects regular users to /user/dashboard') that predated this change and had drifted from the LAND-01 decision (regular users land on / per Phase 36); renamed to 'redirects regular users to /' and updated its target route/assertion"
metrics:
  duration: "~1h10m (including worktree-mixup recovery)"
  completed: "2026-08-03"
---

# Quick Task 260803-n3n: Fix login redirect loop by validating token before redirecting Summary

**One-liner:** `GuestRoute` now gates its redirect-away-from-`/login` decision on `useMe()`'s server-resolved identity (loading state, then `user` presence) instead of raw token existence, so a stale/expired/tampered `access_token` in localStorage no longer permanently traps the user away from the login form.

## What Was Built

### Task 1 — Validate token before redirecting in `GuestRoute`, extend unit tests

`GuestRoute` in `frontend/src/router/auth-guard.tsx` previously redirected away from `/login` whenever a `token` existed in the auth store, regardless of whether that token was actually valid. This meant:
- A stale/expired token permanently trapped the user away from `/login` with no way to re-authenticate (the redirect target itself has no way back to `/login`).
- On first render after a reload, `user` is briefly `null` before `/me` resolves, so even a valid admin token could momentarily route to `/` instead of `/admin/dashboard`.

Fix: `GuestRoute` now calls `useMe()` (mirroring the existing `ProtectedRoute` pattern) and branches on three states:
1. No token -> `Outlet` (login form visible).
2. Token present, `useMe()` still loading -> shared "Loading..." markup, no redirect.
3. Token present, `useMe()` resolved but `user` is `null` (the `/me` call failed and `clearAuth()` already fired inside `useMe`'s catch block) -> `Outlet` (stays on `/login`, can log in).
4. Token present, `useMe()` resolved with a valid `user` -> redirects by real role (`admin` -> `/admin/dashboard`, else -> `/`).

Two new unit tests were added to the existing `describe("GuestRoute", ...)` block in `frontend/src/router/auth-guard.test.tsx`:
- `"shows loading state when token exists but identity is still loading"`
- `"stays on /login when token is stale and the identity fetch has failed"`

### Task 2 — E2E proof: stale token no longer blocks login

Added `"stale token in localStorage does not block access to /login and user can still log in"` to `frontend/e2e/login.spec.ts`. The test seeds a garbage JWT (`"stale-invalid-token-e2e"`) directly into `localStorage`, reloads the page (forcing the auth store to rehydrate the stale token), asserts the login form is still reachable, then proves login still works end-to-end with valid credentials (`user1`/`user123`), landing on `/` per the LAND-01 decision.

## Verification

All four gates specified in the plan were run and passed in the assigned worktree:

| Gate | Result |
|------|--------|
| `npx vitest run src/router/auth-guard.test.tsx` | 10/10 passed |
| `npx tsc -b` | Clean, no errors |
| `npm run build` | Succeeded (pre-existing chunk-size warnings only, no errors) |
| `npx playwright test --config=e2e/playwright.config.ts login.spec.ts` | 9/9 passed (2 setup + 7 spec tests, including the new stale-token test) |

**Note on E2E execution environment:** port `5173` was occupied by an unrelated, already-running dev server from the main repo checkout (not part of this task, and left undisturbed to avoid disrupting a possibly-active session). To exercise the worktree's actual fixed code without colliding with that process, the E2E run was performed with a temporary local port override (`5183`) in `frontend/e2e/playwright.config.ts` and `frontend/e2e/auth.setup.ts` (Vite's dev server was started with an explicit `--port 5183 --strictPort` CLI flag, overriding `vite.config.ts`'s hardcoded `5173`). This was purely a port-collision workaround — the same code, same test assertions, and same auth flow were fully exercised. All temporarily-modified files (`playwright.config.ts`, `auth.setup.ts`, and the `5183` references in `login.spec.ts`) were reverted to their exact original content (verified via `diff` against pre-modification backups) before committing; only the plan's three `files_modified` carry real changes in the final commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing stale unit test unrelated to this fix but in the same describe block**
- **Found during:** Task 1 verification (`npx vitest run src/router/auth-guard.test.tsx`)
- **Issue:** `"redirects regular users to /user/dashboard"` was failing even on unmodified `auth-guard.tsx` (confirmed via `git stash`). It expected the legacy `/user/dashboard` landing route, but both the old and new `GuestRoute` implementations redirect non-admin users to `/`, per the LAND-01 decision recorded in `.planning/STATE.md` (Phase 36: regular-user post-login lands on `/`, not `/user/dashboard`).
- **Fix:** Renamed the test to `"redirects regular users to /"` and updated its target route/assertion from `/user/dashboard`/"User Dashboard" to `/`/"Avatar Page", matching the already-correct application behavior.
- **Files modified:** `frontend/src/router/auth-guard.test.tsx`
- **Commit:** `ecd65ff`

No architectural changes, no auth gates encountered.

## Self-Check: PASSED

- FOUND: `frontend/src/router/auth-guard.tsx`
- FOUND: `frontend/src/router/auth-guard.test.tsx`
- FOUND: `frontend/e2e/login.spec.ts`
- FOUND: commit `ecd65ff` (Task 1: GuestRoute fix + unit tests)
- FOUND: commit `e06f5f1` (Task 2: E2E stale-token test)
- FOUND: `useMe` usage in `auth-guard.tsx`
- FOUND: new E2E test title string in `login.spec.ts`
</content>
