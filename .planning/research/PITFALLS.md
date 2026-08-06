# Pitfalls Research

**Domain:** Adapter-mode migration of an existing shadcn/Radix+Tailwind React 18 app to `@fluentui/react-components` v9 (icons + toast swapped, scroll-area kept on Radix)
**Researched:** 2026-08-06
**Confidence:** HIGH for mechanics verified against `.d.ts`/source in STACK.md/ARCHITECTURE.md/FEATURES.md (Griffel injection order, Checkbox/Switch/ProgressBar API shapes, Drawer `position` support); MEDIUM for behavioral claims not yet empirically confirmed in this repo's runtime (StrictMode double-render effect on Griffel, `toastId` survives into `dispatchToast`, Fluent icon default `fontSize` value) — each flagged below with its required spike.

> This supersedes the 2026-07-31 v2.0 PITFALLS.md (which covered the Avatar-MVP/CRM/i18n milestone — anonymous-mode routing assumptions, feature-flag gating, WS auth). This file is scoped only to the v3.0 Fluent UI v9 migration. It does not repeat STACK/ARCHITECTURE/FEATURES content — it extends those findings with failure-mode analysis and prevention, keyed to Phase 39 (A infra + B leaf) / Phase 40 (C composite) / Phase 41 (D icons + E toast) / Phase 42 (F cleanup).

## Critical Pitfalls

### Pitfall 1: Griffel/Tailwind style-order inversion (color flash, "my override was silently discarded")

**What goes wrong:**
A component renders with the wrong color/border/background — most visibly as a flash of the *wrong* theme color on first paint, or a Tailwind override class (`className="bg-red-500"` passed onto a Fluent-backed `Button`) that compiles fine, appears in the DOM, but has zero visual effect because Griffel's rule for the same CSS property still wins the cascade. Symptoms show up intermittently across dev vs. prod, or dev-reload vs. cold-start, because they depend on *DOM insertion order*, not on code.

**Why it happens:**
Griffel and Tailwind both emit atomic, single-class, equal-specificity (0,1,0) selectors — per STACK.md's verified source read, this is by design on both sides, so there is no specificity war to reason about. The only variable left is `<head>` source order: whichever stylesheet's rule for a given property comes *later* in `<head>` wins the tie. Without an explicit `insertionPoint` passed to `createDOMRenderer`, Griffel's default behavior is to append its bucket `<style>` tags to the end of `<head>` **at first-render time** — i.e., order becomes a function of component mount timing, which differs between dev (Vite HMR, StrictMode double-invoke) and prod (single bundle, different mount order), and even between reloads if lazy-loaded routes mount Fluent components in a different order. This is exactly the "build 后核查产物顺序" risk item the migration plan already flags, but it is easy to under-scope as "check once" when it is actually "must be structurally guaranteed, not manually verified once."

**How to avoid:**
- Implement the `#griffel-insertion-point` anchor `<style>` element as the **last static element in `<head>`, before the module script** (per ARCHITECTURE.md §3) — not "somewhere in head," the exact position matters because Vite injects Tailwind's stylesheet via the module script import, which resolves after whatever is already parsed in `<head>`.
- Pass that anchor into `createDOMRenderer(document, { insertionPoint })` and wrap the *entire* Fluent-consuming subtree in `<RendererProvider renderer={renderer}>` created **once at module scope** (not inside a component body — a new renderer per render defeats the whole point and also fights StrictMode, see Pitfall 1b below).
- Treat "inspect `dist/index.html` after `npm run build`" as a **repeatable CI-style check**, not a one-time manual sanity pass — add it as a build-verification step (e.g. a small script asserting `griffel-insertion-point` appears before the Tailwind `<link rel="stylesheet">` in the built HTML) so a future Vite/plugin upgrade can't silently reorder things without failing something.
- Never let a component-level `style` tag or a third global reset (STACK.md's explicit "What NOT to Use" row) get introduced later — that reintroduces a second, uncontrolled insertion point.

**Warning signs:**
- Any bug report describing "color flickers on load" or "the Tailwind class I added does nothing on this button but works on that div."
- Visual diffs between local dev and the deployed build for the same component.
- A component's Griffel styles working correctly in isolation (Storybook-style single-mount test) but breaking once placed deeper in a route that lazy-loads.

**Phase to address:**
Phase 39 (Plan A). This is infrastructure — must be locked down before Phase 39/B's first leaf component (button) lands, since every subsequent phase (40, 41) builds on this contract holding. Add the build-verification check as part of Phase 39's own exit criteria, not deferred to Phase 42.

---

### Pitfall 1b: React 18 StrictMode double-render creates two Griffel renderer instances (or double-injects buckets)

**What goes wrong:**
In dev (StrictMode double-invokes render), a `createDOMRenderer()` call placed inside component render (instead of module scope) executes twice, potentially creating two renderer objects with two different (or duplicated) sets of injected `<style data-griffel-...>` tags — leading to either duplicate bucket tags (harmless but wasteful) or, worse, two renderers disagreeing about the DOM position of the *same* logical bucket, reintroducing Pitfall 1's non-determinism specifically in dev mode.

**Why it happens:**
StrictMode intentionally double-invokes component bodies (and effects, in React 18's dev-only double-effect behavior) to surface impure code. Any `createDOMRenderer(...)`/`RendererProvider` construction that isn't hoisted to module scope is impure in exactly this way.

**How to avoid:**
Construct `renderer` once, at module top-level in `App.tsx` or `main.tsx` (as ARCHITECTURE.md's §3 code sample already does: `const renderer = createDOMRenderer(...)` outside any component function). Never call `createDOMRenderer` inside `FluentThemeBridge` or any other component body. This is a one-line discipline check during code review, not a runtime workaround.

**Warning signs:**
Duplicate `<style data-griffel-...>` tags with identical bucket IDs visible in dev DOM inspector; visual bugs that only reproduce in `npm run dev` (StrictMode-wrapped) but not `npm run build && npm run preview`.

**Phase to address:**
Phase 39 (Plan A) — code-review checklist item for the `App.tsx`/`main.tsx` diff. Trivial to prevent, easy to introduce accidentally if a future refactor moves the renderer construction inside a component "for convenience."

---

### Pitfall 2: Fluent icon hardcoded `fontSize` silently defeats Tailwind `size-*` + `currentColor`

**What goes wrong:**
After swapping a lucide import for its Fluent adapter equivalent, icons render at the wrong (usually larger, fixed) size regardless of `className="size-4"` etc. passed at the call site — because individually-imported Fluent icons (`Add24Regular` etc.) are, per FEATURES.md's verified finding, "resizable" variants that render with an inline `font-size` default tied to their name's pixel suffix. This is not a compile error and not caught by TypeScript — it is a silent visual regression that shows up as "icons look too big/small" across potentially all 84 icons at once if the adapter's stripping logic is wrong, or icon-by-icon if some Fluent icons behave differently from others.

**Why it happens:**
Fluent icons ship two families: fixed-size (e.g. always `24px`) and "resizable" (relative to `1em`/font-size). Individually-named imports like `Add24Regular` fall into a sizing model that keys off an inline default the adapter must explicitly override — the exact default value is not fully pinned down by the `.d.ts` (FEATURES.md/ARCHITECTURE.md both flag this as MEDIUM confidence, "prop existence confirmed, exact default value not confirmed against live runtime"). If the `_adapter.tsx` wrapper's `fontSize={undefined}` doesn't actually strip Fluent's own default the way expected (e.g. if the icon component ignores `undefined` and falls back to its baked-in default instead of `unset`), the size trap ships silently to all 84 icons because it's inherited from one shared `makeIconAdapter()` implementation.

**How to avoid:**
- **Do the spike before batch rollout, not after** (already flagged in the plan, but worth restating as a hard gate): render 3–5 representative icons at multiple Tailwind `size-*` values (`size-3`, `size-4`, `size-6`, `size-8`) side-by-side with their lucide originals in a throwaway test page, and visually diff pixel dimensions — not just "does it look roughly right."
- Confirm `currentColor` inheritance separately from sizing — Fluent icons default to inheriting `fill`/`color` similarly to lucide's `stroke="currentColor"` model, but verify explicitly since a `primaryFill` prop exists that could be set to a hardcoded color by mistake in a hand-written mapping row.
- Once the adapter pattern is confirmed correct for the spike icons, apply the *same* `makeIconAdapter()` wrapper to all 84 — do not special-case individual icons' sizing logic; if one icon needs special handling, that is itself a signal the base adapter assumption is wrong and needs re-verification, not a one-off patch.
- Batch rollout by directory (admin → shared → voice → pages, per the plan) means a sizing bug caught late in `pages/*` could mean dozens of already-merged commits in `admin/*`/`shared/*` need a follow-up fix — cheaper to catch in the spike than across multiple merged batches.

**Warning signs:**
Any PR screenshot/visual review showing icons at inconsistent sizes relative to surrounding Tailwind-sized elements (buttons, badges); an icon rendering noticeably larger than its sibling text after a batch import-swap commit.

**Phase to address:**
Phase 41 (Plan D) — but the spike must complete and pass *before* any of the 4 directory batches begin, i.e. it's a Phase 41 entry gate, not just an early task within it.

---

### Pitfall 3: FluentProvider paints over `<body>`'s Tailwind-owned background (or leaks incorrect box model into layout)

**What goes wrong:**
`FluentProvider`, dropped in with no style overrides, renders a DOM node and paints `colorNeutralBackground1`/`colorNeutralForeground1` from the active theme onto its own root — this can visually clash with `<body>`'s existing `bg-background text-foreground` Tailwind classes (double-painted background, especially visible during the dual-stack coexistence period when only some routes/components are Fluent-backed and others aren't yet). A secondary, easier-to-miss variant: if `FluentProvider` introduces an unexpected `<div>` box into the render tree (rather than being layout-neutral), it can break flex/grid layouts that assumed a specific parent-child DOM structure (e.g. `avatar-page.tsx`'s `grid grid-cols-1 md:grid-cols-[1fr_300px]` layout assumes direct children, and this repo has such CSS-grid-with-explicit-column layouts).

**Why it happens:**
This is Fluent's default, intentional behavior for apps that let Fluent own the whole page — it is *not* a bug, but it is the wrong default for an app doing adapter-mode migration where Tailwind/`<body>` remains the background authority throughout and after the migration.

**How to avoid:**
Exactly as ARCHITECTURE.md §1 specifies: `<FluentProvider theme={theme} className="contents" style={{ background: "transparent", color: "inherit" }}>` — `className="contents"` (Tailwind's `display: contents`) removes the box from the layout tree entirely so it cannot interfere with any parent's flex/grid children count or CSS selector assumptions (`:nth-child`, direct-child grid placement, etc.), and the transparent/inherit style pair prevents the background/foreground token paint. Verify this specifically against `avatar-page.tsx`'s CSS-grid layout (`grid-cols-1 md:grid-cols-[1fr_300px]`) since it's the most layout-sensitive page — confirm the grid's direct children count and order are unchanged after `FluentThemeBridge`/`FluentProvider` wraps them.

**Warning signs:**
Any visual regression where a page's grid/flex layout subtly shifts (columns collapse, spacing changes) immediately after the Phase 39 provider wiring commit, even though no visible Fluent component exists yet on that page.

**Phase to address:**
Phase 39 (Plan A) — verify against `avatar-page.tsx` specifically as part of the "run full existing E2E suite as regression net" step already planned for Phase A, since this page has the most complex grid layout in the app.

---

### Pitfall 4: Toast bridge loses `loading()` → `dismiss(id)` lifecycle or silently becomes a no-op under `vi.mock`

**What goes wrong:**
Two distinct failure modes, both centered on `avatar-page.tsx:224-243`'s `toast.loading(...)` → later `toast.dismiss(toastId)` pattern:
1. **Runtime failure:** the bridge's `dismiss(id)` doesn't actually dismiss the specific loading toast (e.g. because Fluent's `dispatchToast`'s `toastId` doesn't survive into the dispatch call the way the type algebra suggests) — the "switching persona…" loading toast never disappears, or `dismissAllToasts()` gets called and clears *every* toast in flight, including unrelated ones, when only the persona-switch loading toast should have been dismissed.
2. **Test-suite failure:** existing tests use `vi.mock("sonner")` to intercept `toast.success/error/loading/dismiss` calls and assert on them. Once the import path changes to `@/lib/toast`, any test file where the `vi.mock` target wasn't updated **does not fail loudly** — Vitest's `vi.mock` silently has no effect if the mocked module path no longer matches any import in the file under test, so the *real* toast-bridge code path runs instead of the mock, and assertions like `expect(toast.error).toHaveBeenCalledWith(...)` either fail with a confusing "not a mock function" error, or in the worst case still pass by accident (e.g. if the real implementation happens to satisfy a loose assertion), masking that the mock isn't actually intercepting anything.

**Why it happens:**
(1) is a genuine, not-yet-empirically-verified API behavior — ARCHITECTURE.md flags this explicitly as "MEDIUM confidence pending one live runtime check." (2) happens because `vi.mock(path)` is matched by import specifier string, not by semantic intent — a global find/replace of `"sonner"` → `"@/lib/toast"` across `import` statements but not across `vi.mock(...)` calls (or vice versa) produces a test file that *looks* migrated (compiles, has assertions) but is silently testing the wrong code path.

**How to avoid:**
- For (1): do the empirical confirmation *before* wiring 46 call sites — write the throwaway `dispatchToast(<x/>, {toastId: "abc"})` → `dismissToast("abc")` test that ARCHITECTURE.md §6 already specifies, and treat it as a hard go/no-go gate for the bridge design, not a nice-to-have. If `toastId` does NOT survive, the bridge needs a fallback design (e.g. bridge-side mapping from its own generated id to whatever identifier Fluent's Toaster actually returns/accepts) *before* any of the 46 files are touched.
- For (2): when migrating each test file's `vi.mock("sonner")` → `vi.mock("@/lib/toast")`, run that specific test file with `--reporter=verbose` (or equivalent) and manually confirm the mock's call-count assertions actually reflect mock invocations, not real bridge invocations — the plan's own "file-by-file, no blanket sed" rule is exactly the right instinct; extend it to explicitly include a per-file "did the mock actually intercept" sanity check, not just "does `import` compile."
- Add one integration-level test asserting the full `loading()` → `dismiss(id)` round-trip works against the *real* (non-mocked) toast bridge + a real mounted `<Toaster>`, complementing (but not replacing) the per-file unit mocks — this catches exactly the avatar-page.tsx lifecycle without needing every one of the 46 files to independently re-verify the same lifecycle contract.
- Preserve `aria-live`/`role="status"` semantics on the rendered toast region for Playwright E2E (Fluent's `Toast` region should already carry appropriate live-region roles by default per its WAI-ARIA-authored design — verify this explicitly with a Playwright accessibility snapshot rather than assuming it, since E2E specs may query by role/text for toast content).

**Warning signs:**
A persona-switch "switching…" toast that never disappears in manual QA; a test suite that reports 100% pass but a manual click-through reveals toast content doesn't match what tests assert; any test file with `vi.mock("@/lib/toast")` that also still imports something from `"sonner"` (a sure sign of an incomplete migration in that file).

**Phase to address:**
Phase 41 (Plan E). The `toastId` runtime check is an entry gate for Plan E (must pass before batch call-site migration begins); the per-file `vi.mock` sanity check is a per-commit discipline item across all 46 files.

---

### Pitfall 5: `onCheckedChange`/`onChange` signature mismatch silently drops state updates

**What goes wrong:**
A Checkbox or Switch adapter that maps Fluent's `onChange(ev, data)` to the old `onCheckedChange(checked)` contract gets the boolean extraction subtly wrong — most commonly, forgetting that Fluent's tri-state value is the *string* `"mixed"` (not `"indeterminate"`) — and either (a) the consumer's indeterminate-handling branch never fires because it's checking for a value that never occurs, or (b) TypeScript doesn't catch it at all if the consumer's `onCheckedChange` type signature was loosely typed as `(checked: boolean) => void` and the adapter coerces `"mixed"` to `true`/`false` incorrectly (e.g. treating mixed as `false`), producing a working-looking but semantically wrong checkbox that never visually indicates its indeterminate state to the user even though the underlying data model still has three real states.

**Why it happens:**
This is an easy, no-compile-error mistake because both signatures involve booleans that "look" convertible — the mismatch is in a string literal (`"indeterminate"` vs `"mixed"`) buried inside a rarely-exercised code path (tri-state checkboxes are used far less often than plain checked/unchecked), so it can ship, pass all binary-state tests, and only surface once a real tri-state consumer is exercised in manual QA or production.

**How to avoid:**
- Write the adapter's translation explicitly and defensively: `onChange={(ev, data) => onCheckedChange?.(data.checked === "mixed" ? "indeterminate" : data.checked)}` (exact shape FEATURES.md's row #5 already specifies) — and add a **dedicated unit test exercising the tri-state/indeterminate path**, not just checked/unchecked, since that's precisely the path most likely to be skipped by "renders without crashing" / "checked when checked=true" style tests already present in `checkbox.test.tsx`.
- Do the same audit for Switch — even though Switch has no tri-state concept in either library, verify the adapter isn't accidentally importing/reusing the Checkbox translation function for Switch (a plausible copy-paste risk given both need "translate Fluent onChange to legacy onCheckedChange").
- Grep the codebase for any consumer passing `"indeterminate"` literal string to a `Checkbox`'s `checked` prop or reading it back from `onCheckedChange` — confirm each such call site is covered by the new adapter test, not just the adapter's own isolated unit test.

**Warning signs:**
Any checkbox meant to show a "some but not all selected" state visually rendering as fully checked or fully unchecked instead; a unit test suite passing 100% while a manual QA pass on a bulk-select UI (if one exists) shows the indeterminate visual never appears.

**Phase to address:**
Phase 39 (Plan B) — the Checkbox/Switch leaf components are early in Plan B specifically to establish this event-signature-shim pattern correctly before Phase 40's composite components (which may compose Checkbox internally, e.g. inside a Select-multi or Form) inherit the same pattern.

---

### Pitfall 6: `data-state` test assertions break silently across the suite, not just at the 2 known lines

**What goes wrong:**
The migration plan and FEATURES.md both correctly identify `checkbox.test.tsx:20,26` as *known* `data-state` assertions. The real risk is that this is described as "confirmed" for one file, but Radix's `data-state` attribute convention (`open`/`closed`, `checked`/`unchecked`, `active`/`inactive`, `delayed-open`/`instant-open`) is used pervasively across Radix primitives, and FEATURES.md's own C1–C6 rows flag that Dialog, Sheet, DropdownMenu, Tabs, and Tooltip **all** emit `data-state` today with **no dedicated test file currently asserting on it** for most of them (unlike Checkbox, which happens to have 2 explicit assertions). This means the actual blast radius of "components that stop emitting `data-state` on migration" is not fully enumerable by grepping existing test files alone — a component might be asserted on informally via snapshot tests, or a component's `data-state` might be read by *other* production code (e.g. a CSS selector, or a JS query) rather than a test, and that would only surface as a runtime/visual bug, not a test failure.

**Why it happens:**
Radix's `data-state` convention is deeply idiomatic to Radix and invisible unless someone explicitly greps for it — it is easy to treat "fix the 2 known lines in checkbox.test.tsx" as the entire scope of this risk when it is actually a pattern that recurs per-component, with different attribute values, across every migrated composite.

**How to avoid:**
- Before migrating each composite in Phase 40 (C1–C8), run a project-wide grep for `data-state` scoped to that component's test file *and* any snapshot files *and* any `.tsx` production code (not just `.test.tsx`) referencing that component — e.g. `grep -rn 'data-state' frontend/src --include='*.tsx'` filtered to the component under migration, before starting that component's work, not after.
- For components with confirmed test assertions (Checkbox today; potentially others once grepped), decide per-component whether to (a) rewrite the assertion to the Fluent ARIA equivalent (`aria-checked`, `aria-expanded`, `aria-selected`) or (b) have the adapter itself re-emit a `data-state` attribute for backward compatibility (FEATURES.md's own recommendation for Checkbox) — make this decision explicit and documented per-component, not implicitly inconsistent across the 9 composites.
- Treat "zero remaining `data-state` references outside intentionally-preserved adapter shims" as a Phase 42 (F) go/no-go grep check, parallel to the already-planned `@radix-ui|lucide-react|sonner|vaul` grep — add `data-state` (scoped to non-adapter files) to that same final audit.

**Warning signs:**
A component's Playwright E2E spec passing (because it queries by ARIA role/name, unaffected) while its unit test suite for the same component silently regresses to a different failure — or worse, doesn't regress at all because no test happened to assert on `data-state` for that particular component, meaning a real behavioral change ships with zero red tests anywhere.

**Phase to address:**
Phase 40 (Plan C) per-component, as a pre-migration grep step; Phase 42 (Plan F) as the final sweep/gate.

---

### Pitfall 7: Coexistence-period discipline breaks down — partial-migration visual regressions, or Phase F run too early

**What goes wrong:**
Two related failure modes:
1. **Mid-migration visual drift:** during Phases 39–41, both Radix+lucide+sonner and Fluent+Griffel are intentionally mounted simultaneously (per ARCHITECTURE.md §7's explicit "cross-phase coexistence rule"). If a component is migrated in isolation without verifying it against pages that mix migrated and not-yet-migrated siblings (e.g. a migrated `Button` next to a not-yet-migrated `Tooltip` wrapping it, per FEATURES.md's C6 dependency note about nested `cloneElement` shims), the composition can silently break — double-cloning, dropped ref forwarding, or a Tooltip's trigger no longer receiving the props it expects from a differently-shimmed Button.
2. **Irreversible-cleanup-too-early:** Phase 42 (F)'s dependency uninstall (`@radix-ui/*`, `lucide-react`, `sonner`, `vaul`) is explicitly irreversible once merged — package-lock changes, and any component someone forgot to migrate (or a newly-added feature branch that still imports `lucide-react` directly, merged in parallel during the migration window) breaks immediately and permanently once those packages are gone, with no simple `git revert` path back to a working state without re-adding dependencies and re-diagnosing which call sites need them.

**Why it happens:**
(1) happens because "one component = one commit" (correctly enforced for rollback safety) can create a false sense that each commit is *fully* independently verified, when in practice composability risk (Tooltip-wraps-Button, Form-wraps-Label, Card-contains-Badge) means a component's migration isn't safe in isolation — it's safe *given* its dependencies (per FEATURES.md's Feature Dependencies graph) are already migrated and re-verified in combination.
(2) happens because Phase F's grep-based "zero hits" check (already planned) only catches *known* import paths at the moment the grep runs — it can't catch a PR merged the same week that reintroduces a `lucide-react` import, especially in a fast-moving codebase where this migration runs alongside other feature work (per this project's CLAUDE.md "逐个实现" rule, which governs THIS migration's own sequencing but doesn't prevent unrelated concurrent PRs from landing).

**How to avoid:**
- For (1): FEATURES.md's own Feature Dependencies section already identifies the composability risk pairs (C6 Tooltip + Button/MenuTrigger; C8b Form + Label) — treat these as **explicit cross-component verification tasks**, not implicit side effects of "the components happen to be migrated in the right order." Add a Playwright check specifically exercising Tooltip-wrapping-icon-Button-inside-MenuTrigger (the "recurring admin-UI pattern" FEATURES.md flags) once all three pieces are migrated, not just each piece's own isolated test.
- For (2): before running Phase F's uninstall, do the grep check **twice** — once at planning time and once immediately before the uninstall commit (as close to atomic as possible) — and treat any gap between those two checks (e.g. other PRs merged in between) as a reason to re-run the grep, not skip re-running it because "we already checked." Communicate the go/no-go checkpoint explicitly to whoever else has merge rights during the migration window, since Phase F is the one phase where "just revert the commit" is not a safety net.
- Maintain the "one component = one commit, `git revert`-able" discipline through Phase 41 inclusive — Phase F is correctly the *only* phase where this safety net is intentionally given up, and that tradeoff should be a conscious, documented decision at the moment F starts, not a default.

**Warning signs:**
Any composite component's Playwright spec passing in isolation but a full-page E2E spec (exercising the same component nested inside another migrated component) failing; any `package.json`/lockfile diff between Phase F's planning grep and its actual uninstall commit showing new dependency-graph entries.

**Phase to address:**
Phase 40 (Plan C) for composability verification between dependent components; Phase 42 (Plan F) for the double-grep discipline immediately bracketing the irreversible uninstall.

---

## Moderate Pitfalls

### Pitfall 8: Filled vs. Regular icon naming mismatch produces visually "off" icons with no compile error

**What goes wrong:** Lucide has one visual style per icon name; Fluent ships `Regular`/`Filled` pairs per icon (e.g. `Heart24Regular` vs `Heart24Filled`), and sometimes additional size variants that don't map 1:1 to lucide's single-size SVG. Picking the wrong variant (e.g. `Filled` where the original lucide icon was an outline stroke) compiles and renders something icon-shaped, so it's easy to merge without noticing a stylistic mismatch until a design review.
**Prevention:** The plan's own "不用脚本瞎猜" (no script-guessing) decision is the right instinct — extend it explicitly to *variant selection*, not just icon existence: for each of the 84 mapping rows, record which Fluent variant (Regular/Filled) was chosen and why (default to Regular, matching lucide's outline-style default, unless a specific icon is used in a "filled/active state" context in the current UI). Do a visual side-by-side review pass (not just a name-matching pass) before batch rollout.
**Phase to address:** Phase 41 (Plan D), during the manual mapping-table construction, before any directory batch starts.

### Pitfall 9: Bundle bloat from accidental wildcard/namespace icon imports

**What goes wrong:** A single `import * as Icons from "@fluentui/react-icons"` (or a barrel re-export written as `export * from "@fluentui/react-icons"` inside the new `components/icons/index.ts`) defeats tree-shaking for the entire ~300MB-unpacked icon package (per STACK.md's bundlephobia data point: ~15.5MB raw / ~3.09MB gzip for a naive full import) — this is a single-line mistake with an outsized bundle-size consequence, and it can hide inside the *adapter's own* `index.ts` (not just consumer files) since that's the one file allowed to import from `@fluentui/react-icons` directly.
**Prevention:** Named imports only, enforced by code review specifically on `components/icons/index.ts` and `_adapter.tsx` (the two files where a wildcard import would actually matter) — since it's only 2 files, this is cheap to review by hand every time either changes. Confirm via the plan's own "build 后对比 bundle size" step actually catches a regression (i.e., run it once with a deliberately-introduced wildcard import to confirm the diff tool would flag it, not just once in the passing case).
**Phase to address:** Phase 41 (Plan D).

### Pitfall 10: Missing 1:1 lucide-to-Fluent icon equivalents force a judgment call that gets deferred and forgotten

**What goes wrong:** Some of the 84 lucide icons in use have no obviously-named Fluent counterpart (different icon sets curate different symbol libraries) — if this is discovered mid-batch rather than during the upfront mapping-table pass, it creates pressure to pick a "close enough" substitute quickly, which can ship a semantically wrong icon (e.g. a generic "info" icon standing in for a domain-specific icon lucide had a dedicated symbol for).
**Prevention:** Complete the full 84-row mapping table (including explicit "no exact match, using X as closest substitute, flagged for design review" rows) as a single upfront artifact before any batch commit starts — not incrementally discovered/patched batch-by-batch. This is exactly what the plan's "供人工确认，不用脚本瞎猜" step already intends; the pitfall is skipping straight to batch commits without that table being complete and reviewed first.
**Phase to address:** Phase 41 (Plan D), as a blocking prerequisite for the first directory batch.

### Pitfall 11: Nested/duplicate providers or missed theme-prop wiring cause "theme doesn't update on accent/dark switch"

**What goes wrong:** If a second `FluentProvider` is accidentally introduced somewhere deeper in the tree (e.g. inside a modal/portal-mounted component, since Dialog/Drawer/Menu popovers can render into different DOM subtrees), it can create its own default (un-themed) context, causing Fluent components inside that boundary to ignore the app's active accent/dark-mode selection — visually, dialogs/menus render with Microsoft's default blue brand instead of the app's selected accent, only inside overlays.
**Prevention:** `FluentProvider`'s own props include `applyStylesToPortals` (mentioned in ARCHITECTURE.md's verified prop list) specifically for this class of problem — confirm portal-rendered content (Dialog, Drawer, Menu popovers) correctly inherits the outer theme rather than needing a second explicit provider, and add this as an explicit checklist item on the first portal-based composite (C1 Dialog) since every subsequent overlay composite (Sheet, Select, DropdownMenu, Tooltip) inherits whatever pattern C1 establishes.
**Phase to address:** Phase 40 (Plan C), specifically C1 (Dialog), since it's the first portal component and establishes the pattern others copy.

### Pitfall 12: Focus-visible / keyboard navigation regressions from portal/DOM-structure changes

**What goes wrong:** Radix and Fluent both implement focus-trap and roving-tabindex patterns for modals/menus, but their exact DOM structures differ (per FEATURES.md's C1/C4 notes on different nesting: Fluent's `MenuPopover > MenuList` vs Radix's flatter structure) — a keyboard-only user tabbing through a migrated Dialog or DropdownMenu could hit a focus trap that doesn't return focus to the trigger on close, or a roving-tabindex menu where arrow-key navigation skips an item, especially during the mixed period where a migrated Dialog might contain a not-yet-migrated Radix-based inner component.
**Prevention:** Add explicit keyboard-navigation Playwright assertions (Tab/Shift+Tab/Escape/Arrow-key sequences, not just click-based interaction) for each C1–C6 composite as part of that component's own commit, not deferred to a general "a11y audit" at Phase 42 — by then, regressions are hard to bisect across 8+ merged composite commits. Phase 42's Lighthouse/a11y audit should be a confirmation of an already-established baseline per component, not the first time keyboard nav is checked.
**Phase to address:** Phase 40 (Plan C), per-component; Phase 42 (Plan F) as the final aggregate confirmation only.

### Pitfall 13: `ProgressBar` 0–1 vs. Radix `Progress` 0–100 scale — silently renders an almost-empty bar

**What goes wrong:** Every existing call site passing `value={percentage}` (e.g. `value={67}` for 67%) renders a bar that's visually ~0.67% full instead of 67% full, because Fluent's `ProgressBar.value` is a 0–1 decimal (default `max=1`), not Radix's 0–100 convention — this is silent (no type error, since both are just `number`) and could ship unnoticed if no test asserts on the rendered width/percentage numerically.
**Prevention:** The adapter must divide the incoming legacy `value` prop by 100 before forwarding to Fluent's `ProgressBar` (already specified in FEATURES.md row #9) — write a unit test asserting the adapter's `aria-valuenow` (or equivalent internal state) reflects the correct 0–1-scaled value for a representative input like `value={67}`, not just "renders without crashing." Also explicitly test the indeterminate case (`value={undefined}`) since the two libraries' indeterminate mechanisms differ (custom transform math vs. native animation).
**Phase to address:** Phase 39 (Plan B).

### Pitfall 14: `OverlayDrawer`'s controlled-only behavior silently breaks any `defaultOpen`-reliant Sheet usage

**What goes wrong:** FEATURES.md's C2 row flags that Fluent's `OverlayDrawer` deprecates `defaultOpen` with no effect — any Sheet call site that relied on uncontrolled `defaultOpen={true}` (open-on-mount without external state) will render permanently closed after migration, with no error, since `defaultOpen` is just silently ignored rather than throwing.
**Prevention:** Grep for `defaultOpen` on every `<Sheet>`/`<SheetContent>` usage *before* starting C2, and migrate any such call site to explicit `open`/`onOpenChange` state as a precondition of the C2 commit, not a follow-up fix after the regression is noticed.
**Phase to address:** Phase 40 (Plan C), C2 (Sheet), as a pre-migration grep gate exactly analogous to Pitfall 6's `data-state` grep gate.

### Pitfall 15: Tooltip's required `relationship` prop has no default — a real type/runtime gap for every bare call site

**What goes wrong:** Every current `<TooltipContent>text</TooltipContent>` call site never specifies a `relationship`, but Fluent's `Tooltip.relationship` (`'label'|'description'|'inaccessible'`) is required with no default (per FEATURES.md's C6 row) — if the adapter doesn't supply an internal default, every existing call site either fails to type-check (if the adapter's own prop is typed as required) or throws/warns at runtime (if Fluent's own prop validation is strict).
**Prevention:** The adapter itself must default `relationship="label"` internally (as FEATURES.md already recommends) so none of the many existing bare `<Tooltip><TooltipContent>...</TooltipContent></Tooltip>` call sites need to change — but explicitly test that this default doesn't introduce a *screen-reader* regression (a Tooltip whose content is genuinely a "description" rather than a "label" would be mis-announced if defaulted to "label" everywhere) — spot-check a handful of the highest-traffic Tooltip usages (e.g. icon-only buttons in admin nav) to confirm "label" semantics are actually correct for them, not just non-crashing.
**Phase to address:** Phase 40 (Plan C), C6 (Tooltip).

### Pitfall 16: `asChild`→`cloneElement` shim drops ref forwarding or mishandles multiple children

**What goes wrong:** Fluent has no `Slot` concept, so the plan's `cloneElement`-based shim must manually merge props (and forward refs) onto a single child element. Two edge cases commonly break naive `cloneElement` shims: (a) the child passed to `asChild` is itself a component that doesn't forward refs (a plain function component without `forwardRef`), so `cloneElement`'s injected `ref` silently does nothing — no error, just a component that can't be focused/measured/animated correctly by whatever wrapped it (e.g. Tooltip's positioning logic needs a real DOM ref to the trigger); (b) `asChild` is passed more than one child (a slightly malformed but not-uncommon usage, e.g. `<Button asChild><Icon /><span>Text</span></Button>`), which `cloneElement` cannot handle (it operates on exactly one element) — Radix's own `Slot` has specific multi-child handling `cloneElement` doesn't replicate by default.
**Prevention:** The shim should explicitly validate (in dev mode, via a console warning, not a silent no-op) when its single child doesn't accept a ref or when more than one child is passed — cheap to add, and turns two classes of silent bugs into loud dev-time warnings. Audit the 33 `asChild` call sites specifically for these two patterns (multiple children under `asChild`; ref-forwarding-incapable child components) as part of Phase 39/40's shim rollout, not assumed away.
**Phase to address:** Phase 39 (Plan B) for the shim's own implementation and warning logic; Phase 40 (Plan C) for composites (Dialog/Sheet/Menu/Tooltip triggers) that also consume the same shim and inherit any gaps in it.

### Pitfall 17: Coverage threshold math breaks when Select/DropdownMenu/Form move from excluded to included

**What goes wrong:** `vitest.config.ts`'s current 71/82/70/71 thresholds were calibrated against a codebase that explicitly excludes `dropdown-menu.tsx`, `select.tsx`, `form.tsx` from coverage measurement. The moment Phase 40 removes those exclusions (per the plan's own "顺带补齐...历史欠账" intent) and adds fresh tests, the *denominator* changes — even well-tested new adapter code can transiently lower the measured percentage if the new files' line/branch count is large relative to their initial test depth, potentially failing the existing threshold gate on a commit that is actually a net *improvement* in real coverage.
**Prevention:** Do not simply "add tests and hope the number holds" — compute the actual before/after coverage delta locally before removing an exclusion, and if removing all three exclusions at once would drop the aggregate below threshold even with reasonable new tests, sequence it as: write thorough tests for one component first (e.g. Select, per its HIGH complexity/priority), remove *only that one* exclusion, confirm thresholds still pass, commit, then repeat for DropdownMenu, then Form — mirroring the same "one component, one commit" discipline already used for the Radix→Fluent swap itself. Do not treat "removing the exclusion" and "the Radix→Fluent swap" as one commit; keep the coverage-inclusion change and the implementation-swap change legible as separable diffs where possible, since either could be the cause if the CI threshold gate fails.
**Phase to address:** Phase 40 (Plan C), specifically the C3 (Select)/C4 (DropdownMenu)/C8b (Form) sub-phases; final threshold recalibration (raising the numbers, per the plan's own TODO comment in `vitest.config.ts`) belongs to Phase 42 (Plan F)'s "评估将...移出 coverage.exclude 并调高阈值" step.

### Pitfall 18: Playwright ARIA-selector drift from structural changes even when semantics are "correct"

**What goes wrong:** FEATURES.md's own C1–C4 rows note E2E specs query by ARIA role/name and are expected to survive migration "at a high probability" — but this is a probabilistic claim, not a guarantee. A component with genuinely correct ARIA semantics post-migration can still break a Playwright selector if, e.g., the *accessible name* computation changes (Fluent deriving a label from a different DOM element/attribute than Radix did, even though both are "correct" per WAI-ARIA), or if a `role="dialog"` now has an additional wrapping `role="dialog"`-adjacent ancestor that changes a `page.getByRole("dialog").getByRole(...)` chained query's match count.
**Prevention:** Do not treat "ARIA role/name selectors probably survive" as "no E2E verification needed" — run the *existing* Playwright suite (unmodified) against each Phase 40 composite commit as the actual regression signal, exactly as Phase 39 already plans to do for its own infra changes; a passing existing E2E suite after a composite's migration is the real evidence, not an a priori assumption from the component mapping table.
**Phase to address:** Phase 40 (Plan C), per-component — each composite's commit should include a full existing-E2E-suite run, not just its own new/updated spec.

---

## Minor Pitfalls

### Pitfall 19: Fluent theme ramp doesn't perceptually match existing CSS-variable brand colors on every stop
**What goes wrong:** The 10 pre-generated `BrandVariants` ramps are offline-generated from a single anchor hex per accent (per ARCHITECTURE.md §2) — exact perceptual matching across all 16 stops to the existing `index.css` `--primary`/`--ring`/`--chart-1` values isn't guaranteed, so some Fluent-rendered tokens (e.g. a hover state at ramp stop 60) may look slightly "off" compared to the equivalent Tailwind CSS-variable-driven color used elsewhere on the same screen.
**Prevention:** Already correctly scheduled as a Phase F "对照 Foundry 门户截图微调" step — the pitfall is only in *not* treating Phase 39's ramps as provisional/revisable, e.g. hardcoding downstream Griffel overrides against Phase 39's initial ramp values in ways that would need rework once Phase F fine-tunes them. Keep Griffel component overrides that reference brand tokens indirect (via the `tokens.colorBrand*` API) rather than hardcoded hex copies of Phase 39's provisional ramp, so a Phase F ramp adjustment propagates without touching component code.
**Phase to address:** Phase 39 (Plan A) generates provisional ramps; Phase 42 (Plan F) is the intended correction point — no action needed mid-migration beyond not hardcoding around provisional values.

### Pitfall 20: `Input`/`Textarea` ref-forwarding target changes from root to inner element breaks a ref-dependent consumer
**What goes wrong:** FEATURES.md's #3/#10 rows note Fluent's `Input`/`Textarea` wrap the native element in a root `<div>`, moving the ref-forwarding target — any consumer using `inputRef.current.focus()`/`.select()`/measuring `.getBoundingClientRect()` on what it assumes is the top-level DOM node could get the wrapper div instead of the actual `<input>`/`<textarea>` if the adapter's `forwardRef` isn't wired to the inner element specifically. `avatar-page.tsx`'s own `textareaRef.current?.focus()` (used in the `handleUseTextInstead` callback, per the code read for this milestone) is a concrete, real call site depending on this being the actual focusable element.
**Prevention:** Explicitly verify (unit test, not just "should work") that the adapter's exposed ref resolves to the actual `<input>`/`<textarea>` DOM node, not the wrapper — write a test that calls `.focus()` through the forwarded ref and asserts `document.activeElement` is the input/textarea itself. Cross-check `avatar-page.tsx`'s specific `textareaRef.current?.focus()` call site manually (or via its own E2E flow) since it's a known, named consumer of this exact ref behavior.
**Phase to address:** Phase 39 (Plan B), Input/Textarea rows.

### Pitfall 21: `Avatar`'s children-to-props translation misses the broken-image→fallback path in jsdom-based unit tests
**What goes wrong:** FEATURES.md's #12 row already flags that Radix's automatic broken-image→fallback swap needs a hand-wired `onError` handler in the Fluent adapter, and that jsdom doesn't naturally fire `error` events on `<img>` without an explicit `fireEvent.error(...)` call in the test — a naive port of the existing Avatar test suite (if it currently relies on jsdom "just working" for image-load-failure simulation, or doesn't test that path at all) would give false confidence that the fallback path works, when it's actually never been exercised.
**Prevention:** Explicitly audit whether any current Avatar test exercises the broken-image path today (grep for `fireEvent.error` or similar in `avatar.test.tsx` if it exists) — if it doesn't exist today, this is a *new* test to write during the migration (not a port), specifically simulating `fireEvent.error(imgElement)` and asserting the `initials`/`icon` fallback renders.
**Phase to address:** Phase 39 (Plan B), Avatar row (already flagged as the highest-complexity leaf in FEATURES.md).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Keep Card family as plain Tailwind divs instead of adopting real Fluent `Card` (FEATURES.md's Option (b) for C8a) | Lower risk, no new interactive-affordance neutralization work | Slight visual/behavioral inconsistency vs. "true" Fluent 2 card semantics (elevation, selection) if a future feature genuinely needs Fluent's selectable-card list behavior | Acceptable indefinitely unless a future feature explicitly requires Fluent Card's `selected`/`onSelectionChange` semantics — re-evaluate then, don't pre-adopt speculatively |
| Adapter re-emits legacy `data-state` attribute instead of migrating every test to ARIA assertions (Pitfall 6's option (b)) | Zero test-file changes for components where this is chosen | Adapter carries a permanent, Fluent-foreign attribute forever; a future contributor unfamiliar with the migration history might be confused why a Fluent component has `data-state` | Acceptable only where genuinely cheaper than a full test rewrite AND documented with an inline comment explaining why it's there — never silently |
| Deferring Select/DropdownMenu/Form coverage-threshold recalibration to Phase F instead of raising thresholds incrementally per component | Simpler, one recalibration event instead of three | Risk of one large threshold jump masking which specific component's tests are thin, vs. incremental visibility | Acceptable given the plan's own phased structure — just ensure Phase 40's per-component tests are genuinely thorough regardless of when the *threshold number* itself changes |
| Treating `@radix-ui/react-scroll-area` as permanently kept rather than revisiting later | Zero migration work for scroll-area | A future full "0 Radix dependencies" cleanliness goal is permanently unreachable without reopening this decision | Acceptable — this is an explicit, dated (2026-08-05) user decision, not an oversight; only revisit if Fluent ever ships a comparable custom-scrollbar primitive |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Griffel ↔ Tailwind (`@tailwindcss/vite`) | Assuming the coexistence "just works" because both are atomic CSS and never explicitly setting `insertionPoint` | Explicit `insertionPoint` anchor + `RendererProvider`, verified against built `dist/index.html`, every time build tooling changes (Vite major bump, plugin change) |
| `@fluentui/react-components` ↔ Vite dev server | Not adding `optimizeDeps.include` and shipping a slow/flaky first cold-start that looks like a bug | Add `optimizeDeps: { include: ["@fluentui/react-components", "@fluentui/react-icons"] }` per STACK.md, verify dev server doesn't mid-session restart on first Fluent import |
| `@fluentui/react-icons` ↔ tree-shaking | Any wildcard/namespace import anywhere in `components/icons/` | Named imports only, code-reviewed specifically on the 2 files allowed to import from the package directly |
| Fluent `Toaster`/`useToastController` ↔ non-component call sites (46 files) | Calling `dispatchToast` (a hook-bound function) directly from a non-component module, which cannot work | Pub/sub bridge decoupling caller (`toast.xxx()`, anywhere) from dispatcher (inside the mounted `<Toaster>` tree) — already the plan's correct design, verify it's not bypassed by a future "quick fix" that calls the hook-bound function directly from a utility module |
| react-hook-form `Controller`/`FormProvider` ↔ Fluent `Label` swap | Assuming `FormControl`'s `@radix-ui/react-slot`-based `Slot` usage is unaffected because "we're not migrating Form logic" | `FormControl`'s Slot usage IS affected (it's the same `asChild`-style pattern) and needs the same `cloneElement` shim as Button/Badge — scope narrowly to `FormLabel`'s internal `Label` per the plan, but don't assume `FormControl` is untouched just because `Form`/`FormField`/`useFormField` are |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Recomputing a `Theme` object (via `createLightTheme`/`createDarkTheme`) on every render instead of caching | Visible jank on theme/accent toggle; unnecessary re-renders of every Fluent-backed component in the tree | Memoize via the `THEME_CACHE` Map pattern (ARCHITECTURE.md §2) — 10 fixed combinations, computed once, cached forever | Noticeable at any scale once more than a handful of Fluent components are mounted simultaneously (i.e., becomes visible starting Phase 40, not Phase 39 where few components exist yet) |
| Griffel `makeStyles()` called inside a component body without memoization concerns (though Griffel itself caches by content hash internally) | Not a first-order risk per Griffel's own design, but combined with a *non-memoized* variant-lookup object (e.g. rebuilding a `variant→appearance` mapping object literal on every render inside the adapter) can add unnecessary allocation churn | Hoist static mapping tables (Button's variant→appearance, Badge's variant→(color,appearance)) to module scope, not component-body literals | Only measurable at high re-render frequency (e.g. a Button re-rendering on every keystroke of a parent form) — low priority but free to get right from the start |
| Rollup/Vite needing to parse the full `@fluentui/react-components` re-export graph to tree-shake | Slower production build times (not runtime/bundle-size impact — STACK.md confirms shipped bundle is unaffected) | Accept as a one-time build-time cost; don't attempt to "fix" by switching to individual sub-package installs (STACK.md's own "Alternatives Considered" already rejects that for zero benefit here) | Noticeable mainly in CI build-time metrics after Phase 39's install lands, not a scaling concern per se |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| None domain-specific to this migration beyond general web security | This is a UI-component-library swap with no new data flows, no new external service calls, no new auth surface | N/A — the existing app's security posture (JWT auth, CORS, prompt-injection/PII sanitization gates from prior milestones) is unaffected by an internal component-implementation swap; verify only that no new component introduces `dangerouslySetInnerHTML`-equivalent unsafe rendering where the old Radix component didn't (spot-check any component rendering user-controlled `children`/`content` props, e.g. Toast's `message`/`description`, Tooltip's `content`) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Icon size/weight inconsistency mid-migration (Pitfall 2/8) visible to real users during the Phase 41 rollout window | Icons look subtly "off" (wrong size, wrong fill weight) across a live app during the multi-week directory-batch rollout, not just in a dev environment | Complete the spike + full mapping table before the *first* batch commit, so even the earliest-migrated directory (`admin/*`) is visually correct from day one of the rollout, rather than "admin looks slightly wrong for a week until we fix it in `pages/*`'s batch" |
| Toast "loading" state ambiguity — Fluent has no native "loading" intent (§6 already notes this is modeled as an `info`-styled toast with no timeout) | A user might not visually distinguish "this is a loading/in-progress toast" from "this is an informational toast" if the bridge's visual treatment for `loading` doesn't add a spinner/progress indicator the way `sonner`'s `toast.loading()` typically does (an animated spinner icon) | Explicitly add a loading-spinner visual (Fluent's own `Spinner` component, already available per FEATURES.md's "Spinner note") inside the bridge's rendered `<Toast>` when `intent === "loading"`, not just a plain info-styled message — this is a UX parity gap beyond the pure API-shape translation already planned |
| Keyboard focus loss on Sheet/Dialog close during the dual-stack period if a migrated overlay's focus-return behavior differs from Radix's (Pitfall 12) | Keyboard-only users (including screen-reader users) lose their place in the page after closing a migrated modal/drawer | Explicit focus-return assertions per composite (Pitfall 12's prevention), verified with real keyboard interaction in Playwright, not just click-based open/close |

## "Looks Done But Isn't" Checklist

- [ ] **Griffel/Tailwind insertion order:** Often "looks done" once dev mode renders correctly — verify against the *built* `dist/index.html`, not just `npm run dev`, since insertion order can differ between dev and prod bundling.
- [ ] **Icon size parity:** Often "looks done" for the 3–5 spike icons tested — verify across all 4 directory batches with an actual visual diff pass per batch, not just the initial spike.
- [ ] **Toast lifecycle:** Often "looks done" once `toast.success()`/`toast.error()` work — verify the `loading()` → `dismiss(id)` round-trip specifically (the one path with no simple binary pass/fail, since a stuck loading toast is easy to miss in a quick manual check).
- [ ] **Checkbox/Switch tri-state:** Often "looks done" once checked/unchecked toggling works — verify the indeterminate/"mixed" path specifically, since most manual QA only exercises binary states.
- [ ] **`data-state` test coverage:** Often "looks done" once the 2 known `checkbox.test.tsx` lines are fixed — verify via a fresh grep per composite (Pitfall 6), since the known lines are not the full blast radius.
- [ ] **Coverage thresholds:** Often "looks done" once `npm run build`/`tsc -b` pass — verify `npm run test -- --coverage` actually clears the configured thresholds locally before pushing, especially for Select/DropdownMenu/Form once their exclusions are lifted.
- [ ] **Phase F dependency removal:** Often "looks done" once the grep shows zero hits at planning time — re-run the grep immediately before the uninstall commit, not just once earlier in the phase.
- [ ] **Keyboard navigation on migrated overlays:** Often "looks done" once mouse-click open/close works in manual QA — verify Tab/Shift+Tab/Escape/Arrow-key sequences explicitly, since these are the paths manual click-testing skips.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Griffel/Tailwind order inversion discovered post-merge (Pitfall 1) | LOW | `git revert` the single infra commit (Phase 39/A) that wired `RendererProvider`/`insertionPoint` incorrectly, since no component-level code depends on the *specific* insertion-point value, only on it existing and being deterministic — fix the anchor position, re-land as a new commit |
| Icon size regression shipped across a whole directory batch (Pitfall 2) | MEDIUM | Because Phase 41's batches are per-directory commits, `git revert` the specific batch commit(s) affected, fix `_adapter.tsx`'s stripping logic centrally, re-run the spike verification, then re-apply the batch(es) as new commits — the shared adapter means a single fix propagates to all reverted-and-reapplied icons at once |
| `toastId` doesn't survive into `dispatchToast` as assumed (Pitfall 4) discovered mid-Phase-41 | MEDIUM | Because this is gated as a pre-rollout spike (per the prevention above), discovery *before* the 46-file rollout means only the bridge's internal implementation needs rework (add a bridge-side id-mapping layer), not any of the 46 call sites — this is exactly why the spike-first sequencing matters: if discovered *after* rollout instead, cost would be HIGH (every call site's assumption about `dismiss(id)` semantics would need re-audit) |
| Phase 42 (F) dependency uninstall breaks a missed call site | HIGH | No simple revert once the uninstall + lockfile update commit is merged and others have pulled/built on top of it — recovery requires re-adding the specific removed package (`npm install` the exact prior version), fixing the missed call site, then re-running the full grep + uninstall sequence as a *new* attempt; this is precisely why the double-grep discipline (Pitfall 7) exists as prevention rather than relying on recovery |
| Composability regression between two independently-passing migrated components (Pitfall 7's mode 1) | MEDIUM | Identify via the cross-component Playwright check (once added per Pitfall 7's prevention); revert whichever of the two components' commits is easier to roll back to isolate the interaction, fix the `cloneElement`/prop-forwarding issue at the boundary, re-apply |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Griffel/Tailwind order inversion | Phase 39 (A) | Inspect built `dist/index.html` `<head>` order; add a repeatable build-check script, not a one-time manual pass |
| 1b. StrictMode double-render on Griffel renderer | Phase 39 (A) | Code review: `createDOMRenderer`/`RendererProvider` construction is at module scope, not component body |
| 2. Icon `fontSize` defeats Tailwind `size-*` | Phase 41 (D) | Spike: pixel-diff 3–5 icons vs. lucide originals at multiple `size-*` values, before batch rollout begins |
| 3. FluentProvider paints over `<body>` | Phase 39 (A) | Full existing E2E suite run against `avatar-page.tsx`'s grid layout specifically after provider wiring |
| 4. Toast loading/dismiss lifecycle + silent `vi.mock` no-op | Phase 41 (E) | Live `dispatchToast`/`dismissToast` `toastId` round-trip test as entry gate; per-file mock-interception sanity check during the 46-file swap |
| 5. Checkbox/Switch `onChange` signature drop | Phase 39 (B) | Dedicated tri-state/"mixed" unit test, not just checked/unchecked |
| 6. `data-state` blast radius beyond known lines | Phase 40 (C), per-component | Grep `data-state` scoped to each composite's test/snapshot/production files before starting that component |
| 7. Coexistence discipline / Phase F irreversibility | Phase 40 (C) for composability; Phase 42 (F) for double-grep | Cross-component Playwright checks (Tooltip+Button+MenuTrigger); grep re-run immediately before uninstall commit |
| 8. Filled/Regular icon mismatch | Phase 41 (D) | Visual side-by-side review of all 84 mapping rows, not just name-matching |
| 9. Wildcard icon import bundle bloat | Phase 41 (D) | Code review restricted to `components/icons/index.ts` + `_adapter.tsx`; before/after bundle-size diff |
| 10. Missing 1:1 icon equivalents deferred | Phase 41 (D) | Complete 84-row mapping table as upfront blocking artifact, including explicit "no match" rows |
| 11. Nested/duplicate FluentProvider in portals | Phase 40 (C1 Dialog) | Confirm `applyStylesToPortals` behavior on first portal component; pattern reused by C2/C3/C4/C6 |
| 12. Focus-visible/keyboard regressions | Phase 40 (C), per-component; Phase 42 (F) aggregate | Explicit Tab/Shift+Tab/Escape/Arrow-key Playwright assertions per composite commit |
| 13. `ProgressBar` 0–1 vs 0–100 | Phase 39 (B) | Unit test asserting scaled value for a representative percentage input, plus indeterminate case |
| 14. `OverlayDrawer` `defaultOpen` no-op | Phase 40 (C2 Sheet) | Grep all `<Sheet>` usages for `defaultOpen` before migration; convert to controlled state as precondition |
| 15. Tooltip required `relationship` default | Phase 40 (C6 Tooltip) | Adapter defaults `relationship="label"`; spot-check highest-traffic usages for correct semantic fit |
| 16. `asChild`→`cloneElement` ref/multi-child edge cases | Phase 39 (B) shim; Phase 40 (C) composite consumers | Dev-mode warning on ref-incapable child or multiple children; audit of 33 `asChild` sites |
| 17. Coverage threshold math on exclusion removal | Phase 40 (C3/C4/C8b); recalibration in Phase 42 (F) | Sequence exclusion removal one component at a time; confirm thresholds hold before each removal commit |
| 18. Playwright ARIA-selector drift | Phase 40 (C), per-component | Full existing E2E suite run (unmodified) as the actual regression signal per composite commit |
| 19. Theme ramp perceptual mismatch | Phase 39 (A) provisional; Phase 42 (F) correction | Griffel overrides reference `tokens.colorBrand*` indirectly, not hardcoded provisional hex values |
| 20. Input/Textarea ref target change | Phase 39 (B) | Unit test: forwarded ref `.focus()` resolves to actual `<input>`/`<textarea>`, not wrapper div; manual check of `avatar-page.tsx`'s `textareaRef` usage |
| 21. Avatar broken-image fallback untested in jsdom | Phase 39 (B) | New/updated test using `fireEvent.error(imgElement)`, not assumed jsdom default behavior |

## Sources

- `.omc/plans/fluent-ui-migration-plan.md` — migration plan's own risk flags (Griffel order, StrictMode, `data-slot`, `asChild`, `toast.loading`/`dismiss`, coexistence/rollback rules) — read directly, HIGH confidence.
- `.planning/research/STACK.md` (peer, this milestone) — Griffel injection-order mechanics verified from `@griffel/core`/`@griffel/react` source; bundle-size/tree-shaking verification — HIGH confidence, extended here with failure-mode analysis.
- `.planning/research/ARCHITECTURE.md` (peer, this milestone) — FluentProvider placement, theme bridge, toast bridge design, anti-patterns — HIGH/MEDIUM confidence per its own flags; extended here with recovery/verification detail.
- `.planning/research/FEATURES.md` (peer, this milestone) — per-component Radix→Fluent API diff table, verified against `@fluentui/react-components` v9 published `.d.ts`/source — HIGH confidence; extended here with the failure-mode/blast-radius analysis FEATURES.md's template scope didn't cover.
- `frontend/src/components/ui/checkbox.test.tsx` (read directly) — confirmed `data-state` assertions at lines 20/26, the concrete anchor for Pitfall 6.
- `frontend/src/pages/avatar-page.tsx` (read directly, lines 200–460) — confirmed `toast.loading()`/`toast.dismiss(toastId)` lifecycle at lines 224–243 (Pitfall 4), `SheetContent side="bottom"` at line 446 (resolved per FEATURES.md, not a pitfall), `textareaRef.current?.focus()` usage relevant to Pitfall 20, and the CSS-grid layout (`grid-cols-1 md:grid-cols-[1fr_300px]`) relevant to Pitfall 3.
- `frontend/vitest.config.ts` (read directly) — confirmed current 71/82/70/71 thresholds and `dropdown-menu.tsx`/`select.tsx`/`form.tsx` coverage exclusions, the concrete anchor for Pitfall 17.
- `.planning/PROJECT.md` — confirmed Phase 39–42 (A–F) mapping and milestone scope/decisions (scroll-area kept on Radix, `side="bottom"` single call site, CLAUDE.md's "逐个实现" sequencing rule) — HIGH confidence.

---
*Pitfalls research for: Fluent UI v9 adapter-mode migration (v3.0 milestone, Phases 39–42)*
*Researched: 2026-08-06*
