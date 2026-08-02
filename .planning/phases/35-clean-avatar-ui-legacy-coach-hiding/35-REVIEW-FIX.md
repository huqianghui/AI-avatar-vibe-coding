---
phase: 35-clean-avatar-ui-legacy-coach-hiding
fixed_at: 2026-08-02T03:00:45Z
review_path: .planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 35: Code Review Fix Report

**Fixed at:** 2026-08-02T03:00:45Z
**Source review:** .planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (fix_scope: all — WR-01, IN-01, IN-02)
- Fixed: 2
- Skipped: 1

## Fixed Issues

### IN-01: Mobile hamburger button stays visible and opens an empty Sheet when the flag is disabled

**Files modified:** `frontend/src/components/layouts/user-layout.tsx`, `frontend/src/components/layouts/user-layout.test.tsx`
**Commit:** `5d9e5b2`
**Applied fix:** Wrapped the mobile hamburger `<Button>` (previously unconditional) in `{legacy_coach_nav_enabled && (...)}` so it is not rendered at all when the flag is off, making the dead-end empty `Sheet` unreachable in the shipped default state. Added a dedicated test asserting `button.md\:hidden` is absent from the DOM when `legacy_coach_nav_enabled` is `false`. `AdminLayout` was not touched (it has its own independent hamburger button and does not consume this flag).

### IN-02: Empty `<nav>` landmark elements remain in the DOM when the flag is disabled

**Files modified:** `frontend/src/components/layouts/user-layout.tsx`, `frontend/src/components/layouts/user-layout.test.tsx`
**Commit:** `70442af`
**Applied fix:** Moved the `legacy_coach_nav_enabled` condition to wrap the `<nav>` element itself (rather than just the `.map()` contents inside it) at both the desktop nav site (line ~87) and the mobile `Sheet` nav site (line ~160), so neither empty landmark is mounted when the flag is off. Added tests asserting `document.querySelectorAll("nav").length` is `0` when the flag is off, and `1` (desktop only, Sheet closed) then `2` (after opening the mobile Sheet) when the flag is on. Verified via `container`/`document` queries since the Sheet's content renders into a Radix portal on `document.body`, not the local render container.

## Skipped Issues

### WR-01: Legacy nav items can flash hidden-then-shown on every page load for deployments that enable the flag

**File:** `frontend/src/contexts/config-context.tsx:6-26` (interacts with `frontend/src/components/layouts/user-layout.tsx:86,158` — now `87` and `160` after the IN-01/IN-02 fixes)
**Reason:** Skipped — the reviewer's literal suggested fix (default `legacy_coach_nav_enabled` to `true` while `isAuthenticated && isLoading`, correcting once real data arrives) would invert the regression onto the shipped default (flag-off) case: today, 100% of deployments ship with the flag off, and the `false` fallback already matches the eventual steady state with zero visible flash. Assuming `true` during the loading window would instead make the nav/hamburger pop in immediately on every authenticated page load and then disappear once the `/config/features` query resolves — a *new* flash affecting all current deployments, in exchange for removing a flash that today affects zero deployments (the flag is off by default; WR-01 only manifests for a future deployment that explicitly opts in). This is exactly the "fix requires restructuring loading semantics in a way that could regress other consumers" case called out in the task constraints, so per those constraints a minimal targeted fix was preferred, and none was identified that avoids trading one flash for another without also restructuring the config-loading contract used by other `ConfigProvider` consumers (e.g. `avatar_enabled`/`voice_enabled` gates in `frontend/src/components/coach/chat-area.tsx`).

The reviewer's stated alternative — prefetching `/config/features` via a route loader or on login success (`frontend/src/hooks/use-auth.ts`, which currently has no `queryClient` usage at all) — would reduce the window for the login-redirect path, but would not eliminate it for hard page reloads of an already-authenticated session, and constitutes a genuine architectural change (route loader wiring or login-flow side effects) rather than a targeted fix, which is out of scope for automated fixing here.

**Recommendation for follow-up:** Defer to a dedicated phase/PR at the point a real deployment sets `FEATURE_LEGACY_COACH_NAV_ENABLED=true`, when the actual UX impact and preferred tradeoff (prefetch vs. skeleton vs. accepted flash) can be evaluated against that deployment's real login/routing flow.

**Original issue:** `ConfigProvider` falls back to `defaultFlags` (`legacy_coach_nav_enabled: false`) whenever `data` is not yet available, including the async window between `isAuthenticated` becoming `true` and the `/config/features` query resolving. For deployments that opt in to the legacy nav, every authenticated page load renders `UserLayout` with the nav hidden, then pops the nav in once the config query resolves — a visible layout shift not present before this phase. Invisible for the (default) flag-off case.

---

_Fixed: 2026-08-02T03:00:45Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
