# Deferred Items — Phase 37

## Item 1: Pre-existing vitest failures unrelated to 37-04 changes

- **Found during:** 37-04 full vitest run (post Task 2 verification)
- **Files:** `frontend/src/pages/login.test.tsx` (`redirects regular users to /user/dashboard`), `frontend/src/router/auth-guard.test.tsx` (`GuestRoute > redirects regular users to /user/dashboard`)
- **Issue:** Both assert a `/user/dashboard` redirect target for regular users. Per STATE.md's Phase 36 decision log, regular-user post-login landing moved to `/` (the avatar page) as part of PERSONA-01..04/LAND-01. These two tests were never updated to match.
- **Scope:** Out of scope for 37-04 (this plan touches `use-anonymous-voice-live.ts`, `public-avatar.ts`, `avatar-page.tsx`, and three E2E specs only — not `login.tsx` or `auth-guard.tsx`).
- **Action:** Not fixed. Deferred to a future quick-task or phase that owns `login.tsx`/`auth-guard.tsx`.
