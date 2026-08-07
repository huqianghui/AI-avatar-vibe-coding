---
phase: 40-composite-component-adapters
plan: 04
subsystem: ui
tags: [react, fluent-ui, react-hook-form, vitest, accessibility, radix-migration]

# Dependency graph
requires:
  - phase: 40-composite-component-adapters
    provides: "40-01's shared _shim-as-child.ts (isSingleRefCapableElement + cloneElement guard pattern), already proven in button.tsx/sheet.tsx"
provides:
  - "form.tsx's FormControl migrated off @radix-ui/react-slot onto the shared cloneElement shim, with zero changes to react-hook-form wiring (Form/FormField/useFormField)"
  - "Net-new form.test.tsx (6 tests) backfilling form.tsx's historical zero test coverage"
  - "form.tsx removed from vitest.config.ts's coverage.exclude list, with all 4 coverage thresholds still passing"
affects: [40-05, 40-06, 40-07, 40-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cloneElement-based asChild shim (isSingleRefCapableElement) reused a third time (after button.tsx, sheet.tsx) for FormControl's single-child prop merging, replacing Radix Slot"
    - "Coverage-backfill sequencing: write tests first, then remove from coverage.exclude, then verify thresholds still pass — all bundled in one commit for config-only low-risk changes"

key-files:
  created:
    - frontend/src/components/ui/form.test.tsx
  modified:
    - frontend/src/components/ui/form.tsx
    - frontend/vitest.config.ts

key-decisions:
  - "Replicated Radix Slot's exact prop-merging semantics (child props override, className merged via cn()) rather than introducing a wrapper div, preserving zero-extra-DOM-node behavior"
  - "Rewrote Test 4's assertion to check for a single textbox element with directly-merged id/aria-invalid/aria-describedby attributes, instead of asserting a data-slot=\"form-control\" DOM attribute — Fluent's Input adapter (from Phase 39) unconditionally overwrites data-slot to \"input\" on its rendered element, which is pre-existing out-of-scope behavior, not a regression introduced here"
  - "Bundled the vitest.config.ts coverage.exclude removal into the same commit as the component/test changes, per the plan's own guidance that config-only, low-risk changes don't need a separate commit"

requirements-completed: [COMP-07]

# Metrics
duration: ~50min
completed: 2026-08-07
---

# Phase 40 Plan 04: Form to Fluent UI Migration Summary

**FormControl's Radix Slot replaced with the shared cloneElement `asChild` shim; form.tsx backfilled with 6 new tests and removed from coverage exclusions (87.16%/83.8%/73.44%/87.16% vs 71/82/70/71 thresholds).**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-07T11:50:06+08:00
- **Tasks:** 1/1
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Replaced `FormControl`'s `@radix-ui/react-slot` `Slot` usage with `isSingleRefCapableElement` + `React.cloneElement` from the shared `_shim-as-child.ts` (already extracted in 40-01), preserving exact single-child prop-merging behavior with no added wrapper DOM element
- Left `Form`, `FormField`, `useFormField`, and all react-hook-form (`Controller`/`FormProvider`/`useFormContext`/`useFormState`) logic completely untouched — confirmed via diff review
- Confirmed `FormLabel`'s existing Fluent `Label` (migrated in Phase 39 LEAF-03) continues to associate correctly via `htmlFor`/`id` with zero code changes required
- Created net-new `form.test.tsx` (form.tsx previously had zero test coverage) with 6 tests covering label/input id association, error-state ARIA wiring, description ARIA wiring (with and without concurrent error), no-wrapper-element verification, and `useFormField`'s outside-context throw behavior
- Removed `form.tsx` from `vitest.config.ts`'s `coverage.exclude` array; verified all 4 coverage thresholds (statements 71%, branches 82%, functions 70%, lines 71%) still pass with form.tsx's real coverage counted (measured: 87.16% / 83.8% / 73.44% / 87.16%)
- Verified `frontend/npm run build` exits 0

## Task Commits

1. **Task 1: Replace FormControl's Radix Slot with cloneElement shim and backfill test coverage** - `d3a820e` (feat)

**Plan metadata:** documented in this SUMMARY.md (per explicit execution instruction: STATE.md and ROADMAP.md updates skipped for this run)

_Note: Task used `tdd="true"` but was executed as a single bundled commit per the plan's own recommendation for config-only, low-risk changes (research Pitfall 3 / Open Question 1 guidance)._

## Files Created/Modified
- `frontend/src/components/ui/form.tsx` - `FormControl` now uses `isSingleRefCapableElement` + `React.cloneElement` instead of Radix `Slot`; all other exports (`Form`, `FormItem`, `FormLabel`, `FormDescription`, `FormMessage`, `FormField`, `useFormField`) unchanged
- `frontend/src/components/ui/form.test.tsx` - New file: 6 tests covering id/label association, error ARIA wiring, description ARIA wiring, no-wrapper-element behavior, and outside-context throw
- `frontend/vitest.config.ts` - Removed `"src/components/ui/form.tsx"` from `coverage.exclude`

## Decisions Made
- Replicated Radix `Slot`'s exact prop-merging semantics via `cloneElement` (merging `id`, `aria-describedby`, `aria-invalid`, and `className` via `cn()`) rather than wrapping the child in a `<div>`, matching the plan's explicit requirement that `FormControl` clone rather than wrap
- Rewrote the plan's Test 4 assertion (originally: assert `[data-slot="form-control"]` exists on the DOM and is an `<input>`) to instead assert: exactly one `getAllByRole("textbox")` element, its `tagName` is `INPUT`, and it directly carries the merged `id`/`aria-invalid`/`aria-describedby` attributes. Root cause: Fluent's `Input` adapter (from Phase 39) unconditionally sets `data-slot="input"` on its internally rendered native `<input>`, overwriting any `data-slot="form-control"` value passed in via cloned props. This is pre-existing Phase 39 behavior, confirmed out of scope for this plan — the rewritten assertion still fully proves the "no wrapper element, props merged directly onto child" behavior the test was designed to verify.
- Bundled the `vitest.config.ts` coverage-exclude removal into the same commit as the component/test changes, per the plan's own explicit recommendation (config-only, low build-risk change)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Test Correctness] Rewrote Test 4's assertion away from a data-slot DOM check**
- **Found during:** Task 1, while writing and running `form.test.tsx`
- **Issue:** The plan's behavior spec for Test 4 implied verifying `FormControl`'s cloned props landed on the DOM via a `data-slot="form-control"` selector. This failed with `expected null not to be null` because Fluent's `Input` adapter (introduced in Phase 39, out of scope here) internally overwrites `data-slot` to `"input"` regardless of what's cloned onto the child.
- **Fix:** Rewrote the assertion to check `getAllByRole("textbox")` returns exactly one element, its `tagName === "INPUT"`, and it carries the merged `id`/`aria-invalid`/`aria-describedby` attributes directly — proving the same underlying behavior (single element, props merged not wrapped) without depending on the clobbered `data-slot` value.
- **Files modified:** `frontend/src/components/ui/form.test.tsx`
- **Verification:** Confirmed via two throwaway probe test files (`__probe.test.tsx`, created and deleted) that dumped rendered DOM output, showing `<input data-slot="input" ...>` with no `form-control` data-slot present; confirmed this is pre-existing behavior by `git stash`-ing this plan's changes and observing the base commit's `Input` component already had this behavior in Phase 39's `input.tsx`.
- **Committed in:** `d3a820e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 test-correctness fix, Rule 1)
**Impact on plan:** Necessary correction to match actual Fluent `Input` adapter behavior from a prior phase; does not weaken test coverage — the rewritten assertion still fully verifies the no-wrapper, props-merged-onto-child behavior that was the actual intent of the plan's Test 4. No scope creep into `input.tsx`.

## Issues Encountered
- Full-suite coverage run (`npx vitest run --coverage`) surfaced 21-22 pre-existing test failures across 7 unrelated test files (`dry-run-report.test.tsx`, `hcp-profile-editor.test.tsx`, `persona-editor.test.tsx`, `prompts.test.tsx`, `user-personalization-dialog.test.tsx`, `training.test.tsx`, `user-pages.test.tsx`), all `getMultipleElementsFoundError` from `getByText` matching duplicate text spans rendered by Fluent's `<Tab>` component (introduced in 40-03's Tabs migration). Confirmed pre-existing and unrelated to this plan via `git stash` (reverting this plan's changes, re-running `hcp-profile-editor.test.tsx` against the 40-03 base commit, observing identical failures), then `git stash pop` to restore. Documented as Item 4 in `.planning/phases/40-composite-component-adapters/deferred-items.md` per the SCOPE BOUNDARY deviation rule — not fixed, out of scope for this plan's `files_modified` list.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `form.tsx` fully migrated off Radix `Slot`; only remaining Radix imports in the file are `@radix-ui/react-label`'s type import (`LabelPrimitive.Root` used purely for its `React.ComponentProps` type, not runtime usage) — not in scope for this plan (COMP-07 scoped only to `FormControl`'s `Slot` usage).
- Coverage-backfill sequencing pattern (write tests → remove from `coverage.exclude` → verify thresholds) demonstrated successfully; usable as a template for 40-05/40-06's `select.tsx`/`dropdown-menu.tsx` coverage backfills, per the plan's own stated purpose.
- Deferred Item 4 (Tabs-related `getByText` duplicate-match failures) should be considered before or during future plans that touch the affected 7 test files, though it does not block this plan or Phase 40 continuation.

---
*Phase: 40-composite-component-adapters*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: frontend/src/components/ui/form.tsx
- FOUND: frontend/src/components/ui/form.test.tsx
- FOUND: frontend/vitest.config.ts
- FOUND: .planning/phases/40-composite-component-adapters/40-04-SUMMARY.md
- FOUND: .planning/phases/40-composite-component-adapters/deferred-items.md
- FOUND commit d3a820e in git log
