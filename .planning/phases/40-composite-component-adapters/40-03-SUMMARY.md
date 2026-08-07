---
phase: 40-composite-component-adapters
plan: 03
subsystem: ui
tags: [fluentui, react, tabs, tooltip, radix-migration, accessibility]

# Dependency graph
requires:
  - phase: 40-composite-component-adapters
    provides: "Dialog (40-01) and Sheet (40-02) Fluent UI adapter patterns, hand-built Context precedent, shared _shim-as-child.ts guard"
  - phase: 39-fluent-infrastructure-leaf-components
    provides: "FluentProvider mounted at app root, Checkbox's manual data-state re-emission precedent (39-05)"
provides:
  - "Tabs (Tabs/TabsList/TabsTrigger/TabsContent) now internally backed by Fluent's TabList/Tab via a hand-built React Context wrapper, with manual data-state re-emission preserving 3 pre-existing Playwright E2E specs unmodified"
  - "Tooltip (Tooltip/TooltipTrigger/TooltipContent/TooltipProvider) now internally backed by Fluent's single-component Tooltip, with relationship default injection and side-to-positioning translation"
affects: [41-remaining-composite-adapters, e2e-test-suite, admin-skill-editor, admin-dry-run-report, conference-module, voice-session]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-built Context wrapper for composites with no native Fluent panel primitive (Tabs), extending the Dialog/Sheet Context precedent from 40-01/40-02"
    - "Marker-component pattern for adapting compound-children APIs (TooltipTrigger/TooltipContent) onto Fluent single-component APIs (Tooltip's children+content props) via React.Children.toArray + type-matching"
    - "Manual data-state re-emission derived strictly from the adapter's own known value prop, never read back from Fluent internals (Tabs, matching Checkbox's 39-05 precedent)"
    - "Required-prop default injection for Fluent props with no default (Tooltip's relationship: 'label' | 'description' | 'inaccessible')"
    - "Legacy prop-value translation to Fluent's direction-agnostic equivalents (side='left'/'right' -> positioning='before'/'after')"

key-files:
  created:
    - frontend/src/components/ui/tabs.test.tsx
  modified:
    - frontend/src/components/ui/tabs.tsx
    - frontend/src/components/ui/tooltip.tsx
    - frontend/src/components/ui/tooltip.test.tsx

key-decisions:
  - "Tabs matches Radix's original render-both + hidden-toggle behavior (both panels stay mounted, inactive one gets `hidden` + data-state=inactive) rather than conditionally unmounting, confirmed via an empirical throwaway probe against the original Radix tabs.tsx and validated against skill-editor.tsx:924's forceMount/hidden usage"
  - "Tooltip's relationship default is injected as 'label' (matching the closest semantic equivalent to Radix's implicit accessible-name behavior for the icon-only-button-dominant call sites), overridable via an explicit relationship prop on TooltipContent"
  - "Tooltip's TooltipTrigger/TooltipContent become non-rendering marker components; the root Tooltip component extracts their children via React.Children.toArray + component-identity matching and renders a single FluentTooltip, since Fluent has no separate trigger/content sub-components"
  - "No isSingleRefCapableElement shim needed for TooltipTrigger -- Fluent's own Tooltip clones its single child internally via applyTriggerPropsToChildren/getTriggerChild (verified via source read), matching Dialog's FluentDialogTrigger precedent from 40-01"
  - "TooltipProvider becomes a no-op passthrough (Fragment) -- FluentProvider (mounted at app root since Phase 39) already supplies the TooltipVisibilityProvider context Fluent's Tooltip needs; delayDuration is preserved as an accepted-but-unused prop for signature compatibility"

requirements-completed: [COMP-05]

# Metrics
duration: 55min
completed: 2026-08-07
---

# Phase 40 Plan 03: Tabs + Tooltip Fluent UI Migration Summary

**Tabs migrated to a hand-built React Context wrapper around Fluent's TabList/Tab with manual data-state re-emission; Tooltip migrated to Fluent's single-component Tooltip with relationship default injection and side-to-positioning translation — both as two independently revertible commits.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-07T02:17:32Z (approx, base commit 2bc8a70)
- **Completed:** 2026-08-07T03:12:38Z
- **Tasks:** 2
- **Files modified:** 4 (2 created/modified per task)

## Accomplishments
- Tabs (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) is now internally backed by `@fluentui/react-tabs`'s `TabList`/`Tab`, using a hand-built `TabsContext` since Fluent has no panel/content primitive.
- Tabs' `data-state="active"/"inactive"` is manually re-emitted on both the trigger and the content panel, derived strictly from the adapter's own `value` prop — never read from Fluent internals — preserving all 3 pre-existing Playwright E2E specs (`conference.spec.ts`, `admin-dry-run.spec.ts`, `admin-skill-editor.spec.ts`) with zero spec-file edits (confirmed via empty `git diff --stat`).
- Tooltip (`Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`) is now internally backed by `@fluentui/react-tooltip`'s single-component `Tooltip`, with `TooltipTrigger`/`TooltipContent` becoming non-rendering marker components that the root `Tooltip` unwraps.
- Fluent's required `relationship` prop (no default) is defaulted to `"label"` when the consumer doesn't specify one, and legacy `side="left"/"right"` values are translated to Fluent's direction-agnostic `positioning="before"/"after"`.
- Both migrations landed as two independent, individually revertible commits per the plan's explicit requirement.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Tabs to Fluent TabList/Tab with hand-built Context + data-state re-emission** - `0b89d26` (feat)
2. **Task 2: Migrate Tooltip to Fluent Tooltip with relationship default injection** - `a2678b4` (feat)

_Note: Both tasks were TDD-flagged; tests were written alongside the implementation in the same commit rather than as separate RED/GREEN commits, since both adapters required substantial upfront empirical investigation (throwaway probes against the original Radix implementations) before any test could be written meaningfully._

## Files Created/Modified
- `frontend/src/components/ui/tabs.tsx` - Fluent TabList/Tab-backed adapter with `TabsContext` (controlled/uncontrolled `value`/`onValueChange`), manual `data-state` re-emission on `TabsTrigger` and `TabsContent`, render-both + `hidden`-toggle panel behavior
- `frontend/src/components/ui/tabs.test.tsx` - New test file (none existed before): 5 tests covering active/inactive content visibility, trigger/panel `data-state`, `onValueChange` firing, uncontrolled `defaultValue` usage
- `frontend/src/components/ui/tooltip.tsx` - Fluent `Tooltip`-backed adapter with marker-component unwrapping, `relationship="label"` default injection, `side`-to-`positioning` translation, `withArrow` always enabled to preserve the original's always-visible arrow
- `frontend/src/components/ui/tooltip.test.tsx` - Extended with 2 new tests (relationship default-injection probe via `aria-label`, explicit `relationship="description"` override via `aria-describedby`) alongside the 2 preserved existing tests

## Decisions Made
- **Render-both vs conditional-unmount for TabsContent:** Confirmed empirically (throwaway Vitest probe against the original Radix `tabs.tsx`, deleted after use) that Radix's `TabsContent` renders both panels simultaneously, toggling `hidden` + `data-state` rather than unmounting the inactive one. Matched this exact behavior rather than the plan's own example Pattern 3 sketch (which showed conditional `return null`), because `skill-editor.tsx:924` explicitly relies on render-both semantics via its own `forceMount hidden={activeTab !== "settings"}` prop passthrough — a conditional-unmount adapter would have conflicted with that real call site.
- **Tooltip's compound-children API preserved via marker components + extraction, not a Fluent-native shape:** Since Fluent's `Tooltip` is a single component with `children` (trigger) and `content` (slot) props, and this codebase's existing API is `<Tooltip><TooltipTrigger/><TooltipContent/></Tooltip>`, the adapter's root `Tooltip` walks its `children` via `React.Children.toArray` + `child.type` identity comparison to find the `TooltipTrigger`/`TooltipContent` marker elements, then renders one `FluentTooltip` under the hood. This preserves the full existing JSX call-site shape for all ~20 consumer files with zero changes required to any of them.
- **No `isSingleRefCapableElement` shim needed for `TooltipTrigger`:** Verified via reading `useTooltipBase.js` source that Fluent's `Tooltip` already clones its single trigger child internally (`applyTriggerPropsToChildren`/`getTriggerChild`), the same mechanism `DialogTrigger` relies on (per `dialog.tsx`'s 40-01 doc comment) — so `TooltipTrigger` in this adapter is a pure pass-through marker, and the shim reserved for Sheet/DropdownMenu triggers was not needed here.
- **`relationship="label"` chosen as the default** over `"description"` or `"inaccessible"` because the confirmed consumer population (repo-wide grep, ~20 `asChild` call sites) is overwhelmingly icon-only buttons that need an accessible name, which `"label"` provides via `aria-label`/`aria-labelledby`.
- **`side="left"/"right"` map to Fluent's `positioning="before"/"after"`** (not `"start"/"end"` used by Sheet's `position`, a different Fluent API) since Fluent's `PositioningShorthandValue` for Tooltip uses `before`/`after` as the direction-agnostic horizontal equivalents; `"top"/"bottom"` map to `"above"/"below"` defensively even though no consumer currently uses them.
- **`TooltipProvider` becomes a no-op `Fragment` wrapper** rather than wiring any Fluent provider, since `FluentProvider` (mounted at the app root since Phase 39) already supplies the `TooltipVisibilityProvider` context Fluent's `Tooltip` internally consumes via `useTooltipVisibility_unstable()` — no additional provider component exists in Fluent's public API for tooltip-specific configuration like `delayDuration`.

## Deviations from Plan

None of Rules 1-4 were triggered as unplanned architectural changes or bug fixes to consumer code. Two out-of-scope, pre-existing E2E failures were discovered during verification and logged (not fixed) per the deviation-rules scope boundary:

### Deferred (out of scope, logged to deferred-items.md)

**1. [Scope boundary] `admin-skill-editor.spec.ts` "settings tab can save form values" fails independent of the Tabs migration**
- **Found during:** Task 1 E2E verification (running all 3 confirmed E2E spec files).
- **Confirmed pre-existing:** Reproduced identically against the original, pre-migration Radix `tabs.tsx` via `git stash`.
- **Action:** Not fixed — documented in `.planning/phases/40-composite-component-adapters/deferred-items.md` (Item 2). All other 33/34 tests across the 3 target spec files pass, including every `data-state` assertion this plan specifically targets.

**2. [Scope boundary] `voice-session.spec.ts` suite fails on empty/unseeded scenarios list, independent of the Tooltip migration**
- **Found during:** Task 2 E2E spot-check (scoped run touching real Tooltip consumers: `voice-controls.tsx`, `left-panel.tsx`, `right-panel.tsx`).
- **Confirmed pre-existing:** Reproduced identically against the original, pre-migration Radix `tooltip.tsx` via `git stash` — the failure (`scenarios[0].id` TypeError) occurs before any Tooltip-rendering code even runs; same root-cause class as deferred Item 1 (unseeded local DB).
- **Action:** Not fixed — documented in `deferred-items.md` (Item 3). Tooltip correctness was instead verified via the 4 passing unit tests, `npx tsc -b` clean across all ~20 `asChild` consumer call sites, and `npm run build` exiting 0.

---

**Total deviations:** 0 auto-fixed. 2 pre-existing out-of-scope E2E failures logged to `deferred-items.md`, confirmed unrelated via stash-and-rerun against the original pre-migration implementations.
**Impact on plan:** None — both migrations achieved 100% of their targeted, in-scope test assertions.

## Issues Encountered
- The plan's own example Pattern 3 code sketch for `TabsContent` (conditional `return null` when inactive) was superseded by empirical findings during `read_first` investigation — resolved per the plan's own explicit instruction to "confirm this reasoning empirically... document the decision in the SUMMARY" (see Decisions Made above).
- A TypeScript narrowing issue arose from using `let` variables mutated inside a `React.Children.forEach` callback in the initial Tooltip draft (`Property 'props' does not exist on type 'never'`) — resolved by switching to `React.Children.toArray(...).find(...)` with type-predicate callbacks instead of mutable closures, which `tsc -b` and all tests confirmed clean.
- Both `npx playwright test` invocations initially ran without `--config=e2e/playwright.config.ts`, causing all tests to fail with missing auth storage-state files (skipping the `setup` project that generates them) — resolved per CLAUDE.md's own documented Gotcha #5 ("Playwright needs `--config=e2e/playwright.config.ts` — Default config path differs").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tabs and Tooltip are both fully Fluent-backed with zero consumer-facing API changes; all ~26 combined consumer files (7 Tabs roots, ~20 Tooltip `asChild` call sites) compile and build unchanged.
- Two remaining pre-existing, unrelated E2E gaps (documented in `deferred-items.md` Items 2 and 3) are candidates for a future quick-task cleanup but do not block subsequent composite-adapter phases.
- Ready for the next wave of Phase 40/41 composite migrations (e.g., Select, DropdownMenu) to reuse the marker-component-unwrapping pattern established here for any other composite whose public API doesn't map 1:1 onto a single Fluent component.

---
*Phase: 40-composite-component-adapters*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: frontend/src/components/ui/tabs.tsx
- FOUND: frontend/src/components/ui/tabs.test.tsx
- FOUND: frontend/src/components/ui/tooltip.tsx
- FOUND: frontend/src/components/ui/tooltip.test.tsx
- FOUND: .planning/phases/40-composite-component-adapters/40-03-SUMMARY.md
- FOUND: .planning/phases/40-composite-component-adapters/deferred-items.md
- FOUND commit: 0b89d26 (feat(40-03): migrate Tabs to Fluent UI)
- FOUND commit: a2678b4 (feat(40-03): migrate Tooltip to Fluent UI)
