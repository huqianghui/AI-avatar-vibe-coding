---
phase: 39-fluent-infrastructure-leaf-components
plan: 07
subsystem: ui
tags: [fluent-ui, avatar, children-composition-adapter, react-children-forEach, onError-fallback-shim, testing]

requires:
  - phase: 39-fluent-infrastructure-leaf-components
    provides: "39-01..39-06: established Fluent adapter patterns (variant/size mapping tables, event-signature shims, numeric/shape-contract shims, data-slot preservation, mergeClasses className-last ordering) that this plan's API-shape-translation adapter builds on"
provides:
  - "Avatar (frontend/src/components/ui/avatar.tsx) internally backed by Fluent's Avatar, while preserving the exported Avatar/AvatarImage/AvatarFallback children-composition public API every existing consumer already uses"
  - "AvatarImage/AvatarFallback re-implemented as inert marker components (render null) whose sole purpose is to be recognized by React.Children.forEach inside the parent Avatar and carry src/alt/fallback-content props across the API-shape boundary (children-composition -> Fluent's flat name/image/initials props)"
  - "Manually re-implemented broken-image-falls-back-to-initials behavior via a useState-backed onError handler wired into Fluent's image.onError prop, since Fluent does not auto-swap to fallback content the way Radix's AvatarPrimitive does"
  - "Completes all 12/12 leaf component migrations for Phase 39 (LEAF-01..LEAF-06)"
affects: []

tech-stack:
  added: []
  patterns:
    - "API-shape-translation adapter (distinct from prior plans' same-shape prop/event/scale shims): when the legacy public API's fundamental shape (children-composition) differs from Fluent's (flat props), parse children via React.Children.forEach inside the wrapper component to extract sub-component props by React.isValidElement + child.type identity check, then feed the extracted values into Fluent's flat prop interface. The original sub-component names are kept exported but become inert marker components (return null) recognized only by reference identity, not by rendering."
    - "Manual re-implementation of library-specific automatic behavior when porting to a library that doesn't replicate it: Radix's Avatar auto-swaps to fallback on image load failure; Fluent's does not do this from a caller-supplied image.src+onError alone in the way needed here, so the adapter tracks its own imageFailed boolean state and sets image to undefined once onError fires, guaranteeing the fallback path renders. Verified via a throwaway probe render (before/after fireEvent.error innerHTML diff) that this precisely matches Radix's prior observable behavior."

key-files:
  created:
    - frontend/src/components/ui/avatar.test.tsx
  modified:
    - frontend/src/components/ui/avatar.tsx

key-decisions:
  - "[Phase 39]: 39-07: AvatarImage/AvatarFallback are unconditionally inert marker components (return null in all cases), not conditionally-real components, because grepping every current consumer (grep -rn \"<AvatarImage\\|<AvatarFallback\" src) confirmed zero call sites render either standalone outside an <Avatar> wrapper -- always nested as direct children being parsed by the parent. This is the simpler of the two options the plan's interfaces block explicitly left open (\"OR real components if any existing consumer renders them standalone\")."
  - "[Phase 39]: 39-07: fallbackContent is split into initials (string children, passed to Fluent's initials prop) vs icon (non-string ReactNode children, passed to Fluent's icon prop) rather than always assuming string. All current consumers pass plain string initials (grepped and read all ~19 call sites), but this dual-path keeps the adapter correct for any future non-string AvatarFallback children without narrowing the accepted type."
  - "[Phase 39]: 39-07: name (fed to Fluent for aria-label/initials-auto-derivation) is sourced from AvatarImage's alt prop, not a separate name prop -- the legacy Radix API has no name prop at all, and alt is the closest existing signal of who/what the avatar represents. Confirmed acceptable because Fluent only uses name to auto-derive initials when initials is unset, and every current consumer already supplies explicit AvatarFallback initials, making name purely an aria-label enhancement with no behavioral risk."
  - "[Phase 39]: 39-07: delayMs (Radix's fallback-render-delay prop) is accepted on AvatarFallbackProps for call-site type-compatibility but is a no-op -- Fluent's fallback renders synchronously whenever there is no image, and grepping confirmed zero current consumers pass delayMs, so no behavioral gap is introduced."

patterns-established:
  - "API-shape-translation via React.Children.forEach + child.type identity: when a legacy component's public contract is fundamentally children-composition-shaped but the replacement library's contract is flat-props-shaped, translate at the outer wrapper's render body rather than trying to force the new library into a composition pattern it doesn't natively support. This is the highest-complexity adapter pattern in Phase 39 and should be the reference for any Phase 40 composite component that similarly changes shape (not just prop names/events) across the Radix->Fluent boundary."
  - "Probe-before-testing (continuing 39-05/39-06's methodology) applied to *behavioral* verification, not just DOM-shape verification: rendered the real adapter (not raw Fluent) with a before/after fireEvent.error innerHTML diff to empirically confirm the onError-driven fallback path removes the <img> and reveals initials, before writing the corresponding test assertion -- avoiding any assumption about Fluent's or the adapter's own re-render behavior."

requirements-completed: [LEAF-06]

duration: ~25min
completed: 2026-08-06
---

# Phase 39 Plan 07: Avatar to Fluent UI Migration Summary

**Avatar -- Phase 39's final and highest-complexity leaf component -- is now Fluent-backed via a `React.Children.forEach`-based API-shape-translation adapter that preserves the legacy children-composition contract (`<Avatar><AvatarImage/><AvatarFallback/></Avatar>`) on top of Fluent's flat-prop `Avatar`, with the broken-image-to-fallback behavior manually re-implemented and explicitly tested via `fireEvent.error` since jsdom does not natively fire `error` events on `<img>`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 1 (Task 1: Avatar migration)
- **Files modified:** 2 (1 rewritten in place, 1 new test file)

## Accomplishments

- `avatar.tsx` rewritten: `Avatar` is now a `React.forwardRef` wrapper around Fluent's `Avatar` that parses its `children` via `React.Children.forEach` (checking `React.isValidElement` + `child.type === AvatarImage` / `child.type === AvatarFallback` identity) to extract the image `src`/`alt` and the fallback's content, then feeds Fluent's flat `name`/`image`/`initials`/`icon` props. `AvatarImage`/`AvatarFallback` are now inert marker components (`return null`) -- confirmed safe via `grep -rn "<AvatarImage\|<AvatarFallback" frontend/src`, which showed every one of the ~19 current call sites nests them directly inside `<Avatar>`, never standalone.
- Broken-image fallback re-implemented manually: a `useState`-backed `imageFailed` flag flips to `true` when Fluent's `image.onError` fires, at which point `image` is fed as `undefined` on the next render, guaranteeing Fluent's own fallback (initials, since no consumer's fallback is a non-string icon today) renders instead of a broken `<img>`. This exact behavior was verified empirically via a throwaway probe render (before/after `fireEvent.error` innerHTML diff, deleted before the final commit) rather than assumed from documentation.
- `avatar.test.tsx` created (no prior test file existed) with 5 tests: image renders when an `AvatarImage` child with a `src` is present; initials-only render with no `img` element when there's no `AvatarImage` child; the **mandatory** Pitfall-21 `fireEvent.error()` broken-image test asserting the `img` is removed and initials text appears; `data-slot="avatar"` preserved on the root; consumer `className` appended via `mergeClasses`.
- `data-slot="avatar"` preserved on the Fluent `Avatar`'s root `<span role="img">`. Consumer `className` appended last via `mergeClasses(className)`.
- `tsc -b` required one fix beyond the plan's literal interfaces block: `AvatarProps extends React.ComponentPropsWithoutRef<"span">` conflicted with Fluent's own narrower `color` union (`"neutral" | "brand" | "colorful" | AvatarNamedColor`) vs the native `<span>`'s `color?: string` -- resolved by `Omit<..., "color">` on the public `AvatarProps` interface, matching the same `Omit<..., "color">` pattern already established in `button.tsx`/`badge.tsx` for the identical Fluent-color-vs-native-color-attribute collision.
- Full frontend test suite passes with zero regressions: 231 files / 2865 tests (230 -> 231 files, +5 tests, as `avatar.test.tsx` was added on top of 39-06's 230/2860 baseline). `npx tsc -b` clean. `npm run build` succeeds (pre-existing unrelated chunk-size warning only).

## Task Commits

1. **Task 1: Avatar migration -- children parsing + Fluent flat-prop adapter** - `afb32ef` (feat)

## Files Created/Modified

- `frontend/src/components/ui/avatar.tsx` -- Fluent-backed `Avatar`/`AvatarImage`/`AvatarFallback` adapter; `React.Children.forEach`-based children-to-flat-props translation; manual `useState` + `onError` broken-image fallback re-implementation; `data-slot="avatar"` preserved; `Omit<..., "color">` fix for the native-span-vs-Fluent-color-union collision.
- `frontend/src/components/ui/avatar.test.tsx` -- new file; 5 tests (image-present render, no-image initials-only render, mandatory `fireEvent.error` broken-image fallback per Pitfall 21, `data-slot` preservation, `className` passthrough).

## Decisions Made

- `AvatarImage`/`AvatarFallback` are unconditionally inert (never conditionally real components) -- confirmed via grep that zero current consumers render them standalone outside `<Avatar>`, so the simpler always-marker implementation was chosen over the plan's alternative fallback option.
- `fallbackContent` is typed to split into `initials` (string) vs `icon` (non-string `ReactNode`) rather than assuming all fallback content is a string -- all current consumers pass plain string initials, but this keeps the adapter correct for any future non-string `AvatarFallback` children.
- `name` (feeding Fluent's aria-label/initials-auto-derivation) is sourced from `AvatarImage`'s `alt` prop since the legacy API has no dedicated `name` prop -- purely an aria-label enhancement with no behavioral risk since every consumer already supplies explicit `AvatarFallback` initials.
- `delayMs` accepted on `AvatarFallbackProps` for type-compatibility but is a no-op (Fluent's fallback renders synchronously; zero current consumers pass `delayMs`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `tsc -b` type error from `color` prop collision**
- **Found during:** Task 1, immediately after writing the adapter and running `npx tsc -b`
- **Issue:** `AvatarProps extends React.ComponentPropsWithoutRef<"span">` (unmodified) conflicted with Fluent's `AvatarProps`'s narrower `color?: "neutral" | "brand" | "colorful" | AvatarNamedColor` when spread via `{...props}` onto `FluentAvatar` -- native `<span>`'s `color?: string` is incompatible with Fluent's union.
- **Fix:** Changed the public `AvatarProps` interface to `Omit<React.ComponentPropsWithoutRef<"span">, "color">`, matching the identical fix already established in `button.tsx` (`Omit<..., "color" | "size">`) and `badge.tsx` (`Omit<React.ComponentPropsWithoutRef<"span">, "color">`) for the same class of collision.
- **Files modified:** `frontend/src/components/ui/avatar.tsx`
- **Commit:** `afb32ef`

## Issues Encountered

None beyond the single auto-fixed type collision above -- resolved on the first `tsc -b` run, no further iteration needed.

## User Setup Required

None -- no external service configuration required.

## Known Stubs

None -- no hardcoded empty values, placeholder text, or unwired data sources introduced.

## Threat Flags

None -- no new network endpoints, auth paths, file access, or schema changes introduced. Matches the plan's own threat register (T-39-11 and T-39-12, both `mitigate`, satisfied via Test 2's no-`AvatarImage`-child case and the mandatory `fireEvent.error` broken-image test respectively).

## Verification

- `npx vitest run src/components/ui/avatar.test.tsx` -> **5/5 passed**, including the mandatory `fireEvent.error` broken-image fallback test
- `grep -n 'React.Children.forEach' frontend/src/components/ui/avatar.tsx` -> present (2 doc-comment mentions + 1 live call)
- `npx tsc -b` -> clean
- `npx vitest run` (full suite) -> **231 files / 2865 tests passed** (zero regressions; 230 -> 231 files as `avatar.test.tsx` was added)
- `npm run build` -> success (pre-existing chunk-size warning unrelated to this plan)
- `git log -1 --name-only` confirms exactly 2 files in the single commit `afb32ef`, commit message `feat(39-07): migrate Avatar to Fluent UI`
- Per the orchestrator's explicit anti-stall guardrail: the full Playwright E2E suite was intentionally **not** run/monitored for this plan (E2E baseline established in 39-01); no temporary probe/harness files remain (the throwaway `avatar.probe.test.tsx` used to empirically confirm rendered DOM shape and the `fireEvent.error` behavior was deleted before the final commit).

## Self-Check: PASSED

- `frontend/src/components/ui/avatar.tsx` -- FOUND (modified)
- `frontend/src/components/ui/avatar.test.tsx` -- FOUND (created)
- Commit `afb32ef` -- FOUND in `git log`

## Next Phase Readiness

All 12 leaf component migrations for Phase 39 (LEAF-01..LEAF-06, covering button/badge/input/label/checkbox/switch/separator/skeleton/progress/textarea/slider/avatar) are now complete. Phase 40 (composite components: dialog/sheet/select/dropdown-menu/tabs/tooltip/card/form) can now build on every adapter pattern established across Plans 02-07: variant/size mapping tables (Button/Badge), event-signature + vocabulary shims (Checkbox/Switch), numeric/shape-contract shims (Progress/Slider), and this plan's API-shape-translation via `React.Children.forEach` (Avatar) -- the last is the most directly relevant precedent for any Phase 40 composite component whose legacy Radix API is children-composition-shaped but whose Fluent replacement is flat-prop-shaped. Per the plan's own verification step 4, the full existing Playwright E2E suite should be run as the final Phase 39 regression gate (per D-05) confirming all 12 leaf components + infra together produce zero visual/functional regressions across the whole app -- this was intentionally deferred per this plan's explicit anti-stall guardrail (E2E baseline already established in 39-01) and should be executed at the phase-completion/orchestrator level rather than within this individual plan.

---
*Phase: 39-fluent-infrastructure-leaf-components*
*Completed: 2026-08-06*
