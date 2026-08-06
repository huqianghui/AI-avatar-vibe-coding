# Phase 40: Composite Component Adapters - Research

**Researched:** 2026-08-06
**Domain:** Fluent UI v9 adapter-mode migration — composite components (Dialog, Sheet, Select, DropdownMenu, Tabs, Tooltip, Card, Form; ScrollArea excluded)
**Confidence:** HIGH (component API mappings verified against published `.d.ts`/source in prior milestone research; current codebase state verified by direct file reads and greps in this session)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | `dialog` — 9 named exports preserved, map to Fluent Dialog/DialogSurface/DialogBody, Overlay/Portal become transparent wrappers, Playwright verifies Portal position/z-index | See "Dialog (COMP-01)" mapping below; exact current export list confirmed by direct read of `dialog.tsx` |
| COMP-02 | `sheet` — map to Fluent OverlayDrawer (left/right + bottom natively supported); audit `defaultOpen` non-controlled usage | See "Sheet (COMP-02)"; grep confirmed zero `defaultOpen` usage anywhere in repo; `avatar-page.tsx:446` call site confirmed |
| COMP-03 | `select` — map to Fluent Dropdown; handle value/selectedOptions/onOptionSelect triple; SelectScrollUp/DownButton no-op; new select.test.tsx (ARIA), counted toward coverage | See "Select (COMP-03)"; confirmed select.tsx has zero test file today, confirmed `vitest.config.ts` exclusion |
| COMP-04 | `dropdown-menu` — map to Fluent Menu family; verify theme-picker.tsx visual; new/expanded dropdown-menu tests counted toward coverage | See "DropdownMenu (COMP-04)"; **corrects prior research claim** — `dropdown-menu.test.tsx` already exists (7 tests) but is excluded from coverage measurement; scope is expand+un-exclude, not write-from-zero |
| COMP-05 | `tabs`(TabList/Tab) + `tooltip` — internal replacement, preserve export surface + ARIA | See "Tabs (COMP-05a)" and "Tooltip (COMP-05b)"; **critical finding**: 6+ Playwright E2E assertions in `conference.spec.ts`/`admin-dry-run.spec.ts`/`admin-skill-editor.spec.ts` directly assert `data-state="active"/"inactive"` on Tab/TabPanel roles — these WILL break and must be rewritten as part of this component's commit |
| COMP-06 | `card` — go/no-go decision (Fluent Card w/ selectable-list semantics vs plain-div), implement, preserve export surface | See "Card (COMP-06)"; recommendation: keep as plain divs (Option B) |
| COMP-07 | `form` — only FormLabel's internal Label swaps; Slot→cloneElement shim; backfill form test coverage | See "Form (COMP-07)"; confirmed `form.tsx` has zero test file; confirmed `FormControl`'s `Slot` usage from `@radix-ui/react-slot` |
| COMP-08 | `scroll-area` stays Radix, not migrated | Confirmed `scroll-area.tsx` unchanged from Radix; no action needed this phase |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **逐一实现 (one requirement at a time):** Implement COMP-01 through COMP-07 strictly sequentially — one requirement fully done (impl → 100% unit test → Playwright E2E → all green → commit → push) before starting the next. Never batch multiple COMP-XX into parallel work.
- **100% unit test coverage per requirement** — pytest is N/A here (frontend-only phase); vitest is the enforcement tool. Each component's own new/changed logic must be fully covered, not just "doesn't crash."
- **Playwright E2E from user-story angle** — run (and where broken, fix) the existing E2E suite per component, not just add new specs.
- **All tests pass before commit; one commit per requirement; push after each commit.** COMP-08 (scroll-area) requires no code change and no commit — verify-and-skip.
- **TypeScript strict mode** (`frontend/tsconfig.json`): no `any`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess` — adapter code (event-shim callbacks, cloneElement guards) must satisfy this without escape hatches.
- **`cn()` utility preserved for consumer/business code** — inside `ui/*` adapter internals, per Phase 39's established pattern, use Griffel `mergeClasses()` instead, appending consumer `className` last.
- **No Redux, TanStack Query for server state** — not directly relevant to this phase (pure presentation-layer swap), but no new client state library should be introduced for any composite's internal state (e.g. Tabs' context, Select's value-shape translation) — plain `React.useState`/Context only, matching Phase 39's precedent.
- **Conventional commits, English commit messages** — `feat(40-XX): migrate <component> to Fluent UI` pattern, matching Phase 39's commit history (`afb32ef feat(39-07): migrate Avatar to Fluent UI`, etc.).

## Summary

Phase 40 migrates 7 of the 8 in-scope composite components (`dialog`, `sheet`, `select`, `dropdown-menu`, `tabs`, `tooltip`, `form`; `card` is a go/no-go decision defaulting to no-op; `scroll-area` is explicitly excluded) from Radix/shadcn internals to Fluent UI v9, using the exact adapter-mode pattern already proven in Phase 39 (7/7 plans complete): preserve every export name, prop signature, and `data-slot` attribute so all 126 consumer files keep compiling and behaving identically, while the internal implementation swaps to Fluent primitives plus small shim layers for API-shape differences Fluent has no equivalent for (`asChild`→`cloneElement`, Radix `data-state`→Fluent ARIA, single-value Select↔Fluent's array-based `selectedOptions`).

The two highest-complexity components are **Select** (largest controlled-value API delta in the whole migration: Radix's single `value`/`onValueChange(string)` vs Fluent Dropdown's `value`(display text)+`selectedOptions`(array)+`onOptionSelect` triple) and **DropdownMenu** (Fluent's Menu family lifts checked-item state to the `MenuList` level via `checkedValues`/`onCheckedValueChange`, not per-item, requiring an internal synthetic-state wrapper). Both should get dedicated time/attention and should NOT be bundled into the same commit or session as each other, per the existing risk-isolation research finding.

**Corrected finding vs. prior research docs:** `dropdown-menu.test.tsx`, `sheet.test.tsx`, `tooltip.test.tsx`, and `card.test.tsx` **already exist** (read directly this session) — the claim in `.planning/research/FEATURES.md` that dropdown-menu.tsx has "no dedicated coverage today" is only true in the narrow sense that `vitest.config.ts`'s `coverage.exclude` list omits it from the measured percentage; a real (if thin, 7-test) test file exists. `select.tsx` and `form.tsx` are the only two composites with **zero** test file today — those two are the ones needing tests written truly from scratch. COMP-04's scope is therefore "expand the existing 7-test file with ARIA-based coverage + remove the `coverage.exclude` entry," not "write from an empty file."

**Second corrected/new finding (not in prior research docs):** the existing Playwright E2E suite contains **direct, hard-coded `data-state="active"/"inactive"` assertions** on Tab elements in `frontend/e2e/conference.spec.ts` (6 assertions) and on `[role='tabpanel']` in `admin-dry-run.spec.ts`/`admin-skill-editor.spec.ts` (2 assertions). Since Fluent's `Tab` uses `aria-selected` and has no panel/`data-state` concept at all, **these E2E specs will fail immediately upon migrating Tabs** unless the adapter re-emits `data-state` manually (matching the Checkbox precedent from Phase 39) or the E2E specs are rewritten to ARIA queries as part of the COMP-05a commit. This is a concrete instance of Pitfall 6's "blast radius beyond known lines" warning, now empirically confirmed for Tabs specifically — it was previously only a theoretical risk in the milestone-wide research.

**Primary recommendation:** Follow Phase 39's proven per-component discipline exactly — one composite, one commit, tests-then-commit, in complexity order Dialog → Sheet → Tabs+Tooltip → Form → Card(decision) → Select → DropdownMenu (deferring the two highest-risk/highest-effort composites to last so the adapter conventions — Griffel override file pattern, `cloneElement` `asChild` shim, `data-state` re-emission strategy — are already battle-tested by the time Select/DropdownMenu's harder API-shape work begins).

## User Constraints

No `.planning/phases/40-composite-component-adapters/40-CONTEXT.md` exists for this phase (verified via `gsd-tools.cjs init phase-op 40` → `has_context: false`). There are no locked user decisions specific to Phase 40 beyond the milestone-wide decisions already recorded in `.planning/REQUIREMENTS.md` and Phase 39's `39-CONTEXT.md`:

- scroll-area stays on Radix (2026-08-05 user decision, COMP-08, non-negotiable)
- No React 18→19 upgrade
- No consumer/business-code rewrite (adapter pattern only)
- No big-bang single-commit replacement (CLAUDE.md 逐一实现 rule)
- Card (COMP-06) is explicitly flagged as a go/no-go decision point, not a locked choice — this research recommends Option B (keep as plain divs) but the planner/executor has discretion to choose Option A if Foundry-portal visual parity specifically demands Fluent Card's selectable-list semantics.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fluentui/react-components` | ^9.74.4 (installed, confirmed in `frontend/package.json`) | Dialog, Drawer (Sheet), Dropdown (Select), Menu family (DropdownMenu), TabList/Tab (Tabs), Tooltip, Label (Form) | Already installed and in use since Phase 39; single package re-exporting all needed sub-packages |
| `@fluentui/react-icons` | ^2.0.334 (installed) | Icons used inside composite adapters where currently lucide-react icons are used internally (e.g. dialog's `XIcon`, select's `CheckIcon`/`ChevronDownIcon`/`ChevronUpIcon`, dropdown-menu's `CheckIcon`/`ChevronRightIcon`/`CircleIcon`) | Out of scope for icon *replacement* this phase (Phase 41 handles the 84-icon swap) — Phase 40 composites continue using lucide-react icons internally, unchanged, per the milestone's explicit phase boundary |
| `@griffel/react` (transitive) | via `@fluentui/react-components` | `makeStyles()`, `mergeClasses()` for any component-specific override (e.g. Tabs' hand-built `TabsContent` panel styling, Card's Griffel token-color overrides if Option A is chosen) | Already the established pattern from Phase 39 (`button.styles.ts` precedent) |

### Supporting (already present, unaffected by this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | (existing) | Form/FormField/Controller/useFormField logic | Untouched by COMP-07 — only `FormLabel`'s internal `Label` and `FormControl`'s `Slot` usage change |
| `@radix-ui/react-scroll-area` | (existing) | ScrollArea/ScrollBar | Explicitly kept, COMP-08 |
| `lucide-react` | (existing) | Icons rendered inside migrated composites | Unchanged this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fluent `Dropdown` for Select | Fluent `Combobox` | `Combobox` is the freeform/searchable variant — wrong UX contract for a closed single-select popup listbox; `Dropdown` is correct |
| Real Fluent `Card` for COMP-06 | Plain Tailwind divs + Griffel token colors | Fluent Card adds `selected`/`onSelectionChange`/`focusMode` (selectable-list-item semantics) not present in current usage — adopting it means neutralizing new interactive affordances via Griffel overrides for zero functional gain; plain-div (Option B) is the default recommendation |
| Adapter-level `data-state` re-emission for Tabs (matches Checkbox precedent) | Rewrite all 8 `data-state` E2E/unit assertions to ARIA equivalents | Re-emission is cheaper (zero test-file changes, same technical-debt tradeoff already accepted for Checkbox in Phase 39) but adds a permanent Fluent-foreign attribute; rewriting to `aria-selected` is more idiomatic long-term but touches 3 E2E spec files + establishes the ARIA pattern for Dialog/Sheet/DropdownMenu that don't have this luxury (no existing passing assertions to preserve) |

**Installation:** No new packages needed — `@fluentui/react-components`/`@fluentui/react-icons` already installed at the researched versions.

**Version verification:**
```bash
cat frontend/package.json | grep '"@fluentui'
# "@fluentui/react-components": "^9.74.4",
# "@fluentui/react-icons": "^2.0.334",
```
Confirmed installed and matching STACK.md's Phase 39 recommendation — no version drift to address.

## Architecture Patterns

### Recommended Component Structure (per composite, following Phase 39 precedent)

```
frontend/src/components/ui/
├── dialog.tsx              # adapter: Dialog/DialogTrigger/.../DialogClose (9 exports)
├── dialog.test.tsx          # new — no test file exists today
├── sheet.tsx                # adapter: Sheet/SheetTrigger/.../SheetDescription (8 exports)
├── sheet.test.tsx           # existing (4 tests) — extend, do not replace
├── select.tsx                # adapter: Select/.../SelectValue (10 exports)
├── select.test.tsx           # new — ARIA-based, from scratch (COMP-03 backfill)
├── dropdown-menu.tsx         # adapter: DropdownMenu/.../DropdownMenuSubContent (15 exports)
├── dropdown-menu.test.tsx    # existing (7 tests) — expand with ARIA assertions (COMP-04 backfill)
├── tabs.tsx                  # adapter: Tabs/TabsList/TabsTrigger/TabsContent (4 exports)
├── tabs.test.tsx             # new — no test file exists today
├── tooltip.tsx                # adapter: Tooltip/TooltipTrigger/TooltipContent/TooltipProvider (4 exports)
├── tooltip.test.tsx           # existing (2 tests) — extend
├── card.tsx                   # unchanged if Option B chosen; adapter if Option A
├── card.test.tsx              # existing (7 tests) — extend only if Option A chosen
├── form.tsx                    # adapter: only FormLabel's Label + FormControl's Slot shim change
├── form.test.tsx                # new — no test file exists today (COMP-07 backfill)
└── scroll-area.tsx              # UNCHANGED — COMP-08, verify only, no commit
```

### Pattern 1: Composite-wraps-multiple-Fluent-primitives (Dialog, Sheet, DropdownMenu)

**What:** The shadcn "flat" export (e.g. `DialogContent`, `SheetContent`, `DropdownMenuContent`) that today renders one Radix primitive directly must become a small wrapper composing 2+ Fluent primitives internally, while remaining a single exported component to consumers.

**When to use:** Any composite where Fluent splits a single Radix concept into a deeper compound structure (surface+body for Dialog, popover+list for Menu, drawer+body for Sheet).

**Example — Dialog's `DialogContent`:**
```tsx
// Radix (current):
// <DialogPortal><DialogOverlay/><DialogPrimitive.Content>{children}</DialogPrimitive.Content></DialogPortal>

// Fluent (target) — DialogContent becomes a composite wrapper, NOT Fluent's own DialogContent
// (naming collision: Fluent's own DialogContent is a different inner sub-slot)
function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <DialogSurface data-slot="dialog-content" className={mergeClasses(className)} {...props}>
      <DialogBody>{children}</DialogBody>
    </DialogSurface>
  );
}
```
Source: `.planning/research/FEATURES.md` C1 row (verified against `@fluentui/react-components` `.d.ts`); current shape confirmed via direct read of `frontend/src/components/ui/dialog.tsx` lines 1-134.

### Pattern 2: Event-signature shim with explicit bidirectional translation (Select's triple-shape, DropdownMenu's lifted-state)

**What:** Fluent's `onOptionSelect(ev, data)` and Radix's `onValueChange(value)` are not equivalent shapes — the adapter must hold its own internal state and translate at the boundary, exactly as Phase 39 did for Checkbox's `"mixed"`↔`"indeterminate"` vocabulary shim.

**When to use:** Select (COMP-03) is the highest-complexity instance of this pattern in Phase 40.

**Example (pattern only — verify shape against installed `.d.ts` before implementing):**
```tsx
// Source: .planning/research/FEATURES.md C3 row (Fluent Dropdown .d.ts confirmed)
function Select({ value, onValueChange, children }: SelectProps) {
  const handleOptionSelect = (
    _ev: SelectionEvents,
    data: OptionOnSelectData,
  ) => {
    onValueChange?.(data.optionValue ?? "");
  };
  return (
    <Dropdown
      value={/* derive display text from value+children */}
      selectedOptions={value ? [value] : []}
      onOptionSelect={handleOptionSelect}
    >
      {children}
    </Dropdown>
  );
}
```

### Pattern 3: Hand-built panel logic where Fluent has no primitive (Tabs' TabsContent)

**What:** Fluent ships `TabList`+`Tab` but no `TabPanel`/`TabsContent` equivalent. `Tabs` (root) becomes a lightweight Context Provider replicating Radix root's `value`/`onValueChange` job; `TabsContent` becomes a hand-built conditional-render `<div>` reading the shared context.

**Example:**
```tsx
// Source: .planning/research/FEATURES.md C5 row
const TabsContext = React.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

function Tabs({ value, onValueChange, children }: TabsProps) {
  return <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>;
}

function TabsList({ children }: TabsListProps) {
  const ctx = useTabsContext();
  return (
    <FluentTabList
      selectedValue={ctx.value}
      onTabSelect={(_ev, data) => ctx.onValueChange(String(data.value))}
      data-slot="tabs-list"
    >
      {children}
    </FluentTabList>
  );
}

function TabsContent({ value, children }: TabsContentProps) {
  const ctx = useTabsContext();
  if (ctx.value !== value) return null;
  return <div data-slot="tabs-content" role="tabpanel">{children}</div>;
}
```
**Critical:** this hand-built `TabsContent` should manually emit `data-state={ctx.value === value ? "active" : "inactive"}` on both the Tab (inside `TabsTrigger`) and the panel — see Common Pitfalls below, this is now a hard requirement, not optional, given the confirmed existing E2E assertions.

### Pattern 4: Required-prop default injection (Tooltip's `relationship`)

**What:** Fluent's `Tooltip.relationship` has no default and every existing bare call site never specifies it. The adapter must supply `relationship="label"` internally.

```tsx
// Source: .planning/research/FEATURES.md C6 row
function TooltipContent({ children, sideOffset = 0, ...props }: TooltipContentProps) {
  return { content: children, relationship: "label", positioning: /* translate sideOffset */, ...props };
}
```

### Anti-Patterns to Avoid

- **Don't map Radix's `DialogContent` to Fluent's own `DialogContent` export** — naming collision trap (Pattern 1). Fluent's `DialogContent` is an inner sub-slot inside `DialogBody`, not the all-in-one surface wrapper.
- **Don't fake per-item `checked` state on `MenuItemCheckbox`/`MenuItemRadio`** — Fluent's officially-supported pattern lifts state to `MenuList.checkedValues`/`onCheckedValueChange` (dict keyed by group name). Faking per-item control fights the framework and will produce subtle keyboard-nav bugs.
- **Don't copy-paste the Checkbox tri-state shim for Switch-like binary components** — Phase 39's own retro (39-05-SUMMARY.md) explicitly flagged this exact copy-paste risk; verify each shim independently against that component's actual Fluent signature.
- **Don't skip the pre-migration `defaultOpen`/`data-state`/`asChild` greps per component** — these are cheap (one `grep` command) and are the primary defense against Pitfall 6/7/14/16 shipping silently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal/portal focus trap, Escape-to-close, ARIA `role="dialog"` wiring | A custom focus-trap hook | Fluent's `Dialog`/`DialogSurface` (built-in, WAI-ARIA-authored) | Fluent already implements this correctly; hand-rolling risks the exact keyboard-nav regressions Pitfall 12 warns about |
| Drawer/slide-panel open/close animation + backdrop | Custom CSS transitions on a manually-portaled div | Fluent's `OverlayDrawer` | Native `position="start"/"end"/"bottom"` support already covers 100% of current usage (verified: no `side="top"` usage exists) |
| Single-select popup listbox with keyboard nav (arrow keys, typeahead) | A custom `<div role="listbox">` + manual keydown handlers | Fluent's `Dropdown`/`Option` | Reimplementing WAI-ARIA listbox keyboard semantics correctly is a well-known hard problem; Fluent's is already compliant |
| Submenu/nested-menu positioning and hover-intent timing | Custom submenu positioning logic | Fluent's `MenuItem hasSubmenu` + nested `Menu`/`MenuPopover` | Positioning/collision-avoidance logic is exactly what Fluent's Menu family already solves |
| Required-but-missing "danger"/tri-state visual affordances | New custom component from scratch | Griffel `makeStyles` override on top of the Fluent primitive (Phase 39's `button.styles.ts` pattern) | Keeps the override isolated, testable, and consistent with the already-established Phase 39 convention |

**Key insight:** Every composite in this phase already has a Fluent v9 primitive covering the hard interaction/accessibility logic (except Tabs' panel, which is explicitly "compose Fluent primitives + thin custom glue," not "build from scratch"). The only genuinely hand-rolled code should be: prop/event-shape translation shims, `data-slot`/`data-state` re-emission, and the `cloneElement`-based `asChild` shim — all thin adapter glue, never reimplementations of Fluent's own interaction logic.

## Common Pitfalls

### Pitfall 1: Tabs' Playwright E2E suite has hard-coded `data-state` assertions that WILL break (confirmed this session, elevates Pitfall 6 from theoretical to concrete for COMP-05a)

**What goes wrong:** `frontend/e2e/conference.spec.ts` (lines 28, 72, 77, 78, 83, 84) asserts `await expect(conferenceTab).toHaveAttribute("data-state", "active")` / `"inactive"` directly on `page.getByRole("tab", ...)` elements. `frontend/e2e/admin-dry-run.spec.ts:299` and `admin-skill-editor.spec.ts:103,337` assert on `page.locator("[role='tabpanel'][data-state='active']")`. Fluent's `Tab` uses `aria-selected`, not `data-state`, and Fluent ships no panel element at all (Pattern 3 above) — a naive migration that doesn't re-emit `data-state` will fail all 8 of these E2E assertions immediately.

**Why it happens:** These specs were written against Radix's `data-state` convention, which is idiomatic to Radix but has zero Fluent equivalent.

**How to avoid:** Before starting COMP-05a (Tabs), decide explicitly (matching Phase 39's Checkbox precedent, FEATURES.md's own recommended tradeoff): have the hand-built `TabsTrigger`/`TabsContent` wrapper manually set `data-state={selected ? "active" : "inactive"}` alongside the real `aria-selected`, so all 8 existing E2E assertions pass completely unmodified. This is strictly cheaper than rewriting 3 E2E spec files and is consistent with the technical-debt tradeoff already accepted project-wide for Checkbox.

**Warning signs:** Any Playwright run showing `admin-dry-run`, `admin-skill-editor`, or `conference` specs newly failing after a Tabs commit that "looked done" because unit tests passed.

### Pitfall 2: DropdownMenu already has a test file — treat COMP-04 as expand-and-un-exclude, not write-from-zero

**What goes wrong:** Following the milestone-wide research docs (`FEATURES.md`/`REQUIREMENTS.md`) literally as "write dropdown-menu.test.tsx from scratch" risks either (a) accidentally deleting/overwriting the 7 existing passing tests in `dropdown-menu.test.tsx`, or (b) creating a second, redundantly-named test file, both of which create merge/duplication confusion.

**Why it happens:** The milestone-wide `FEATURES.md`/`REQUIREMENTS.md` research (written before this phase's own direct file reads) states "no dedicated coverage today (excluded from vitest coverage)" — technically true only in the sense that the file is listed in `vitest.config.ts`'s `coverage.exclude`, not that the file doesn't exist.

**How to avoid:** Read `frontend/src/components/ui/dropdown-menu.test.tsx` (7 existing tests: trigger render, click-to-open, label+separator, shortcut text, group, checkbox item, `data-slot` on trigger) before starting COMP-04. Extend this file in place with new ARIA-based assertions (`role="menu"`, `role="menuitem"`, `aria-expanded` on trigger, keyboard nav per Pitfall 12 below), then remove `"src/components/ui/dropdown-menu.tsx"` from `vitest.config.ts`'s `coverage.exclude` array as a **separate, sequenced step** (per Pitfall 3 below), not bundled into the same commit as the Radix→Fluent implementation swap if avoidable.

**Same applies to Sheet, Tooltip, Card** — `sheet.test.tsx` (4 tests), `tooltip.test.tsx` (2 tests), `card.test.tsx` (7 tests) all already exist and should be extended, not replaced. Only `select.tsx`, `form.tsx`, and `tabs.tsx` have zero existing test file (confirmed via direct `ls`/read this session) and genuinely need net-new test files.

### Pitfall 3: Coverage threshold math breaks when Select/DropdownMenu/Form move from excluded to included (Pitfall 17, PITFALLS.md)

**What goes wrong:** `frontend/vitest.config.ts` (read directly, lines 26-53) currently has:
```ts
exclude: [
  // ...
  "src/components/ui/dropdown-menu.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/form.tsx",
],
thresholds: { statements: 71, branches: 82, functions: 70, lines: 71 },
```
Removing all three exclusions in one commit changes the coverage denominator all at once — even well-tested new code can transiently drop the measured percentage below threshold on a commit that is a net improvement, and it becomes hard to tell which of the three components' tests are "thin" if they're all changed together.

**Why it happens:** `all: false` in the vitest coverage config (confirmed, line 30) means only files that are actually imported by a running test get counted — un-excluding a file with genuinely inadequate tests can dilute the aggregate even while adding real, correct tests.

**How to avoid:** Sequence as: write thorough tests for ONE of {select, dropdown-menu, form} → remove only that one file's exclusion → run `npm run test -- --coverage` locally → confirm thresholds still pass → commit → repeat for the next. Keep the "un-exclude from coverage" diff separable from the "Radix→Fluent implementation swap" diff for that same component where practical (two commits per component is acceptable here, unlike other components, specifically because of this threshold-math risk).

**Warning signs:** CI failing a coverage-threshold gate on a commit that added genuinely good new tests — check `git diff` on `vitest.config.ts`'s `exclude` array as the first thing to inspect, not the new test file's quality.

### Pitfall 4: `OverlayDrawer`'s controlled-only behavior — confirmed zero risk this session, but must still be the explicit precondition check

**What goes wrong (mitigated, documented for completeness):** Fluent's `OverlayDrawer` deprecates `defaultOpen` with no effect. A grep across the entire `frontend/src` tree for `defaultOpen` (run this session) returned **zero results** — no Sheet (or any other) call site relies on uncontrolled `defaultOpen`. This risk is fully cleared for COMP-02; no code changes needed for this specific concern, but re-run the grep as the first step of COMP-02's work as a matter of discipline (in case something changes between research and execution), not because a positive finding is expected.

**Verification command used:**
```bash
grep -rn "defaultOpen" frontend/src --include="*.tsx" --include="*.ts"
# (no output)
```

### Pitfall 5: `asChild` shim reuse — 40 call sites across Tooltip/DropdownMenu/Sheet/Button triggers, all consuming the Phase 39 pattern

**What goes wrong:** Confirmed via grep (this session) that `asChild` appears at ~40 call sites across the codebase, concentrated on `<TooltipTrigger asChild>` (≈20 sites: `topic-guide.tsx`, `transcription-panel.tsx`, `hcp-table.tsx` x3, `cu-status-section.tsx` x3, `persona-table.tsx` x2, `chat-input.tsx` x2, `right-panel.tsx` x2, `left-panel.tsx` x2, `voice-controls.tsx` x3, `mode-selector.tsx` x2, `admin-layout.tsx`, `dry-run-button.tsx`, `persona-editor.tsx` x2, `skill-foundry-status-section.tsx`, `persona-agent-status-section.tsx`, `agent-status-section.tsx`), `<DropdownMenuTrigger asChild>` (≈9 sites: `persona-knowledge-section.tsx`, `scenario-table.tsx`, `knowledge-tab.tsx`, `skill-card.tsx`, `theme-picker.tsx`, `language-switcher.tsx`, `user-layout.tsx`, `admin-layout.tsx`, `voice-session-header.tsx`, `persona-switcher.tsx`, `users.tsx`), `<SheetTrigger asChild>` (1 site: `avatar-page.tsx:438`), and `<Button asChild>` (1 site: `not-found.tsx:19`). Each of these composite components' own `Trigger` sub-component must implement the exact same `isSingleRefCapableElement`-guarded `cloneElement` shim pattern Button established in Phase 39 (`button.tsx` lines 54-102), not a fresh reimplementation — inconsistent shim behavior across triggers is a real risk if each composite's author reinvents it independently.

**How to avoid:** Extract or explicitly copy Button's `isSingleRefCapableElement()` guard function (rejects non-elements AND `React.Fragment`) verbatim into each new Trigger adapter that needs `asChild` (DialogTrigger, SheetTrigger, DropdownMenuTrigger; Tooltip's implicit-children pattern doesn't need this since it has no separate exported Trigger). Consider whether this warrants extraction into a small shared `frontend/src/components/ui/_asChild-shim.ts` utility rather than 3-4 near-duplicate copies — this is a Claude's-discretion call for the planner, not a locked decision, but duplication risk should be flagged.

**Verification command used:**
```bash
grep -rn "asChild" frontend/src --include="*.tsx" --include="*.ts" | grep -v "\.test\."
# ~48 lines matched across dialog/select internal usage, comments, and the ~40 consumer call sites listed above
```

### Pitfall 6: Nested/duplicate `FluentProvider` in portals — first-time risk for Dialog (COMP-01), pattern reused by every subsequent overlay

**What goes wrong:** If Dialog's `DialogSurface` (or Sheet's `OverlayDrawer`, Select/DropdownMenu's popovers, Tooltip's positioned surface) doesn't correctly inherit the outer `FluentProvider`'s active theme when portaled to `document.body`, overlays render with Microsoft's default blue brand instead of the app's selected accent — visible only inside dialogs/menus/tooltips, easy to miss in a quick manual check of the main page.

**How to avoid:** Confirm `FluentProvider`'s `applyStylesToPortals` behavior (default is generally correct, but verify explicitly) on Dialog first, since every subsequent portal-based composite (Sheet, Select, DropdownMenu, Tooltip) inherits whatever pattern is established here. Do this as an explicit checklist item on COMP-01's own commit, not assumed.

### Pitfall 7: Playwright ARIA-selector drift even when semantics are "correct" — run the FULL existing E2E suite per component commit, not just new specs

**What goes wrong:** A component with genuinely correct post-migration ARIA semantics can still break a Playwright selector if the accessible-name computation changes or an extra wrapping role-adjacent ancestor changes a chained `page.getByRole(...).getByRole(...)` match count.

**How to avoid:** Each of the 7 migrated composites' commit should include a run of the *existing, unmodified* Playwright suite (or at minimum the subset of specs that touch that component — grep e2e/ for the component's consumer pages first) as the actual regression signal, per Pitfall 18 in the milestone-wide PITFALLS.md. For Tabs specifically, this means `conference.spec.ts`, `admin-dry-run.spec.ts`, `admin-skill-editor.spec.ts` at minimum (all three confirmed to reference tab/tabpanel state this session).

## Code Examples

### `data-slot` values to preserve exactly (confirmed via direct source reads this session)

| Component | Current exports (confirmed) | `data-slot` values (confirmed) |
|---|---|---|
| Dialog | `Dialog`, `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogTrigger` (9 named + implicit root = matches COMP-01's "9 named exports") | `dialog`, `dialog-trigger`, `dialog-portal`, `dialog-close`, `dialog-overlay`, `dialog-content`, `dialog-header`, `dialog-footer`, `dialog-title`, `dialog-description` |
| Sheet | `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` (8 exports — note: unlike Dialog, `SheetOverlay`/`SheetPortal` are NOT exported, internal-only) | `sheet-header` (confirmed via `sheet.test.tsx:29`), `sheet-footer` (confirmed via `sheet.test.tsx:38`), plus implied `sheet`/`sheet-content`/etc. matching Dialog's naming convention |
| Select | `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue` (10 exports) | not yet asserted in any test (none exists) — new `select.test.tsx` should assert whatever the adapter emits |
| DropdownMenu | `DropdownMenu`, `DropdownMenuPortal`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` (15 exports) | `dropdown-menu-trigger` confirmed via existing test (`dropdown-menu.test.tsx:130`) |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (4 exports) — **no `data-slot` attributes exist in the current implementation at all** (confirmed via direct read of `tabs.tsx`, full 54 lines — pure Radix `data-[state=...]` Tailwind styling, zero `data-slot`) | N/A today — if the adapter introduces `data-slot`, it's a net addition, not a preservation requirement; but `data-state` MUST be preserved (Pitfall 1) |
| Tooltip | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` (4 exports) | `tooltip-provider`, `tooltip`, `tooltip-trigger`, `tooltip-content` (all confirmed via direct read, `tooltip.tsx` lines 12/24/32/44) |
| Card | `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent` (7 exports) | `card`, `card-header`, `card-title`, `card-description`, `card-action`, `card-content`, `card-footer` (all confirmed via direct read, `card.tsx`) |
| Form | `useFormField`, `Form`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `FormField` (8 exports) | `form-item`, `form-label`, `form-control`, `form-description`, `form-message` (all confirmed via direct read, `form.tsx`) |

### Sheet's confirmed `side` prop shape and the single `side="bottom"` call site

```tsx
// frontend/src/components/ui/sheet.tsx (current, confirmed):
// side: "top" | "right" | "bottom" | "left", default "right"

// frontend/src/pages/avatar-page.tsx:438-449 (confirmed via direct read this session):
<Sheet>
  <SheetTrigger asChild>
    <button className="fixed bottom-24 right-4 z-30 ...">
      {t("sourcesPanel.title")} ({citations.length})
    </button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[70vh] overflow-hidden">
    <SourcesPanel status={displaySourcesStatus} citations={citations} />
  </SheetContent>
</Sheet>
```
Maps directly to Fluent `OverlayDrawer position="bottom"` — no degradation needed (verified against shipped `.d.ts`: `position?: 'start' | 'end' | 'bottom'`). This is the ONLY `side="bottom"` usage in the codebase and the ONLY non-default `side` value used anywhere (grep for `side="` on Sheet/SheetContent found no `side="top"` usage, consistent with prior research).

### DropdownMenuTrigger uses explicit `React.forwardRef` (unlike sibling exports)

```tsx
// frontend/src/components/ui/dropdown-menu.tsx (confirmed via direct read):
// DropdownMenuTrigger is the ONLY export in this file using React.forwardRef explicitly;
// all other 14 exports are plain function components. This detail matters for the
// asChild/cloneElement shim design — the ref-forwarding contract must be preserved
// exactly, since theme-picker.tsx, language-switcher.tsx, persona-switcher.tsx,
// user-layout.tsx, admin-layout.tsx, voice-session-header.tsx, users.tsx,
// scenario-table.tsx, skill-card.tsx, knowledge-tab.tsx, persona-knowledge-section.tsx
// (11 confirmed call sites) all rely on <DropdownMenuTrigger asChild> wrapping a
// ref-capable child (mostly <Button>).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Radix `data-state="open"/"closed"/"active"/"inactive"` attribute-driven visibility/state | Fluent: mount/unmount + `aria-*` attributes (`aria-expanded`, `aria-selected`, `aria-checked`) | This phase | Every composite must decide per-component whether to re-emit `data-state` for test-compat (cheap) or migrate assertions to ARIA (more idiomatic) — see Pitfall 1/2 above for concrete per-component guidance |
| Radix `Slot`/`asChild` polymorphism | No Fluent equivalent — `cloneElement` shim (established Phase 39, reused Phase 40) | Phase 39 (established), Phase 40 (reused) | ~40 call sites across Tooltip/DropdownMenu/Sheet triggers depend on this shim being consistently implemented |
| Single-value Select (`value`/`onValueChange(string)`) | Fluent Dropdown's array-based `selectedOptions` + display-text `value` + `onOptionSelect` triple | This phase (COMP-03) | Largest API-shape delta in the whole 21-component migration; requires internal state translation, not a prop rename |
| Radix Tabs root holding shared `value`/`onValueChange` for both list+panels | Fluent's `selectedValue`/`onTabSelect` live only on `TabList`; no panel primitive exists at all | This phase (COMP-05a) | `Tabs`/`TabsContent` become hand-built Context-based glue, not direct 1:1 adapters |

**Deprecated/outdated:** None — this is a first-time migration of these specific components, not a deprecation of a previously-migrated approach.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Card (COMP-06) should default to Option B (plain divs + Griffel token colors) rather than adopting real Fluent Card | Architecture Patterns / Summary | If Foundry-portal visual parity genuinely requires Fluent Card's elevation/selection behavior, Option A would need to be revisited — low cost either way per prior research's own framing, but this recommendation is not empirically re-verified against a live Foundry-portal screenshot comparison in this research session |
| A2 | Extracting a shared `_asChild-shim.ts` utility (vs. duplicating Button's `isSingleRefCapableElement` per-component) is left to planner/executor discretion | Common Pitfalls, Pitfall 5 | If left unaddressed, 3-4 near-duplicate shim implementations could drift subtly out of sync over time; low risk short-term |
| A3 | Re-emitting `data-state` on Tabs (rather than rewriting the 8 E2E assertions to ARIA) is the recommended approach, mirroring the Checkbox precedent | Common Pitfalls, Pitfall 1 | This is a genuine tradeoff, not a fact — rewriting to `aria-selected` is arguably more idiomatic long-term; both are valid, and the "recommended" framing here is this researcher's judgment call extending Phase 39's established precedent, not a locked technical fact |

## Open Questions

1. **Should the Select/DropdownMenu/Form "un-exclude from coverage.exclude" step be its own separate commit per component, or bundled with that component's implementation-swap commit?**
   - What we know: Pitfall 3 (coverage threshold math) strongly suggests separating these diffs is safer.
   - What's unclear: Whether CLAUDE.md's "one requirement = one commit" rule technically permits 2 commits for a single COMP-XX requirement (e.g. COMP-03a: Select implementation swap; COMP-03b: remove select.tsx coverage exclusion) or whether both must land in the single mandated commit per requirement.
   - Recommendation: Default to Phase 39's own precedent (39-02-SUMMARY.md explicitly combined a barrel-export fix into the single mandated commit "since tsc -b/build would fail without it — not deferrable to a separate commit") — if removing the coverage exclusion doesn't itself break the build (it doesn't; it's a config-only change), and the threshold check passes with the new tests present, keep it as one commit for simplicity, but verify locally BEFORE committing that thresholds hold.

2. **Does theme-picker.tsx (flagged as DropdownMenu's primary visual-regression risk) have any existing E2E coverage to run as a regression check?**
   - What we know: `theme-picker.tsx` uses `<DropdownMenuTrigger asChild><Button variant="ghost" size="icon">...</Button></DropdownMenuTrigger>` (confirmed via direct read this session) — a nested asChild-on-Button-inside-DropdownMenuTrigger pattern, exactly the composability risk Pitfall 7 (milestone PITFALLS.md) flags.
   - What's unclear: A grep for `theme-picker`/`ThemePicker` in `frontend/e2e/*.ts` returned zero results this session — there does not appear to be a dedicated E2E spec for the theme picker specifically.
   - Recommendation: COMP-04's commit should add a small Playwright check exercising theme-picker.tsx's open→select-accent→close flow if none exists, since this is the specific visual-risk component the milestone-wide research repeatedly flags and there is currently no automated regression net for it at all (E2E or otherwise — no `theme-picker.test.tsx` unit test exists either).

## Environment Availability

No external service/tool dependencies beyond what's already installed and verified in Phase 39 (Node 20+, npm, `@fluentui/react-components`/`@fluentui/react-icons` at the researched versions, Vitest, Playwright). This phase is code/config-only (frontend component internals + one `vitest.config.ts` edit) — skipping detailed environment audit per the skip condition ("purely code/config changes with no external dependencies").

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` (confirmed via direct read this session) — this section is skipped per the researcher's own skip condition.

## Security Domain

`security_enforcement` is not present in `.planning/config.json`'s `workflow` block (absent = enabled per the researcher instructions), but this phase is a pure internal UI-implementation swap (no new data flows, no new external service calls, no new auth surface, no new user-controlled-content rendering paths beyond what already exists). Per the milestone-wide PITFALLS.md's own Security Mistakes table: "This is a UI-component-library swap with no new data flows... verify only that no new component introduces `dangerouslySetInnerHTML`-equivalent unsafe rendering where the old Radix component didn't." Spot-check applies specifically to: Tooltip's `content` slot (renders arbitrary children, same as Radix's current `TooltipContent` children — no behavior change), and DropdownMenu items rendering user-controlled text (e.g. persona names in `persona-switcher.tsx`) — confirm the Fluent-backed `MenuItem` doesn't introduce any new raw-HTML rendering path where the current Radix `DropdownMenuItem` (plain children) didn't. No ASVS category is newly triggered by this phase; existing auth/CORS/JWT posture from prior milestones is unaffected.

## Sources

### Primary (HIGH confidence — direct codebase reads and greps performed in this session)
- `frontend/src/components/ui/dialog.tsx` (134 lines, full read) — 9 exports, data-slot values, DialogContent's internal Portal>Overlay+Content structure
- `frontend/src/components/ui/sheet.tsx` (138 lines, full read) — 8 exports, `side` prop shape, per-side Tailwind classes
- `frontend/src/components/ui/select.tsx` (188 lines, full read) — 10 exports, `size` prop, `position="popper"` default
- `frontend/src/components/ui/dropdown-menu.tsx` (259 lines, full read) — 15 exports, explicit `forwardRef` on Trigger only, `inset`/`variant` props
- `frontend/src/components/ui/tabs.tsx` (54 lines, full read) — 4 exports, zero `data-slot` attributes, pure Radix `data-[state=...]` styling
- `frontend/src/components/ui/tooltip.tsx` (60 lines, full read) — 4 exports, `data-slot` values, `sideOffset`/`Arrow` usage
- `frontend/src/components/ui/card.tsx` (93 lines, full read) — 7 exports, zero Radix dependency, all data-slot values
- `frontend/src/components/ui/form.tsx` (167 lines, full read) — 8 exports, `FormControl`'s `Slot` usage from `@radix-ui/react-slot` confirmed
- `frontend/src/components/ui/scroll-area.tsx` (47 lines, full read) — confirmed unchanged Radix implementation, COMP-08 no-op
- `frontend/src/components/ui/index.ts` (93 lines, full read) — confirmed full current barrel export list for all 9 composites
- `frontend/src/components/ui/dropdown-menu.test.tsx` (135 lines, full read) — confirmed 7 existing tests, corrects milestone research's "zero coverage" claim
- `frontend/src/components/ui/sheet.test.tsx`, `tooltip.test.tsx`, `card.test.tsx` (full reads) — confirmed existing test counts (4/2/7 respectively)
- `frontend/vitest.config.ts` (56 lines, full read) — confirmed exact `coverage.exclude` list (`dropdown-menu.tsx`, `select.tsx`, `form.tsx`) and thresholds (71/82/70/71)
- `frontend/package.json` grep — confirmed `@fluentui/react-components@^9.74.4`, `@fluentui/react-icons@^2.0.334` installed
- `frontend/src/pages/avatar-page.tsx` lines 438-450 (direct read this session) — confirmed exact `SheetContent side="bottom"` call site
- `frontend/src/components/shared/theme-picker.tsx` lines 1-40 (direct read this session) — confirmed `DropdownMenuTrigger asChild` wraps `<Button variant="ghost" size="icon">`
- Repo-wide grep for `asChild` (48 matches) and `defaultOpen` (0 matches) across `frontend/src`
- Repo-wide grep for `data-state` across `frontend/src/components/ui/*.test.tsx` and `frontend/e2e/*.ts` — confirmed checkbox.test.tsx (2 known lines) PLUS 8 new confirmed E2E assertions in `conference.spec.ts`/`admin-dry-run.spec.ts`/`admin-skill-editor.spec.ts` (Tabs-related, new finding this session)
- `.planning/phases/39-fluent-infrastructure-leaf-components/39-02-SUMMARY.md`, `39-05-SUMMARY.md` (full reads) — confirmed Phase 39's actual-implemented patterns (Griffel `*.styles.ts` file convention, `cloneElement`/`isSingleRefCapableElement` shim, CSSOM-based test assertions, bidirectional vocabulary shim pattern)
- `frontend/src/components/ui/button.tsx` lines 40-110 (direct read this session) — confirmed exact `isSingleRefCapableElement`/`cloneElement` shim implementation to replicate
- `.planning/config.json` (full read) — confirmed `nyquist_validation: false`, no `security_enforcement` key
- `node .../gsd-tools.cjs init phase-op 40` — confirmed `phase_dir`, `has_context: false`, `commit_docs: true`

### Secondary (HIGH confidence — prior milestone-wide research, verified against `.d.ts`/source per its own sourcing, cross-checked against current codebase this session)
- `.planning/research/FEATURES.md` — per-component Radix→Fluent v9 API diff table (C1-C8b), verified against `@fluentui/react-components` published `.d.ts` files
- `.planning/research/PITFALLS.md` — 21 pitfalls with phase-mapping; Pitfalls 6, 7, 11, 12, 14, 15, 16, 17, 18 directly apply to Phase 40
- `.planning/research/ARCHITECTURE.md` — FluentProvider placement, theme bridge (confirmed actual path `frontend/src/styles/fluent-theme.ts`, mounted via `frontend/src/components/providers/fluent-theme-bridge.tsx`, imported in `App.tsx` — corrects the task's originally-stated `frontend/src/lib/fluent-theme.ts` path)
- `.planning/research/STACK.md` — exact package versions, cross-verified against installed `package.json` this session (match confirmed)
- `.planning/REQUIREMENTS.md` — COMP-01..08 requirement text and traceability
- `.planning/ROADMAP.md` — Phase 40 goal/success-criteria/dependency confirmation (read in prior session turn)
- `.planning/STATE.md` — Phase 39 completion status and decision history (read in prior session turn)
- `.planning/phases/39-fluent-infrastructure-leaf-components/39-CONTEXT.md` — Phase 39 scope boundary and canonical references

### Tertiary (none — no unverified WebSearch-only claims used in this document; all claims trace to either direct codebase reads or the prior HIGH-confidence milestone research docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages already installed, versions confirmed against actual `package.json`
- Architecture (per-component mapping): HIGH — sourced from FEATURES.md's `.d.ts`-verified mappings, cross-checked against actual current Radix source this session
- Pitfalls: HIGH for the two new findings this session (Tabs E2E `data-state` breakage, DropdownMenu's existing-but-excluded test file) since both are direct grep/read evidence, not inference; HIGH for the 9 inherited pitfalls from milestone-wide PITFALLS.md per that document's own sourcing
- Card (COMP-06) recommendation: MEDIUM — a judgment call (Option B default), not an empirically-forced conclusion; flagged as Assumption A1

**Research date:** 2026-08-06
**Valid until:** Estimate 14 days — Fluent UI v9 minor versions ship somewhat frequently and Phase 40 execution is expected to begin promptly following Phase 39's just-completed state; re-verify `@fluentui/react-components` version currency if execution is delayed materially beyond that window.
