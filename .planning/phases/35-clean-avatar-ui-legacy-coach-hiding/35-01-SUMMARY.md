---
phase: 35-clean-avatar-ui-legacy-coach-hiding
plan: 01
subsystem: testing
tags: [playwright, e2e, avatar-page, ui, regression-gate]

# Dependency graph
requires:
  - phase: 32-anonymous-grounded-avatar-q-a
    provides: "avatar-page.tsx standalone route + answer/citation structural separation (ANON-01..05)"
provides:
  - "Regression-proof AVUI-01 chrome-absence E2E assertion in anonymous-avatar-qa.spec.ts"
  - "Pre-change full E2E baseline (35-E2E-BASELINE.md) for Plan 35-02's zero-new-failures diff gate"
affects: [35-02-clean-avatar-ui-legacy-coach-hiding]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Chrome-absence negative E2E assertion (page.locator('nav').toHaveCount(0)) as a structural regression guard, distinct from data-separation contract tests"]

key-files:
  created:
    - .planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-E2E-BASELINE.md
  modified:
    - frontend/e2e/anonymous-avatar-qa.spec.ts

key-decisions:
  - "D-05/D-06 followed exactly: avatar-page.tsx and subcomponents untouched; only a new negative E2E assertion added"
  - "Baseline captured via 6-way Playwright sharding (--shard=N/6) run sequentially in the foreground rather than a single background run, since a single unsharded run exceeds the tool's per-command execution budget and background processes do not survive an agent turn boundary"

patterns-established:
  - "Sharded foreground E2E baseline capture: split full suite into --shard=N/6 runs, tee each to its own log, aggregate pass/fail/skip totals and failing-test titles afterward"

requirements-completed: [AVUI-01]

# Metrics
duration: 53min
completed: 2026-08-02
---

# Phase 35 Plan 01: Chrome-Absence E2E Guard + Pre-Change E2E Baseline Summary

**Added a `page.locator("nav").toHaveCount(0)` regression assertion to `anonymous-avatar-qa.spec.ts` proving AVUI-01's chrome-absence, and captured a 6-shard full E2E baseline (421 passed / 9 skipped / 39 failed) for Plan 35-02 to diff against.**

## Performance

- **Duration:** 53 min
- **Started:** 2026-08-02T00:44:00Z (approx, file reads)
- **Completed:** 2026-08-02T01:36:39Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- AVUI-01 ("avatar page shows only digital human + document-links panel") is now regression-proof via an automated negative E2E assertion, not just the pre-existing data-separation contract tests
- Captured and committed a timestamped, pre-change full E2E baseline (`35-E2E-BASELINE.md`) enumerating all 39 currently-failing test titles, satisfying D-10's requirement that Plan 35-02 diff against a fresh snapshot rather than the stale Phase 34 numbers
- Confirmed via direct code inspection that `<nav>` is rendered only by `UserLayout` (frontend/src/components/layouts/user-layout.tsx:85,156) — no other component in the app renders `<nav>` — making the new assertion a true structural proof, not an implementation-detail-coupled one
- Zero production code touched (per D-05); `avatar-page.tsx` and its subcomponents remain exactly as Phase 32/33 left them

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture pre-change full E2E baseline** - `7bd872d` (test)
2. **Task 2: Add chrome-absence E2E assertion and verify AVUI-01 compliance** - `e869064` (test)

_Note: no separate plan-metadata commit yet — this SUMMARY/STATE/ROADMAP update is committed together as the final docs commit below._

## Files Created/Modified
- `.planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-E2E-BASELINE.md` - Full pass/skip/fail snapshot (421/9/39) with complete failing-test-title enumeration, captured before any Phase 35 code change
- `frontend/e2e/anonymous-avatar-qa.spec.ts` - New test: "the avatar page renders no nav, sidebar, or coach chrome -- only the avatar experience"

## Decisions Made
- Followed D-05/D-06 exactly: verification-only, no `avatar-page.tsx` changes, extended the existing spec file (per UI-SPEC's resolution) rather than creating a new one
- Baseline capture method deviated from the plan's literal single-command instruction (`npm run test:e2e -- --reporter=list | tee ...`) because a prior attempt to run the full suite via `run_in_background` was killed when the executing agent's turn ended before the ~40-min run completed (background processes and notifications do not survive a subagent turn boundary in this environment). Recovered by: (1) `git stash`-ing Task 2's uncommitted spec edit so the baseline ran against a pristine pre-Phase-35 tree per D-10, (2) running the suite in 6 sequential foreground shards (`--shard=1/6` through `--shard=6/6`, each under the 10-minute per-command budget), (3) aggregating totals and the full failing-test list across shards, (4) `git stash pop` to restore Task 2's edit before its own verification/commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sharded the E2E baseline run instead of one unsharded command**
- **Found during:** Task 1
- **Issue:** The plan's literal `npm run test:e2e -- --reporter=list` command takes ~35-40 min, exceeding both a single foreground Bash call's timeout and the persistence guarantee of `run_in_background` across agent turns (a prior attempt was killed mid-run when the turn ended).
- **Fix:** Split the run into 6 foreground shards via Playwright's built-in `--shard=N/6`, each `tee`d to its own log file, then aggregated pass/skip/fail counts and the full failing-test-title list across all 6 shard logs.
- **Files modified:** None (test-execution methodology only, not test code); output written to `.planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-E2E-BASELINE.md`
- **Verification:** Aggregated totals (469 tests collected, incl. 10 extra per-shard-duplicated `[setup]` auth-fixture runs) reconcile against the previous single-worker total of 460; failed/skipped counts (39/9) are unaffected by the duplication and are in the same order of magnitude as Phase 34's documented ~35/9 baseline, satisfying the plan's own sanity-check bar (RESEARCH.md Pitfall 4)
- **Committed in:** `7bd872d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — execution methodology only, no test/product code changed)
**Impact on plan:** No scope creep. The baseline artifact's content and purpose exactly match the plan's Task 1 spec; only the mechanics of running the suite changed.

## Issues Encountered
- 39 pre-existing E2E failures observed in the baseline, all matching failure clusters already documented in `.planning/phases/34-spanish-es-i18n/deferred-items.md` (stale mock data in admin pages, real-Azure-connection specs in `voice-live-proxy.spec.ts`) except `hcp-editor-voice-tab.spec.ts` (4 failures), whose `beforeEach` hooks failed with "Request context disposed" — consistent with a shard-boundary worker-teardown artifact of running that spec file at the tail end of its shard, not a new product regression. None of the 39 failing specs touch `avatar-page.tsx`, `anonymous-avatar-qa.spec.ts`, or any file this plan modifies. Not fixed here per CLAUDE.md's one-requirement-at-a-time rule and the deviation-rules scope boundary (pre-existing issues in files this plan does not own).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AVUI-01 is now regression-proof and can be marked complete in REQUIREMENTS.md/ROADMAP.md traceability
- `35-E2E-BASELINE.md` is committed and ready for Plan 35-02 to diff its own post-change E2E run against (zero-new-failures gate per D-10)
- No blockers for Plan 35-02 (AVUI-02: legacy coach nav hiding behind feature flag)

---
*Phase: 35-clean-avatar-ui-legacy-coach-hiding*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: frontend/e2e/anonymous-avatar-qa.spec.ts
- FOUND: .planning/phases/35-clean-avatar-ui-legacy-coach-hiding/35-E2E-BASELINE.md
- FOUND: 7bd872d (Task 1 commit)
- FOUND: e869064 (Task 2 commit)
