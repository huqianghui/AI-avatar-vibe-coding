---
phase: 35-clean-avatar-ui-legacy-coach-hiding
plan: 02
subsystem: frontend-backend-integration
tags: [feature-flag, navigation, ui-visibility, config-api, regression-gate]

# Dependency graph
requires:
  - phase: 35-clean-avatar-ui-legacy-coach-hiding
    plan: 01
    provides: "35-E2E-BASELINE.md (421 passed / 9 skipped / 39 failed) for this plan's zero-new-failures diff gate"
provides:
  - "feature_legacy_coach_nav_enabled flag threaded end-to-end: Settings -> FeatureFlags API -> TS type -> ConfigContext default -> UserLayout consumption"
  - "UserLayout desktop + mobile nav items hidden by default, restorable via env flag, without deleting any route/page/API"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() for a vi.fn()-backed vi.mock() factory that needs per-test mockReturnValueOnce overrides (vi.mock factories are hoisted above top-level const declarations)"

key-files:
  created: []
  modified:
    - backend/app/config.py
    - backend/app/api/config.py
    - backend/tests/test_config_api.py
    - frontend/src/types/config.ts
    - frontend/src/contexts/config-context.tsx
    - frontend/src/components/layouts/user-layout.tsx
    - frontend/src/components/layouts/user-layout.test.tsx
    - frontend/src/hooks/use-config.test.tsx
    - .planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-VALIDATION.md

key-decisions:
  - "Followed D-01/D-02/D-03 exactly: env-var-only flag (no DB override, no admin UI toggle), UI-visibility-only (not an access-control boundary), zero routes/pages/APIs deleted"
  - "Gated both UserLayout render sites (desktop <nav> and mobile Sheet <nav>) with the identical `{legacy_coach_nav_enabled && navItems.map(...)}` pattern per D-08/UI-SPEC contract"
  - "D-08 test update: existing 'renders all desktop navigation items' test now runs with legacy_coach_nav_enabled: true explicitly (via vi.hoisted mockUseConfig), proving the true-case still works after gating; new test proves the false-case hides all 4 items on both render sites"

patterns-established:
  - "vi.hoisted() wrapper for mock factory functions that must be referenced inside vi.mock()'s hoisted callback and also mutated per-test via mockReturnValueOnce"

requirements-completed: [AVUI-02]

# Metrics
duration: 65min
completed: 2026-08-02
---

# Phase 35 Plan 02: Legacy Coach Nav Feature Flag Summary

**Added `feature_legacy_coach_nav_enabled` (default `False`) threaded through the existing 4-layer flag pipeline, hiding the 4 legacy coach nav items (dashboard/training/history/reports) at both `UserLayout` render sites (desktop `<nav>` + mobile `Sheet`) while leaving all underlying routes, pages, and backend endpoints fully intact — verified via a full backend/frontend/E2E regression showing zero newly-failing tests against the 35-01 baseline.**

## Performance

- **Duration:** 65 min
- **Started:** 2026-08-02T09:33:00+08:00 (approx, file reads)
- **Completed:** 2026-08-02T10:44:00+08:00
- **Tasks:** 3 completed
- **Files modified:** 9

## Accomplishments
- `Settings.feature_legacy_coach_nav_enabled: bool = False` added to backend config, wired through `FeatureFlags` Pydantic model and `get_features()` (env-only, matching the `feature_conference_enabled` precedent — no DB override)
- `FeatureFlags` TS interface, `ConfigContext.defaultFlags`, and `UserLayout` all updated to consume the new flag; both the desktop `<nav>` and mobile `Sheet` `<nav>` render sites gated identically so there is no desktop-only or mobile-only leak
- `AdminLayout` completely untouched — confirmed via the targeted `voice-live-proxy.spec.ts` run, whose unguarded "admin sidebar shows Voice Live link" assertion still passes
- No route, page component, or backend API was deleted — direct URL navigation to `/user/training`, `/user/dashboard`, `/user/history`, `/user/reports` remains fully reachable regardless of flag state (verified by `routing.spec.ts` and `admin-navigation.spec.ts`'s guarded "does not redirect to login" assertions passing unmodified)
- Full regression proof: backend full suite (2829 passed / 15 skipped / 90.11% coverage), frontend full unit suite (2609 passed, `tsc -b` clean, build succeeds), and a full 6-shard E2E run showing **zero tests newly failing** relative to the 35-01 baseline (34 failures observed vs. baseline's 39 — the 5 fewer are the already-documented `hcp-editor-voice-tab.spec.ts` sharding-teardown flake, not a fix or a regression)

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend flag wiring** - `f0dd677` (feat)
2. **Task 2: Frontend flag wiring** - `3d25a7c` (feat)
3. **Task 3: Full regression verification + 35-VALIDATION.md update** - `4560193` (test)

## Files Created/Modified
- `backend/app/config.py` - New `feature_legacy_coach_nav_enabled: bool = False` Settings field (6th flag in the "Feature Toggles (ARCH-02)" block)
- `backend/app/api/config.py` - `FeatureFlags.legacy_coach_nav_enabled: bool` field + `get_features()` wiring from `settings.feature_legacy_coach_nav_enabled`
- `backend/tests/test_config_api.py` - Both full `mock_settings` constructions set the new attribute (RESEARCH.md Pitfall 1 avoidance); new assertions on `legacy_coach_nav_enabled` presence/default
- `frontend/src/types/config.ts` - `FeatureFlags.legacy_coach_nav_enabled: boolean`
- `frontend/src/contexts/config-context.tsx` - `defaultFlags.legacy_coach_nav_enabled = false` (conservative pre-auth default)
- `frontend/src/components/layouts/user-layout.tsx` - Destructures `legacy_coach_nav_enabled` from `useConfig()`; gates both the desktop and mobile `navItems.map()` render sites
- `frontend/src/components/layouts/user-layout.test.tsx` - Converted `useConfig` mock to a `vi.hoisted()`-wrapped `vi.fn()` (default `legacy_coach_nav_enabled: true`); new test proves absence on both render sites when `false`
- `frontend/src/hooks/use-config.test.tsx` - Rule 3 fix: added the missing required `legacy_coach_nav_enabled` field to `mockConfig` (the type change made this a `tsc -b` build error)
- `.planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-VALIDATION.md` - Verification map filled with all green statuses, `status: complete`

## Decisions Made
- Followed CONTEXT.md D-01/D-02/D-03/D-08 exactly: env-var-only flag, UI-visibility-only gating (never a route guard), zero code/route deletion, deliberate test coverage of both flag states
- Used `vi.hoisted()` to work around `vi.mock()` factory hoisting when the mock needed to be a `vi.fn()` reference mutable via `mockReturnValueOnce` in a later test (Vitest hoists `vi.mock()` above top-level `const` declarations, so a plain `const mockUseConfig = vi.fn(...)` referenced inside the factory throws "Cannot access before initialization")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `use-config.test.tsx`'s `mockConfig` missing the new required `FeatureFlags` field**
- **Found during:** Task 2, immediately after adding `legacy_coach_nav_enabled` to the `FeatureFlags` TypeScript interface
- **Issue:** `npx tsc -b` failed with `TS2741: Property 'legacy_coach_nav_enabled' is missing in type '...' but required in type 'FeatureFlags'` in `frontend/src/hooks/use-config.test.tsx`'s `mockConfig: AppConfig` literal — a direct, mechanical consequence of the interface change, not caught by the plan's `<interfaces>` block (which only listed `user-layout.test.tsx` as needing a mock update)
- **Fix:** Added `legacy_coach_nav_enabled: false,` to `mockConfig.features` in `use-config.test.tsx`
- **Files modified:** `frontend/src/hooks/use-config.test.tsx`
- **Verification:** `npx tsc -b` passes cleanly; `npm run test` (full 214-file / 2609-test suite) passes
- **Committed in:** `3d25a7c` (Task 2 commit)

**2. [Rule 3 - Blocking] `vi.mock()` hoisting broke the initial `const mockUseConfig = vi.fn(...)` pattern**
- **Found during:** Task 2, first `vitest run` attempt on `user-layout.test.tsx`
- **Issue:** `ReferenceError: Cannot access 'mockUseConfig' before initialization` — Vitest hoists `vi.mock()` factory calls above all top-level statements, including `const` declarations, so a factory referencing a plain top-level `const mockUseConfig = vi.fn(...)` fails at module-eval time
- **Fix:** Wrapped the mock function declaration in `vi.hoisted(() => ({ mockUseConfig: vi.fn(...) }))`, which Vitest guarantees runs before the hoisted `vi.mock()` calls
- **Files modified:** `frontend/src/components/layouts/user-layout.test.tsx`
- **Verification:** `npx vitest run src/components/layouts/user-layout.test.tsx` — 9/9 tests pass
- **Committed in:** `3d25a7c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues caused directly by this plan's own type/mock changes, no scope creep beyond the plan's stated files)
**Impact on plan:** None. Both fixes were mechanical consequences of the plan's own edits, confined to the exact files the plan already listed as touched (`use-config.test.tsx` is a pre-existing test file in the same directory tree, not a new file; the mock refactor stayed within `user-layout.test.tsx`).

## Issues Encountered
- None blocking. The full E2E suite run (Task 3) took ~35 minutes across 6 foreground shards, consistent with the 35-01 SUMMARY's documented methodology and runtime.
- Diffing the aggregated failing-test-title list against the baseline required stripping trailing terminal box-drawing artifacts from 2 titles (`admin-users.spec.ts:29`/`:35`) that got corrupted by duration-text overlapping `tee`'d terminal rendering — confirmed via raw shard output inspection that these were the same tests as in the baseline, not a real diff artifact.

## User Setup Required

None — no external service configuration required. The new flag defaults to `False` (hidden) with no `.env` change needed for the default behavior; an operator who wants the legacy nav visible sets `FEATURE_LEGACY_COACH_NAV_ENABLED=true` in `.env`.

## Next Phase Readiness
- AVUI-02 is complete: the flag flows end-to-end from `Settings` through to `UserLayout`, gating both render sites, with deliberate unit-test coverage of both states and a full E2E regression showing zero new failures
- Both AVUI-01 (35-01) and AVUI-02 (35-02) are now complete — Phase 35's full scope is satisfied
- `35-VALIDATION.md` is updated with `status: complete`, `nyquist_compliant: true`, and a fully green Per-Task Verification Map
- No blockers for subsequent phases; CLEAN-01 (deleting coach code entirely) remains explicitly deferred per CONTEXT.md's deferred-ideas list

---
*Phase: 35-clean-avatar-ui-legacy-coach-hiding*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: backend/app/config.py
- FOUND: backend/app/api/config.py
- FOUND: backend/tests/test_config_api.py
- FOUND: frontend/src/types/config.ts
- FOUND: frontend/src/contexts/config-context.tsx
- FOUND: frontend/src/components/layouts/user-layout.tsx
- FOUND: frontend/src/components/layouts/user-layout.test.tsx
- FOUND: frontend/src/hooks/use-config.test.tsx
- FOUND: .planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-VALIDATION.md
- FOUND: f0dd677 (Task 1 commit)
- FOUND: 3d25a7c (Task 2 commit)
- FOUND: 4560193 (Task 3 commit)
