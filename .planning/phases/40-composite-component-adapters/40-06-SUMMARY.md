---
phase: 40-composite-component-adapters
plan: 06
subsystem: ui
tags: [fluent-ui, dropdown, react, select, aria, vitest, userevent]

# Dependency graph
requires:
  - phase: 40-composite-component-adapters
    provides: "40-05 Card migration precedent; FluentProvider theme bridge; data-slot preservation convention"
provides:
  - "Select (COMP-03) migrated to a Fluent UI v9 Dropdown adapter, preserving all 10 named exports, the single-value value/onValueChange(string) controlled API, and every data-slot attribute for all consumer files"
  - "selectFluentOption test helper (test-utils.tsx) — the reusable pattern for driving a Fluent Dropdown inside a modal Dialog focus-trap under jsdom"
  - "afterEach(cleanup) globally registered in setup.ts — portalled Fluent overlays no longer leak between tests"
affects: [40-composite-component-adapters, 41-icon-toast-adapter-layers, all-select-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radix nested compound surface (Select > SelectTrigger/SelectValue + SelectContent > SelectItem) collapsed onto a single Fluent Dropdown via value(display text)+selectedOptions(array)+onOptionSelect(ev,data), with the legacy value/onValueChange(string) API shimmed"
    - "Display text derived by walking composed children for the matching SelectItem's rendered text (Fluent does not auto-derive it from selectedOptions)"
    - "selectFluentOption: waitFor retry driving one action per attempt (branch on aria-expanded, never {Escape}) + userEvent.setup({ delay: null }) to survive full-suite CPU contention"

key-files:
  created:
    - frontend/src/components/ui/select.test.tsx
  modified:
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/admin/__tests__/assign-hcp-dialog.test.tsx
    - frontend/src/components/admin/user-personalization-dialog.test.tsx
    - frontend/src/test/setup.ts
    - frontend/src/test/test-utils.tsx
    - frontend/vitest.config.ts

key-decisions:
  - "Display text is NOT derivable from Fluent Dropdown's selectedOptions alone — the closed trigger renders whatever its `value` prop holds. The adapter therefore walks the composed children to find the SelectItem whose `value` prop matches the current value and reads its rendered text, mirroring how Radix SelectValue surfaced the selected item's content."
  - "SelectScrollUpButton/SelectScrollDownButton kept as no-op exports (return null) — Fluent's listbox scrolls natively; consumers importing them do not error."
  - "inlinePopup on Fluent Dropdown was tested and REJECTED — under jsdom it prevents the listbox from opening at all."
  - "Keyboard nav ({ArrowDown}/{Enter}) was tested: stable standalone but fails inside the modal Dialog focus-trap (tabster intercepts keydown on the portalled listbox) — rejected in favor of pointer clicks."
  - "ROOT CAUSE of the full-suite-only flake: userEvent's default `delay: 0` inserts a real setTimeout(0) between click sub-events; under 8-fork CPU contention the macrotask queue starves and each click balloons to seconds, exhausting the retry budget before a click lands. Fix: userEvent.setup({ delay: null }) dispatches sub-events on a synchronous microtask chain, immune to macrotask starvation, while the 50ms real-time waitFor interval still flushes effects between attempts. The two dialog tests passed in isolation regardless; delay:null is what made them deterministic in the full run."

requirements-completed: [COMP-03]

# Metrics
completed: 2026-08-07
---

# Phase 40 Plan 06: Select Fluent UI Migration Summary

**Select (COMP-03) migrated from the Radix-backed compound surface to a Fluent UI v9 `Dropdown` adapter — all 10 named exports, the single-value `value`/`onValueChange(string)` controlled API, and every `data-slot` attribute preserved so all consumer files work unmodified.**

## Accomplishments

- **select.tsx** — Fluent `Dropdown` + `Option` behind the legacy Select surface. The nested Radix `Select > SelectTrigger/SelectValue + SelectContent > SelectItem` tree collapses onto a single `<Dropdown>` driven by `value` (display text) + `selectedOptions` (array) + `onOptionSelect(ev, data)`. The consumer-facing `value`/`onValueChange(string)` API is shimmed intact; `handleOptionSelect` round-trips `data.optionValue` back through `onValueChange`. Display text is derived by walking composed children for the matching `SelectItem`. `SelectTrigger` identifying props (data-testid, aria-label, className, id, size) are hoisted onto the real Fluent trigger button. Scroll buttons retained as no-op exports.

- **select.test.tsx** (net-new, 10 tests) — display text in trigger; listbox + option ARIA roles/names; `onValueChange` receives the value prop (not display text); `data-slot` presence on composed parts; `size="sm"` → `data-size="sm"`; scroll-button no-ops; RHF Controller-style `onChange`; uncontrolled `defaultValue` + internal state; nested-element display-text composition; group/label/separator slots. **Coverage: 98.75% stmts / 88% branch / 100% funcs.**

- **selectFluentOption helper** (test-utils.tsx) — drives a Fluent Dropdown under a modal Dialog focus-trap via a `waitFor` retry: one action per attempt, branch on `aria-expanded`, never `{Escape}` (which would close the enclosing modal). Documented requirement to pair with `userEvent.setup({ delay: null })`.

- **assign-hcp-dialog + user-personalization-dialog tests** — migrated their Select interactions to the helper, wrapped interactive renders in `FluentProvider`, and set `userEvent.setup({ delay: null })` on all 7 setups so clicks dispatch synchronously and stay deterministic under full-suite CPU contention.

- **setup.ts** — registered `afterEach(cleanup)` so portalled Fluent overlays don't leak into the next test's DOM.

- **vitest.config.ts** — removed select.tsx from `coverage.exclude` now that it has real ARIA coverage; thresholds still pass.

## Verification

- `select.test.tsx`: 10/10 passing; adapter coverage 98.75% stmts / 88% branch / 100% funcs
- `assign-hcp-dialog.test.tsx` (19) + `user-personalization-dialog.test.tsx` (7): pass in isolation (repeated ×3) **and** in the full 2895-test suite — zero "Fluent option has not committed" errors after the `delay: null` fix
- `npx tsc -b`: clean
- `npm run build`: succeeds (pre-existing chunk-size warnings only)
- The 19 remaining full-suite failures (training, user-pages, dry-run-report, hcp-profile-editor, prompts) were verified **pre-existing on main** — identical failure list and count (19 failed | 54 passed) at pristine HEAD with all 40-06 changes stashed. Out of scope for this plan.

## Task Commits

- `543dfef` feat(40-06): migrate Select to Fluent UI and backfill ARIA test coverage
