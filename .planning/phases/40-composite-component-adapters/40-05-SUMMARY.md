---
phase: 40-composite-component-adapters
plan: 05
subsystem: ui
tags: [fluent-ui, griffel, react, card, design-tokens, vitest]

# Dependency graph
requires:
  - phase: 39-fluent-infrastructure-leaf-components
    provides: "button.styles.ts Griffel makeStyles precedent (useDestructiveStyles pattern), mergeClasses convention, FluentProvider theme bridge"
provides:
  - "Card (COMP-06) go/no-go decision resolved as Option B: plain divs retained, Fluent design tokens layered via Griffel makeStyles"
  - "card.styles.ts establishing the second Griffel-override file in the codebase, reusable pattern for any future plain-div component needing token-only styling"
affects: [40-composite-component-adapters, future-card-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Griffel makeStyles token-override layered on top of an unchanged plain-div/Tailwind structure (Option B pattern) for components where Fluent's real component semantics don't fit"
    - "mergeClasses(griffelStyles.root, cn(tailwindClasses, consumerClassName)) composition"

key-files:
  created:
    - frontend/src/components/ui/card.styles.ts
  modified:
    - frontend/src/components/ui/card.tsx
    - frontend/src/components/ui/card.test.tsx

key-decisions:
  - "Card (COMP-06) go/no-go resolved as Option B: keep plain <div>/<h4>/<p> structure, do NOT adopt Fluent's real Card component, because Fluent Card bakes in selectable-list semantics (selected/onSelectionChange/focus-ring-as-list-item) that don't match this codebase's plain-content-container usage"
  - "Griffel's borderColor/borderStyle/borderWidth shorthands are explicitly disallowed (UNSUPPORTED_CSS_PROPERTIES in @griffel/core) -- used the four per-side longhand color properties (borderTopColor/borderRightColor/borderBottomColor/borderLeftColor) instead of the borderColor shorthand"
  - "mergeClasses() internally coalesces all atomic/sequence-hashed Griffel classes together in its own algorithm-determined position, appending them after or interleaved with plain string classes regardless of argument call-order -- the plan's literal 'Griffel base then consumer override, in that order' framing describes call-order intent, not the final DOM class string's positional layout; the token-class-presence test was written to assert presence + CSSOM-rule correctness (mirroring button.test.tsx's precedent) rather than brittle positional indexing"

requirements-completed: [COMP-06]

# Metrics
duration: 16min
completed: 2026-08-07
---

# Phase 40 Plan 05: Card Fluent Token Migration (Option B) Summary

**Card's COMP-06 go/no-go decision resolved as Option B — plain div/h4/p structure retained unchanged, Fluent design tokens (colorNeutralStroke1, colorNeutralBackground1, borderRadiusMedium, shadow2) layered on via a new card.styles.ts Griffel makeStyles file.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-07T11:51:45+08:00
- **Completed:** 2026-08-07T12:07:23+08:00
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Resolved Card's (COMP-06) go/no-go decision as Option B, documented directly in card.styles.ts's file-level docstring and enforced by a new regression test asserting Card never renders a Fluent `fui-Card` class
- Created `card.styles.ts` mirroring Phase 39's `button.styles.ts` precedent, sourcing border/background/radius/shadow from verified Fluent design tokens (`tokens.colorNeutralStroke1`, `tokens.colorNeutralBackground1`, `tokens.borderRadiusMedium`, `tokens.shadow2`)
- Wired `Card`'s root className through `mergeClasses(styles.root, cn(...))`, preserving all 7 named exports (`Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent`) and all `data-slot` values and element types (div/h4/p) unchanged
- Extended `card.test.tsx` from 7 to 10 tests: token-class-presence + CSSOM-rule verification, and a structural-regression guard confirming Card renders as a plain `<div>`, not a Fluent `Card` component instance

## Task Commits

1. **Task 1: Document Card go/no-go decision and layer Fluent tokens via Griffel** - `72b8b16` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `frontend/src/components/ui/card.styles.ts` - New Griffel `makeStyles` file; `useCardStyles()` hook providing token-sourced border/background/radius/shadow overrides
- `frontend/src/components/ui/card.tsx` - `Card`'s root now calls `useCardStyles()` and merges the result via `mergeClasses`; all other 6 exports unchanged
- `frontend/src/components/ui/card.test.tsx` - Extended from 7 to 10 tests (2 new tests + no removals)

## Decisions Made
- **Option B confirmed** for Card (COMP-06): plain-div structure retained, Fluent's real `Card`/`CardPreview`/`CardHeader` components were never imported — verified via `grep -n "@fluentui/react-components.*Card\b" card.tsx` returning no matches
- **Griffel shorthand restriction discovered and worked around**: `borderColor` is in `@griffel/core`'s `UNSUPPORTED_CSS_PROPERTIES` list (along with `borderStyle`/`borderWidth`/`borderBlock*`/`borderInline*`) — resolved by setting the four per-side longhand properties (`borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`) individually instead of the shorthand
- **Token names verified against installed `.d.ts`** before use (`node_modules/@fluentui/tokens/dist/index.d.ts`): `colorNeutralStroke1`, `colorNeutralBackground1`, `borderRadiusMedium`, `shadow2` all confirmed present, per the plan's explicit "do not guess names" instruction
- **Test 2 rewritten from a positional-order assertion to a presence + CSSOM-rule assertion**: empirical testing showed Griffel's `mergeClasses()` coalesces all atomic/sequence-hashed classes together internally (not simple string concatenation in call order), so a strict "Griffel class appears at an earlier string index than the consumer class" check is not a reliable contract of the library's own algorithm. The revised test asserts both class families are present on the rendered element and that one of the Griffel-generated classes resolves (via the actual injected CSSOM stylesheet rule) to `background-color: var(--colorNeutralBackground1)`, matching the CSSOM-verification pattern already established in `button.test.tsx`'s destructive-override test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Griffel `borderColor` shorthand rejected at runtime**
- **Found during:** Task 1 (initial `card.styles.ts` implementation, first test run)
- **Issue:** Using `borderColor: tokens.colorNeutralStroke1` in the `makeStyles` call triggered a Griffel runtime warning (`@griffel/react: You are using unsupported shorthand CSS property "borderColor"`) — confirmed via `@griffel/core`'s `UNSUPPORTED_CSS_PROPERTIES` constant that this shorthand is disallowed by design (only the physical longhand color properties are supported)
- **Fix:** Replaced the single `borderColor` shorthand with the four explicit per-side longhands: `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`, all set to the same `tokens.colorNeutralStroke1` value
- **Files modified:** `frontend/src/components/ui/card.styles.ts`
- **Verification:** Re-ran `npx vitest run src/components/ui/card.test.tsx` — no Griffel runtime warning on subsequent runs
- **Committed in:** `72b8b16` (Task 1 commit)

**2. [Rule 1 - Bug] Test 2's positional-ordering assertion was based on an incorrect assumption about `mergeClasses()` internals**
- **Found during:** Task 1 (test-writing phase, TDD RED→GREEN iteration)
- **Issue:** The plan's `<behavior>` section specified asserting the Griffel class appears "in that order (Griffel base, then consumer override)" as a simple string-index comparison. Empirical testing (a throwaway debug test rendering the actual className string) showed Griffel's `mergeClasses()` internally batches all sequence-hashed atomic classes together via its own hashing/lookup-table algorithm (`node_modules/@griffel/core/src/mergeClasses.js`), which does not preserve simple positional call-order in the final className string
- **Fix:** Rewrote the test to assert (a) presence of at least one Griffel-generated atomic class (regex-matched against Griffel's known naming patterns), (b) presence of the consumer `custom-card` class, and (c) that one of the Griffel classes resolves via the real injected CSSOM stylesheet rule to the expected `background-color: var(--colorNeutralBackground1)` declaration — the same verification strategy already used in Phase 39's `button.test.tsx` for its destructive-override test
- **Files modified:** `frontend/src/components/ui/card.test.tsx`
- **Verification:** All 10 tests pass (`npx vitest run src/components/ui/card.test.tsx`)
- **Committed in:** `72b8b16` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug/incorrect-assumption fixes discovered during implementation and testing)
**Impact on plan:** Both fixes were necessary for the plan's own stated behavior (token-sourced styling, token-class-presence test) to actually work correctly against the installed Griffel version. No scope creep — Option B's structural boundary (no Fluent Card component adoption) was fully honored.

## Issues Encountered
- `node_modules` was missing in this execution's worktree; ran `npm ci` in `frontend/` before any test/build commands, per the parallel-execution setup instructions. No other environment issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Card (COMP-06) is fully resolved; no further work needed on this component for the remainder of Phase 40
- The Option-B Griffel-token-override pattern established here (plain-div + `*.styles.ts` token layer) is directly reusable for any other Phase 40 composite where a similar go/no-go decision favors the simpler internal-structure path
- Full `frontend` test suite run (`npx vitest run`) shows 20 pre-existing test failures across 6 files (`user-personalization-dialog.test.tsx`, `dry-run-report.test.tsx`, `hcp-profile-editor.test.tsx`, `prompts.test.tsx`, `training.test.tsx`, `user-pages.test.tsx`) — confirmed unrelated to this plan (none import Card/CardHeader/CardTitle/CardContent; git status shows only card.tsx/card.styles.ts/card.test.tsx modified). These appear to originate from other in-flight Phase 40 work (Tabs migration, based on the `fui-Tab`/`data-state` DOM output visible in the failure traces) and are out of scope for this plan per the deviation rules' scope-boundary guidance.

---
*Phase: 40-composite-component-adapters*
*Plan: 05*
*Completed: 2026-08-07*
