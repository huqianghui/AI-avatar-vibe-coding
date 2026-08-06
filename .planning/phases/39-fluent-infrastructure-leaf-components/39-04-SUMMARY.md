---
phase: 39-fluent-infrastructure-leaf-components
plan: 04
subsystem: ui
tags: [fluent-ui, input, label, textarea, react-hook-form, unstable-hooks, ref-forwarding, testing]

requires:
  - phase: 39-fluent-infrastructure-leaf-components
    provides: "39-03: Badge/Separator/Skeleton Fluent-backed adapter pattern (variant maps, isolated *.styles.ts overrides, ComponentPropsWithoutRef fix, manual data-* re-emission)"
provides:
  - "Input (frontend/src/components/ui/input.tsx) internally backed by Fluent's low-level useInput_unstable/useInputStyles_unstable/renderInput_unstable hooks, preserving exported name, props, and data-slot=\"input\", with ref forwarding verified to target the real native <input> element (Pitfall 20)"
  - "Label (frontend/src/components/ui/label.tsx) internally backed by Fluent's Label component (root slot IS the native <label>, no wrapper -- no Pitfall 20 concern), preserving exported name/props/data-slot=\"label\" and htmlFor association"
  - "Textarea (frontend/src/components/ui/textarea.tsx) internally backed by Fluent's low-level useTextarea_unstable/useTextareaStyles_unstable/renderTextarea_unstable hooks (mirrors Input's fix), preserving exported name, props, and data-slot=\"textarea\", with ref forwarding verified to target the real native <textarea> element"
  - "Discovered-and-fixed cross-component pattern: Fluent's high-level Input/Textarea components unconditionally re-assert their own internally-controlled value (defaulting to '') on every render, which silently breaks react-hook-form's classic uncontrolled register()-via-ref DOM mutation pattern used across the admin forms -- fixed by dropping to Fluent's own *_unstable hooks and erasing state.{input,textarea}.value when neither value nor defaultValue is supplied"
affects: [39-05, 39-06, 39-07]

tech-stack:
  added: []
  patterns:
    - "Low-level *_unstable hooks (useInput_unstable/useInputStyles_unstable/renderInput_unstable and the Textarea equivalents) used instead of the high-level <Input>/<Textarea> components, specifically to intercept and erase Fluent's internally-computed controlled value in the genuine-uncontrolled case -- these are the exact same hooks the public components are built from (verified via source read), not a private/unsupported API"
    - "data-slot set directly on the resolved slot state object (state.input['data-slot'] = ...) rather than passed through the props argument, since the *_unstable hooks' narrow TypeScript prop types reject arbitrary data-* keys on a plain object literal (unlike JSX's HTML-attribute passthrough)"
    - "value/defaultValue stringification (Omit<..., 'value'|'defaultValue'> & { value?: string|number }) reused verbatim from Input for Textarea, since native <textarea> also accepts numeric value/defaultValue that Fluent's narrower string-only TextareaProps would otherwise reject"

key-files:
  created:
    - frontend/src/components/ui/input.test.tsx
    - frontend/src/components/ui/label.test.tsx
    - frontend/src/components/ui/textarea.test.tsx
  modified:
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/label.tsx
    - frontend/src/components/ui/textarea.tsx

key-decisions:
  - "[Phase 39]: 39-04: Input and Textarea both bypass Fluent's high-level <Input>/<Textarea> components entirely and use the low-level useInput_unstable/useTextarea_unstable hooks directly, so the adapter can erase Fluent's internally-computed controlled value in the genuine-uncontrolled case (no value, no defaultValue passed) -- this was NOT anticipated by the plan's interface notes, which only flagged the ref-forwarding-target risk (Pitfall 20); the react-hook-form-vs-Fluent-controlled-value incompatibility was discovered by running the FULL test suite (not just the component's own tests) and finding 5 failing tests in rubric-editor.test.tsx"
  - "[Phase 39]: 39-04: Label required no ref-forwarding fix and no low-level-hooks workaround -- Fluent's Label root slot IS the native <label> element directly (confirmed via LabelSlots.root: Slot<'label'> in the shipped .d.ts), so the simple high-level <Label> component was sufficient"
  - "[Phase 39]: 39-04: avatar-page.tsx / avatar-input-bar.tsx were read and manually traced per the plan's explicit instruction but NOT modified -- avatar-input-bar.tsx's <Textarea ref={textareaRef} value={value} onChange={...}> is a controlled usage (value always a defined string from React state), so it never enters the uncontrolled-erasure branch, and the ref forwards straight to the native <textarea> via useTextarea_unstable's slot wiring (confirmed by the passing ref-target unit test)"

patterns-established:
  - "When a Fluent high-level component's internally-controlled value state conflicts with a consumer's uncontrolled ref-based value management (react-hook-form's register() pattern being the concrete case here), drop to the component's own low-level *_unstable hook trio (use*_unstable / use*Styles_unstable / render*_unstable) and patch the resolved state object before rendering, rather than fighting the high-level component's props API or requiring consumers to migrate off register()"

requirements-completed: [LEAF-03]

duration: ~55min
completed: 2026-08-06
---

# Phase 39 Plan 04: Input + Label + Textarea to Fluent UI Migration Summary

**Input and Textarea are now backed by Fluent's low-level `*_unstable` hooks (not the high-level components) specifically to preserve react-hook-form's uncontrolled `register()` pattern, which the high-level Fluent components silently break; Label uses the simple high-level component since its root slot is already the native `<label>` with no wrapper.**

## Performance

- **Duration:** ~55 min (includes a significant, unplanned root-cause investigation)
- **Tasks:** 3 (Task 1: Input; Task 2: Label; Task 3: Textarea)
- **Files modified:** 6 (3 rewritten in place, 3 new test files)

## Accomplishments

- `input.tsx` rewritten to use Fluent's `useInput_unstable`/`useInputStyles_unstable`/`renderInput_unstable` hooks directly (not the high-level `<Input>` component), preserving the exported name, native prop spread, `data-slot="input"`, and `value`/`defaultValue` numeric-to-string coercion for real `type="number"` call sites.
- `input.test.tsx` created with 8 tests: native attribute passthrough, the mandatory Pitfall-20 ref-target/`.focus()` test, `data-slot` presence, `className` passthrough, `disabled`, `onChange`, and two regression tests added after the discovery below (react-hook-form `register()`+`reset()` survives; plain `defaultValue`-only uncontrolled usage still works).
- `label.tsx` rewritten to wrap Fluent's `Label` directly (no low-level hooks needed -- Fluent's `LabelSlots.root` IS the native `<label>` element per the shipped `.d.ts`, so there is no Pitfall 20 concern for this component).
- `label.test.tsx` created with 3 tests: `htmlFor` association verified via `getByLabelText` resolving to the actual target input (not just the attribute being present), `data-slot="label"`, custom `className`.
- `textarea.tsx` rewritten with the identical low-level-hooks approach as `input.tsx` (`useTextarea_unstable`/`useTextareaStyles_unstable`/`renderTextarea_unstable`), including the same `value`/`defaultValue` string coercion and the same uncontrolled-value-erasure fix.
- `textarea.test.tsx` created with 8 tests mirroring `input.test.tsx`'s structure, including the mandatory Pitfall-20 ref-target test and the react-hook-form regression test.
- `avatar-page.tsx`'s `handleUseTextInstead` → `textareaRef.current?.focus()` call path (routed through `avatar-input-bar.tsx`'s `<Textarea ref={textareaRef} value={value} onChange={...}>`) was manually read and traced, not just grepped: this is a **controlled** usage (`value` is always a defined string from React state), so it never enters the uncontrolled-erasure branch, and the ref resolves to the native `<textarea>` per `useTextarea_unstable`'s slot wiring. **No modification to `avatar-page.tsx` or `avatar-input-bar.tsx` was needed or made.**
- Full frontend test suite passes with zero regressions at each of the 3 commit points (225→226→227→228 files as new test files were added; final: 228 files / 2843 tests). `npx tsc -b` clean after each task. `npm run build` succeeds.

## Task Commits

Each component was committed independently per D-07 (one-component-one-commit):

1. **Task 1: Input migration (low-level-hooks fix for react-hook-form compatibility)** - `cef51fa` (feat)
2. **Task 2: Label migration** - `42b3265` (feat)
3. **Task 3: Textarea migration (same fix + avatar-page.tsx trace)** - `8954964` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `frontend/src/components/ui/input.tsx` — Fluent-backed `Input` using `useInput_unstable`/`useInputStyles_unstable`/`renderInput_unstable`; erases `state.input.value` when neither `value` nor `defaultValue` is passed.
- `frontend/src/components/ui/input.test.tsx` — new file; 8 tests (6 original behavior tests + 2 regression tests for the react-hook-form fix).
- `frontend/src/components/ui/label.tsx` — Fluent-backed `Label`; simple high-level component wrap, no low-level hooks needed.
- `frontend/src/components/ui/label.test.tsx` — new file; 3 tests (`htmlFor` association via `getByLabelText`, `data-slot`, `className`).
- `frontend/src/components/ui/textarea.tsx` — Fluent-backed `Textarea` using `useTextarea_unstable`/`useTextareaStyles_unstable`/`renderTextarea_unstable`; identical fix pattern to Input.
- `frontend/src/components/ui/textarea.test.tsx` — new file; 8 tests mirroring `input.test.tsx`'s structure.

## Decisions Made

- Input and Textarea both required abandoning the high-level Fluent components for the low-level `*_unstable` hook trio, since the plan's own interface notes only anticipated the ref-forwarding-target risk (Pitfall 20) and did not anticipate the react-hook-form value-synchronization incompatibility, which was only surfaced by running the *full* test suite rather than just the target component's own tests.
- Label needed neither the ref-forwarding fix nor the low-level-hooks workaround, since Fluent's `Label` root slot is already the native `<label>` element with no wrapper.
- `avatar-page.tsx`/`avatar-input-bar.tsx` were deliberately left unmodified after manual tracing confirmed the controlled usage there is unaffected by the uncontrolled-erasure branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fluent's high-level Input/Textarea silently break react-hook-form's uncontrolled `register()` pattern**

- **Found during:** Task 1 (Input), after implementing the component per the plan's stated interface and running the *full* vitest suite (not just `input.test.tsx`) as a sanity check beyond the plan's hard verification gate
- **Issue:** Fluent's `Input`/`Textarea` (via their internal `useControllableState` call) unconditionally re-assert their own internally-controlled `value` (defaulting to `''`) onto the DOM on every render, even when the consumer supplies neither `value` nor `defaultValue`. React-hook-form's `register()` returns an uncontrolled, ref-bound field binding whose `reset()`/`setValue()` sync mechanism is a direct DOM mutation (`fieldRef.current.value = newValue`) that bypasses React state entirely. On Fluent's next render, its own `''`-seeded internal state silently overwrites that DOM mutation -- a real regression confirmed via 5 failing tests in `src/pages/admin/rubric-editor.test.tsx` (`<Input {...form.register("name")} />`, `<Textarea rows={2} {...form.register("description")} />`).
- **Root cause confirmed via source reads** (not speculation): `@fluentui/react-input/lib/components/Input/useInput.js`'s `state.input.value = value` (unconditional) and `node_modules/react-hook-form/dist/index.cjs.js`'s minified `a.ref.value=n` direct-DOM-mutation sync path. Confirmed empirically via isolated repro harnesses (bare `<FluentInput {...form.register(...)}/>` + `form.reset(...)`) before applying any fix, and re-confirmed the fix resolves it via the same harness pattern extended to cover controlled, `defaultValue`-only, and uncontrolled-ref cases together.
- **Fix:** Rewrote `input.tsx` and (proactively, before hitting the identical bug again) `textarea.tsx` to use Fluent's own low-level `use{Input,Textarea}_unstable`/`use{Input,Textarea}Styles_unstable`/`render{Input,Textarea}_unstable` hook trio -- the exact hooks the public high-level components are built from (verified via `.d.ts`/source) -- and explicitly erase `state.{input,textarea}.value` when neither `value` nor `defaultValue` is supplied, so the rendered native element gets no `value` prop at all and stays genuinely uncontrolled.
- **Files modified:** `frontend/src/components/ui/input.tsx`, `frontend/src/components/ui/textarea.tsx`
- **Commit:** `cef51fa` (Input), `8954964` (Textarea)
- **Verification:** `rubric-editor.test.tsx`'s previously-failing 5 tests all pass after the fix; new dedicated regression tests added to `input.test.tsx`/`textarea.test.tsx`; full suite (228 files / 2843 tests) passes with zero regressions at final commit.

**2. [Rule 3 - Blocking issue] `data-slot` cannot be passed through the `*_unstable` hooks' props argument**

- **Found during:** Task 1 (Input), running `npx tsc -b` after the low-level-hooks rewrite
- **Issue:** `useInput_unstable`'s `InputProps` type (and the `TextareaProps` equivalent) rejects arbitrary `data-*` keys on a plain object literal passed as the hook's `props` argument (unlike JSX, which special-cases HTML data attributes).
- **Fix:** Set `data-slot` directly on the resolved slot state object (`state.input["data-slot"] = "input"`) after calling the hook, before rendering.
- **Files modified:** `frontend/src/components/ui/input.tsx`, `frontend/src/components/ui/textarea.tsx`
- **Commit:** `cef51fa`, `8954964`

---

**Total deviations:** 2 auto-fixed (1 significant bug fix affecting real production admin forms, 1 minor type-compat fix)
**Impact on plan:** The Rule 1 fix was substantial in scope (required abandoning the plan's assumed high-level-component approach for both Input and Textarea) but stayed within Rule 1's bounds -- it fixes broken behavior discovered by the code's own changes, does not require any consumer-file changes, and does not touch database/API/architecture. No checkpoint was raised since the fix is fully contained within the two adapter files themselves.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes introduced. Matches the plan's own threat register (T-39-06 accept, T-39-07 mitigate via the ref-target unit tests, both satisfied).

## Verification

- `npx vitest run src/components/ui/input.test.tsx src/components/ui/label.test.tsx src/components/ui/textarea.test.tsx` → **19/19 passed** (8 + 3 + 8)
- `npx vitest run` (full suite, run after each task) → **228 files / 2843 tests passed** at final commit (zero regressions; includes `rubric-editor.test.tsx`'s 25 tests, previously 5-failing before the fix)
- `npx tsc -b` → clean
- `npm run build` → success (pre-existing chunk-size warning unrelated to this plan)
- `avatar-page.tsx`'s `textareaRef.current?.focus()` path manually traced (read, not grepped) against the new `Textarea` implementation and confirmed working unmodified — see Decisions Made above.
- Per orchestrator's explicit anti-stall guardrail: the full Playwright E2E suite was intentionally **not** run/monitored for this plan.

## Self-Check: PASSED

- `frontend/src/components/ui/input.tsx` — FOUND (modified)
- `frontend/src/components/ui/input.test.tsx` — FOUND
- `frontend/src/components/ui/label.tsx` — FOUND (modified)
- `frontend/src/components/ui/label.test.tsx` — FOUND
- `frontend/src/components/ui/textarea.tsx` — FOUND (modified)
- `frontend/src/components/ui/textarea.test.tsx` — FOUND
- Commit `cef51fa` — FOUND in `git log`
- Commit `42b3265` — FOUND in `git log`
- Commit `8954964` — FOUND in `git log`

## Next Phase Readiness

Wave 4 continues with the remaining leaf components (39-05 through 39-07). The low-level `*_unstable` hooks pattern established here should be checked against any other remaining leaf/composite component that (a) maintains an internally-controlled value and (b) has real react-hook-form `register()` call sites, before assuming the high-level Fluent component is sufficient.

---
*Phase: 39-fluent-infrastructure-leaf-components*
*Completed: 2026-08-06*

## Self-Check: PASSED

- `frontend/src/components/ui/input.tsx` — FOUND
- `frontend/src/components/ui/input.test.tsx` — FOUND
- `frontend/src/components/ui/label.tsx` — FOUND
- `frontend/src/components/ui/label.test.tsx` — FOUND
- `frontend/src/components/ui/textarea.tsx` — FOUND
- `frontend/src/components/ui/textarea.test.tsx` — FOUND
- Commit `cef51fa` — FOUND in `git log`
- Commit `42b3265` — FOUND in `git log`
- Commit `8954964` — FOUND in `git log`
