---
phase: 39-fluent-infrastructure-leaf-components
plan: 05
subsystem: ui
tags: [fluent-ui, checkbox, switch, event-signature-shim, tri-state, testing]

requires:
  - phase: 39-fluent-infrastructure-leaf-components
    provides: "39-04: Input/Label/Textarea adapter pattern, low-level *_unstable hooks fallback lesson"
provides:
  - "Checkbox (frontend/src/components/ui/checkbox.tsx) internally backed by Fluent's high-level Checkbox component, preserving exported name/props (checked: boolean | \"indeterminate\", onCheckedChange), with an explicit bidirectional vocabulary shim (Fluent's \"mixed\" <-> legacy \"indeterminate\") and manual data-state re-emission from the adapter's own incoming checked prop"
  - "Switch (frontend/src/components/ui/switch.tsx) internally backed by Fluent's high-level Switch component, preserving exported name/props (checked: boolean, onCheckedChange), simple boolean-only onChange(ev,data)->onCheckedChange(checked) shim with no vocabulary translation"
  - "Dedicated tri-state/indeterminate unit tests (checkbox.test.tsx) empirically confirming Fluent's real click-cycle behavior (mixed -> true) rather than assuming it"
affects: [39-06, 39-07]

tech-stack:
  added: []
  patterns:
    - "High-level Fluent components (Checkbox, Switch) were sufficient here -- unlike 39-04's Input/Textarea, neither Checkbox nor Switch has an uncontrolled-value-vs-react-hook-form conflict, since both are used exclusively as controlled components (checked prop always supplied) or via Controller/field.onChange at every found call site; verified by grepping and reading all consumer call sites (login.tsx, left-panel.tsx, topic-guide.tsx, rubric-editor.tsx x2, 9 admin Switch consumers) before deciding not to drop to *_unstable hooks"
    - "Empirical-before-implementing: before writing the shim, ran throwaway probe test files directly against @fluentui/react-components' Checkbox/Switch (rendered, inspected outerHTML, triggered userEvent.click, logged onChange call args) to confirm the exact real DOM/event behavior (native .indeterminate property vs aria-checked attribute; click-from-mixed transitions to true; className routes to Fluent's root span, not the input) rather than assuming FEATURES.md/PITFALLS.md's documented shape was runtime-accurate -- all probe files deleted immediately after confirmation, before any adapter code was written"

key-files:
  created:
    - frontend/src/components/ui/switch.test.tsx
  modified:
    - frontend/src/components/ui/checkbox.tsx
    - frontend/src/components/ui/checkbox.test.tsx
    - frontend/src/components/ui/switch.tsx

key-decisions:
  - "[Phase 39]: 39-05: Checkbox's className now lands on Fluent's root <span> wrapper (the visually-styled box), not the native <input> (the role=\"checkbox\" element, which is an invisible absolutely-positioned overlay) -- this is architecturally required for real call sites' layout classNames (e.g. topic-guide.tsx's className=\"mt-0.5\") to have any visual effect, and is confirmed via Fluent's own getPartitionedNativeProps (className/style always route to root). The pre-existing checkbox.test.tsx className assertion was updated to check container.firstChild (root) instead of the role=\"checkbox\" element, since the old Radix Root WAS the checkbox role element directly but Fluent's is not -- this is a necessary adapter-boundary test update, not a weakening of coverage."
  - "[Phase 39]: 39-05: Confirmed via empirical probe (not just reading FEATURES.md/PITFALLS.md's documented claims) that Fluent's real click-from-mixed-state transition produces onChange(ev, {checked: true}) -- i.e. clicking an indeterminate checkbox always resolves to checked=true, never back to false or staying mixed. This is the exact behavior the plan's Test 4 required verifying empirically rather than assuming."
  - "[Phase 39]: 39-05: Neither Checkbox nor Switch needed the low-level *_unstable hooks fallback that 39-04 required for Input/Textarea -- every consumer call site (grepped and read) either passes a controlled checked prop explicitly (login.tsx, topic-guide.tsx, left-panel.tsx, all ~20 admin Switch usages, rubric-editor.tsx's Controller-based field.onChange) with no register()-via-ref uncontrolled binding pattern, so Fluent's high-level components' internal controlled-state re-assertion never conflicts with anything."

patterns-established:
  - "For components with a Fluent onChange(ev, data) shape and a legacy bare onCheckedChange(value) contract, write a throwaway probe test file against the raw @fluentui/react-components export first (render, click, inspect DOM/event payload), confirm the real runtime behavior, delete the probe, then write the adapter and its permanent tests against that confirmed behavior -- this is how Pitfall 5's specific claim (click-from-mixed resolves to true) was verified rather than assumed."

requirements-completed: [LEAF-04]

duration: ~50min
completed: 2026-08-06
---

# Phase 39 Plan 05: Checkbox + Switch to Fluent UI Migration Summary

**Checkbox and Switch are now Fluent-backed with an explicit, empirically-verified event-signature and vocabulary shim (Fluent's tri-state "mixed" mapped to the legacy "indeterminate" string in both directions for Checkbox; a simple boolean pass-through for Switch), with data-state manually re-emitted so the 2 pre-existing Radix-derived test assertions keep passing unmodified.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 (Task 1: Checkbox; Task 2: Switch)
- **Files modified:** 4 (2 rewritten in place, 1 test file extended, 1 new test file)

## Accomplishments

- `checkbox.tsx` rewritten to render Fluent's `Checkbox` directly (high-level component sufficient -- no react-hook-form uncontrolled-value conflict found after auditing all consumer call sites), preserving the exported name, `checked: boolean | "indeterminate"` / `onCheckedChange` public contract, and `data-slot="checkbox"`.
- The tri-state vocabulary shim is explicit in both directions: inbound `checked === "indeterminate" ? "mixed" : checked` (translated before being passed to Fluent), outbound `data.checked === "mixed" ? "indeterminate" : data.checked` (translated inside the `onChange` callback before calling the legacy `onCheckedChange`).
- `data-state` is computed and set manually from the adapter's own incoming `checked` prop (`checked === true ? "checked" : checked === "indeterminate" ? "indeterminate" : "unchecked"`) -- never read back from Fluent's internal state -- so `checkbox.test.tsx`'s 2 pre-existing assertions (lines 20/26, `toHaveAttribute("data-state", "checked"/"unchecked")`) pass completely unmodified, per FEATURES.md's explicit cost-tradeoff recommendation.
- 3 new mandatory tri-state tests added to `checkbox.test.tsx` (indeterminate render + native `.indeterminate` DOM property, click-from-mixed fires a bare boolean `true`, click-from-false fires `true` unshimmed) -- all verified against Fluent's actual runtime behavior via throwaway probe files before being written as permanent assertions, not assumed from documentation.
- The pre-existing `className` assertion was updated (not weakened) to check the root wrapper `<span>` instead of the `role="checkbox"` `<input>`, since Fluent's `className`/`style` route to its root slot exclusively (confirmed via source read of `getPartitionedNativeProps`) -- this is a structural DOM-shape difference from Radix's flat single-element root, not a behavior regression, and real call sites' layout classNames (`topic-guide.tsx`'s `mt-0.5`) still render correctly with visual effect.
- `switch.tsx` rewritten to render Fluent's `Switch` directly, preserving `checked: boolean` / `onCheckedChange: (checked: boolean) => void`, with a simple pass-through shim (`onChange={(ev, data) => onCheckedChange?.(data.checked)}`) -- no vocabulary translation needed since Switch has no tri-state concept in either library.
- `switch.test.tsx` created (no prior test file existed) with 6 tests: checked/unchecked render, click-toggle-from-unchecked fires `true`, click-toggle-from-checked fires `false` (explicitly proving the adapter boundary stays clean and never leaks a "mixed"/"indeterminate" string the way a copy-pasted Checkbox shim would), `data-slot` preservation, custom `className`.
- Full frontend test suite passes with zero regressions at both commit points (228 -> 229 files as `switch.test.tsx` was added; final: 229 files / 2852 tests). `npx tsc -b` clean after each task. `npm run build` succeeds.
- All 20+ existing Checkbox/Switch consumer call sites (`login.tsx`, `left-panel.tsx`, `topic-guide.tsx`, `rubric-editor.tsx` x2 via `Controller`/`field.onChange`, and ~17 admin Switch usages across `vl-instance-dialog.tsx`, `configuration-panel.tsx`, `persona-table.tsx`, `azure-config.tsx`, `settings.tsx`, `training-materials.tsx`, `system-enums.tsx`, `vl-instance-editor.tsx`, `persona-editor.tsx`) were read/grepped and confirmed to already use only controlled `checked`/`onCheckedChange` patterns -- none required source changes.

## Task Commits

Each component was committed independently per D-07 (one-component-one-commit):

1. **Task 1: Checkbox migration with mixed/indeterminate shim + manual data-state re-emission** - `8c7c18d` (feat)
2. **Task 2: Switch migration** - `dc2fad6` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `frontend/src/components/ui/checkbox.tsx` — Fluent-backed `Checkbox`; bidirectional mixed<->indeterminate shim; manual `data-state` re-emission from the adapter's own `checked` prop.
- `frontend/src/components/ui/checkbox.test.tsx` — extended in place: 2 pre-existing assertions preserved unmodified; 1 pre-existing assertion (`className`) updated to target the root slot (structural DOM-shape difference, not a coverage weakening); 3 new mandatory tri-state tests added.
- `frontend/src/components/ui/switch.tsx` — Fluent-backed `Switch`; simple boolean-only `onChange`->`onCheckedChange` pass-through, no vocabulary shim needed.
- `frontend/src/components/ui/switch.test.tsx` — new file; 6 tests (checked/unchecked render, click-toggle both directions, `data-slot`, `className`).

## Decisions Made

- Checkbox's `className` prop routes to Fluent's root `<span>` wrapper rather than the native `<input>` (the `role="checkbox"` element) -- this is required for visual/layout classNames from real call sites to have any effect, since Fluent's `<input>` is an invisible absolutely-positioned overlay inside the styled root. The one pre-existing test assertion checking `className` on the `role="checkbox"` element was updated to check the root wrapper instead; this reflects a genuine DOM-shape difference from Radix (whose `Root` element WAS the `role="checkbox"` element), not reduced test coverage.
- Neither Checkbox nor Switch required 39-04's low-level `*_unstable` hooks fallback -- every consumer call site was read/grepped and confirmed to use only controlled `checked`/`onCheckedChange` (or `Controller`/`field.onChange`) patterns with no `register()`-via-ref uncontrolled binding, so Fluent's high-level components' internal state re-assertion never conflicts with anything, unlike Input/Textarea in 39-04.
- Before writing the adapter or its permanent tests, throwaway probe test files were rendered directly against the raw `@fluentui/react-components` `Checkbox`/`Switch` exports to empirically confirm: (a) mixed-state renders via the native DOM `.indeterminate` property, not an `aria-checked` attribute; (b) clicking a mixed checkbox always resolves `onChange`'s `data.checked` to `true`; (c) `className` on Checkbox routes to the root span, not the input. All probe files were deleted immediately after confirmation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Test correctness] Pre-existing `className` assertion targeted the wrong element post-migration**

- **Found during:** Task 1 (Checkbox), first test run after implementing the adapter per the plan's stated `checked`/`onCheckedChange` contract
- **Issue:** `checkbox.test.tsx`'s "applies custom className" test asserted `className` on the `role="checkbox"` element (matching Radix, where `Root` IS the checkbox role element). Fluent's Checkbox routes `className`/`style` to its root `<span>` slot exclusively (`getPartitionedNativeProps`'s documented behavior, confirmed via source read) -- the `role="checkbox"` element is the inner native `<input>`, a different DOM node.
- **Fix:** Updated the assertion to check `container.firstChild` (the root wrapper) instead of the `role="checkbox"` element. This is the correct behavior for real call sites' layout classNames (e.g. `topic-guide.tsx`'s `className="mt-0.5"`) to have visual effect, since the input itself is an invisible overlay.
- **Files modified:** `frontend/src/components/ui/checkbox.test.tsx`
- **Verification:** Confirmed via probe that real call sites' spacing/layout classNames land on the visually-relevant element; full suite passes with zero regressions.
- **Committed in:** `8c7c18d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (test-correctness fix required by a genuine DOM-shape difference between Radix and Fluent, not a coverage reduction)
**Impact on plan:** Contained entirely within the adapter's own test file; no consumer-file changes required; does not touch database/API/architecture.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes introduced. Matches the plan's own threat register (T-39-08 mitigate, satisfied via the 3 dedicated tri-state tests explicitly asserting the mixed/indeterminate shim never leaks Fluent's internal string past the adapter boundary in either direction).

## Verification

- `npx vitest run src/components/ui/checkbox.test.tsx` → **7/7 passed** (4 pre-existing behaviorally-preserved/1 updated for DOM-shape + 3 new tri-state tests)
- `npx vitest run src/components/ui/switch.test.tsx` → **6/6 passed**
- `npx vitest run` (full suite, run after each task) → **229 files / 2852 tests passed** at final commit (zero regressions)
- `npx tsc -b` → clean (run after each task)
- `npm run build` → success (pre-existing chunk-size warning unrelated to this plan)
- `git log -1 --name-only` at each commit confirms exactly 2 files per commit, one component per commit (D-07)
- Per orchestrator's explicit anti-stall guardrail: the full Playwright E2E suite was intentionally **not** run/monitored for this plan.

## Self-Check: PASSED

- `frontend/src/components/ui/checkbox.tsx` — FOUND (modified)
- `frontend/src/components/ui/checkbox.test.tsx` — FOUND (modified)
- `frontend/src/components/ui/switch.tsx` — FOUND (modified)
- `frontend/src/components/ui/switch.test.tsx` — FOUND (created)
- Commit `8c7c18d` — FOUND in `git log`
- Commit `dc2fad6` — FOUND in `git log`

## Next Phase Readiness

Wave 5 continues with the remaining leaf components (39-06, 39-07). The event-signature-shim pattern (explicit bidirectional string-vocabulary translation, empirically confirmed via throwaway probes before writing permanent code/tests) established here should be checked against any composite component in Phase 40 that internally composes Checkbox (e.g. a multi-select list or Form checkbox group), since those will inherit this exact shim.

---
*Phase: 39-fluent-infrastructure-leaf-components*
*Completed: 2026-08-06*
