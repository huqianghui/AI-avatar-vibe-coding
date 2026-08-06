# Project Research Summary

**Project:** AI Avatar Platform — v3.0 Fluent UI v9 Migration
**Domain:** UI component library adapter-mode migration (shadcn/Radix+Tailwind to @fluentui/react-components v9), aligning frontend visual language with the Azure AI Foundry portal
**Researched:** 2026-08-06
**Confidence:** HIGH

## Executive Summary

This is a technical migration, not a greenfield feature build: swap the internal implementation of 21 `@/components/ui/*` exports from Radix primitives + cva/Tailwind variants to `@fluentui/react-components` v9 (Fluent 2), while keeping every one of the 126 consumer files compiling unchanged. Experts approach this class of migration as an adapter layer: the public import surface and prop contracts stay stable while internals are rewritten one component at a time, each its own commit, so the change is bisectable and rollback-safe until the final irreversible dependency-removal phase. The installation footprint is minimal (2 npm packages: `@fluentui/react-components` + `@fluentui/react-icons`; Griffel and `@fluentui/react-theme` come transitively and should never be installed directly), no React version change is required, and Fluent v9 is fully typed and Vite-compatible with one recommended `optimizeDeps.include` tweak for dev-server cold-start.

The recommended approach is: land infra first (theme bridge with 10 pre-generated Theme objects, and a deterministic Griffel/Tailwind style-order contract via an explicit insertionPoint anchor + RendererProvider, wired before any Fluent component renders); migrate the 12 leaf components to establish the adapter pattern (data-slot preservation, mergeClasses internals, cloneElement shim for asChild); migrate the 9 composites (C1-C8, minus scroll-area which is explicitly excluded), sequencing the two highest-risk/zero-test-coverage components (Select, DropdownMenu) with dedicated time budget; swap icons and toast, both independent of the composite work and gated by their own empirical spikes; only after all of A-E are verified, run the irreversible Radix/lucide/sonner dependency removal.

The dominant risk across all four research files is not any single component's API delta, it's the structural risk that Griffel and Tailwind both emit equal-specificity atomic CSS, so whichever stylesheet lands later in `<head>` wins ties, and without an explicit anchor this order is non-deterministic across dev/prod/reloads. This is fully solved by an insertionPoint anchor placed before Tailwind's injected stylesheet, verified against the built dist/index.html, not just dev mode. The second-tier risk is concentrated in exactly two composites, Select (C3) and DropdownMenu (C4), which combine the largest Radix-to-Fluent API-shape deltas with zero pre-existing test coverage. Three specific behaviors could not be resolved by desk research and need one-time empirical spikes before their respective phases proceed: whether Fluent's toastId truly survives into dispatchToast (blocks Phase 41/E rollout), the exact default-sizing behavior of individually-imported Fluent icons (blocks Phase 41/D batch rollout), and confirmation that React 18 StrictMode's double-render doesn't destabilize the Griffel renderer (a Phase 39/A code-review gate, not a blocking spike). One meaningful correction surfaced by this research: the migration plan's assumption that Fluent's OverlayDrawer has no bottom-position support is wrong, position="bottom" is supported (verified against the shipped .d.ts), so the single avatar-page.tsx side="bottom" call site is not a blocker.

## Key Findings

### Recommended Stack

Only two direct npm installs are needed: `@fluentui/react-components@^9.74.4` (the umbrella package re-exporting ~50 sub-packages plus Griffel's styling APIs and theme creators) and `@fluentui/react-icons@^2.0.334` (named per-icon exports, tree-shakes cleanly). Both are verified React-18-compatible (peerDependencies: react >=16.14.0 <20.0.0), no React upgrade is needed or warranted for this milestone. Griffel and `@fluentui/react-theme` ship transitively and must never be added directly to package.json, both are fully re-exported from the umbrella package, and Griffel's own source uses a global Symbol.for() registry that makes duplicate/mismatched installs a real risk class. The one Vite-specific config change recommended is adding `optimizeDeps.include: ["@fluentui/react-components", "@fluentui/react-icons"]` to avoid a slow/flaky dev-server cold start.

**Core technologies:**
- `@fluentui/react-components` (9.74.4): Fluent 2 component library, single install for ~50 sub-packages — chosen because Foundry-portal visual parity requires Fluent 2 specifically, not v8/"Northstar"
- `@fluentui/react-icons` (2.0.334): Fluent System Icons, named SVG imports — tree-shakes correctly only via named imports; wildcard imports are an easy-to-introduce bundle-bloat trap
- `createLightTheme`/`createDarkTheme`/`BrandVariants` (re-exported, not installed separately): generates 10 pre-generated theme objects (5 accents x light/dark) from offline-authored 16-stop color ramps — chosen over runtime ramp generation since no ramp-generator ships in the runtime package

### Expected Features (= Component Migration Landscape)

This milestone is a component-mapping deliverable, not a market feature set. The "features" are contractual guarantees that must survive the swap.

**Must have (table stakes, non-negotiable):**
- All 21 exports keep identical name + props signature (126 consumer files must compile unchanged)
- `data-slot="xxx"` preserved on every component (~39 test assertions key off it)
- `asChild` behavior preserved via a cloneElement shim (Fluent has no Slot concept) — 33 files depend on this
- Checkbox/Switch `onCheckedChange(boolean)` call-site contract preserved despite Fluent's `onChange(ev, data)` signature (Fluent's tri-state value is the string "mixed", not "indeterminate" — a documented footgun)
- `toast.loading()`/`toast.dismiss(id)` lifecycle (one real call site, avatar-page.tsx:224-243) — handled via a pub/sub bridge decoupling non-component callers from Fluent's hook-bound dispatchToast
- Radix `data-state` test assertions — Fluent emits no equivalent attribute; must be rewritten to ARIA per component, or the adapter must re-emit data-state manually where cheaper than rewriting tests

**Should have (value of migration):**
- Visual parity with Azure AI Foundry portal (the actual business driver)
- Griffel makeStyles/theme-token-driven variants replacing ad-hoc Tailwind variant strings
- Native WAI-ARIA authoring-practice compliance as a side benefit of Fluent's composite components

**Defer / explicitly excluded:**
- `scroll-area` migration — user-decided exception (2026-08-05), stays on Radix permanently
- Full `Field` component adoption for forms — narrowly scoped to swapping only FormLabel's internal Label
- Auto-scripted icon mapping — explicitly rejected; all 84 lucide-to-Fluent icon mappings must be manually reviewed

### Architecture Approach

The integration is a set of small, isolated infrastructure additions layered above the existing app shell, not a restructuring of it. FluentProvider becomes the outermost visual/innermost logical wrapper inside the existing provider tree (inside QueryClientProvider, above RouterProvider), rendered with `className="contents"` + transparent background so it never competes with body's Tailwind-owned background or introduces an extra box into layout-sensitive pages. A parallel, independent theming system (FluentThemeBridge, a read-only subscriber to the existing useThemeStore()) translates the current `.dark`/`.theme-{accent}` class mechanism into one of 10 offline-pre-generated Fluent Theme objects — theme-store.ts itself requires zero changes. The single most consequential architectural decision is the explicit insertionPoint anchor combined with a module-scope (never component-body) createDOMRenderer/RendererProvider pair — this makes Tailwind deterministically win cascade ties over Griffel for the entire multi-phase coexistence period. Two new subsystems round out the infra: an icon adapter (84 lucide-named wrappers around Fluent icons that strip Fluent's default fontSize so Tailwind size-* utilities keep controlling rendered size) and a toast bridge (a pub/sub bus that decouples the 46 non-component call sites of toast.xxx() from Fluent's hook-bound useToastController).

**Major components:**
1. Theme bridge (`fluent-theme.ts` + `fluent-theme-bridge.tsx`) — generates/caches 10 Theme objects, subscribes to existing theme store, feeds FluentProvider
2. Griffel/Tailwind insertion-order contract (index.html anchor + module-scope renderer) — the deterministic cascade-tie-break mechanism every other phase depends on
3. Adapter layer (`components/ui/*.tsx`, 21 components) — internal Griffel makeStyles/mergeClasses, data-slot preserved, cloneElement shim for asChild, consumer className always merged last
4. Icon adapter (`components/icons/`) — 84 lucide-compatible named exports wrapping Fluent icons
5. Toast bridge (`lib/toast/`) — pub/sub decoupling for the global toast.xxx() singleton API

### Critical Pitfalls

1. **Griffel/Tailwind style-order inversion** — without an explicit insertionPoint, Griffel appends styles at mount time, making cascade-tie winner non-deterministic across dev/prod/reloads (silent color/override bugs). Avoid via the module-scope insertionPoint anchor, verified as a repeatable build-check against the built dist/index.html.
2. **Fluent icon fontSize silently defeats Tailwind size-* sizing** — a no-compile-error, potentially all-84-icons-at-once visual regression. Avoid by spiking 3-5 representative icons at multiple size-* values before any directory-batch rollout begins (hard entry gate).
3. **FluentProvider paints over body's Tailwind background / breaks grid layouts** — avoid with `className="contents"` + transparent background, verified against avatar-page.tsx's CSS-grid layout.
4. **Toast loading()/dismiss(id) lifecycle silently breaks** two ways: toastId may not actually survive into dispatchToast (needs a live check before the 46-file rollout), and `vi.mock("sonner")` migrations can silently stop intercepting if not verified per-file.
5. **Select (C3) and DropdownMenu (C4) carry compounded risk** — largest Radix-to-Fluent API-shape deltas AND zero pre-existing test coverage; tests must be written fresh against Fluent's ARIA semantics.
6. **`data-state` blast radius extends well beyond the 2 known checkbox.test.tsx lines** — Dialog, Sheet, DropdownMenu, Tabs, and Tooltip all emit data-state today with no dedicated test file to flag the risk; a per-component grep is required before each composite's migration.

## Implications for Roadmap

This milestone already has an externally-fixed phase numbering (39-42) and internal Plan A-F structure agreed in `.planning/PROJECT.md` and the migration plan doc; research confirms this structure is sound and adds sequencing/gating detail within it.

### Phase 39: Infra (Plan A) + Leaf Components (Plan B)
**Rationale:** Nothing else can render correctly without the theme bridge and the deterministic Griffel/Tailwind insertion-order contract landing first. Leaf components then establish the adapter pattern (data-slot preservation, mergeClasses, cloneElement shim) that every composite in Phase 40 will reuse.
**Delivers:** Working FluentProvider + theme bridge with zero visual change; 12 leaf components migrated, each its own commit.
**Addresses:** All "table stakes" contractual guarantees (data-slot, asChild, event-signature shims) at the component granularity where they're cheapest to get right.
**Avoids:** Pitfalls 1 (insertion order), 1b (StrictMode double-render), 3 (FluentProvider background bleed), 5 (Checkbox/Switch signature drop), 13 (ProgressBar 0-1 vs 0-100 scale), 16 (asChild shim edge cases), 20 (Input/Textarea ref-target change), 21 (Avatar broken-image fallback).

### Phase 40: Composite Components (Plan C, C1-C8)
**Rationale:** Composites depend on Phase 39's Griffel pattern and adapter conventions being established, but are independent of icon/toast work. Select (C3) and DropdownMenu (C4) should be treated as separate, budget-extended sub-phases given their compounded API-delta + zero-coverage risk.
**Delivers:** Dialog, Sheet, Select, DropdownMenu, Tabs, Tooltip, Card (decision point: real Fluent Card vs. plain divs), Form (narrow Label-only swap) — scroll-area explicitly excluded, stays on Radix.
**Addresses:** All composite-level contractual guarantees (data-state-to-ARIA rewrites, OverlayDrawer controlled-only migration, Tooltip's required relationship prop default, DropdownMenu's list-level state lifting).
**Avoids:** Pitfalls 6 (data-state blast radius), 7 mode 1 (coexistence composability regressions, esp. Tooltip+Button+MenuTrigger), 11 (nested FluentProvider in portals), 12 (focus/keyboard regressions), 14 (OverlayDrawer defaultOpen no-op), 15 (Tooltip relationship footgun), 17 (coverage-threshold math on exclusion removal), 18 (Playwright ARIA-selector drift).

### Phase 41: Icons (Plan D) + Toast (Plan E)
**Rationale:** Both depend only on Phase 39's FluentProvider tree existing — neither depends on Phase 40's composites, and D/E can run in either order relative to each other. Each has exactly one empirical spike that is a hard entry gate: icon fontSize-strip behavior (D) and toastId survival into dispatchToast (E).
**Delivers:** 84-icon lucide-compatible adapter, batched by directory (admin, shared, voice, pages); toast pub/sub bridge, batched across 46 call sites.
**Addresses:** Icon/toast ecosystem parity requirements without touching component-level contracts already resolved in 39/40.
**Avoids:** Pitfalls 2 (icon fontSize sizing), 4 (toast lifecycle + silent vi.mock no-op), 8 (filled/regular icon mismatch), 9 (wildcard icon import bundle bloat), 10 (missing 1:1 icon equivalents deferred and forgotten).

### Phase 42: Irreversible Cleanup (Plan F)
**Rationale:** Blocked on ALL of Phases 39-41 being complete and verified — the one phase where the "one component = one commit, revertible" safety net is intentionally given up.
**Delivers:** Zero-hit grep confirmation (re-run immediately before the uninstall commit) for @radix-ui|lucide-react|sonner|vaul (scroll-area's Radix kept); dependency uninstall; brand-ramp visual fine-tuning against Foundry portal screenshots; Lighthouse/a11y audit; coverage-threshold recalibration.
**Uses:** Confirms/finalizes the provisional theme ramps generated in Phase 39 and the incrementally-raised coverage thresholds from Phase 40's exclusion removals.

### Phase Ordering Rationale

- Infra-before-components is a hard dependency (no Fluent token resolves without FluentProvider mounted) — not a stylistic preference.
- Leaf-before-composite is a soft but strong dependency: leaf components establish the adapter conventions that composites reuse.
- Icon/toast (Phase 41) is deliberately decoupled from composites (Phase 40) because neither touches the other's code paths.
- Cleanup (Phase 42) must be strictly last and is the only phase where the migration's own safety net is intentionally suspended.

### Research Flags

Needs deeper research/spikes during planning (empirical, not desk-resolvable):
- **Phase 39 (A):** StrictMode double-render effect on the Griffel renderer — verify via code review discipline (module-scope construction).
- **Phase 40 (C3 Select, C4 DropdownMenu):** No pre-existing test coverage exists for either — budget dedicated time for fresh ARIA-based test-writing.
- **Phase 41 (D):** Fluent icon default fontSize behavior — hard entry-gate spike before any directory batch starts.
- **Phase 41 (E):** toastId round-trip into dispatchToast/dismissToast — hard entry-gate spike before the 46-file call-site migration begins.

Phases/components with well-documented, low-risk patterns (standard adapter work, skip dedicated research-phase):
- **Phase 39 (B):** Button, Input, Label, Textarea, Separator/Divider, Skeleton — low API delta, straightforward prop renames.
- **Phase 40 (C5 Tabs, C6 Tooltip):** Medium complexity but self-contained, well-specified adapter shape already.
- **Phase 40 (C8a Card):** Framed as a build/no-build decision, not a research gap — default to the lower-risk "keep as divs" option.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions, peer-deps, exports, and Griffel injection mechanics verified directly against npm registry tarballs, package.json fields, and .d.ts/source files. One LOW-confidence sub-item: exact current URL of Microsoft's offline Theme Designer tool. |
| Features | HIGH | Fluent v9 API surface verified against published .d.ts/.types.ts source, cross-checked against direct reads of the current 21-component codebase and its test files. |
| Architecture | HIGH for package APIs verified against published type declarations. MEDIUM for the Tailwind+Griffel insertion-order-as-override-control pattern specifically — a reasoned extension, not a copied official guide. |
| Pitfalls | HIGH for mechanics inherited from the other three files' verified findings; MEDIUM for three specific behavioral claims not yet empirically confirmed in this repo's runtime: StrictMode's effect on the Griffel renderer, toastId surviving into dispatchToast, and Fluent icons' exact default fontSize value. All three are explicitly flagged with required spikes and their gating phase. |

**Overall confidence:** HIGH

### Gaps to Address

- Griffel/Tailwind insertion order must be verified against the built artifact, not just dev mode — add a repeatable build-check script. Address in Phase 39's exit criteria.
- toastId survival into dispatchToast — one live throwaway test must run before Phase 41/E's 46-file rollout; if it fails, redesign the bridge with an internal id-mapping layer.
- Fluent icon default fontSize/sizing behavior — one spike rendering 3-5 representative icons at multiple Tailwind size-* values, pixel-diffed against lucide originals, before Phase 41/D's first directory batch.
- data-state full blast radius — not fully enumerable by static analysis; each Phase 40 composite needs its own pre-migration grep before that component's work starts.
- Theme ramp perceptual accuracy — the 10 offline-generated BrandVariants ramps are provisional against a single anchor hex per accent; exact stop-by-stop match to existing index.css CSS variables is not guaranteed and is explicitly deferred to Phase 42's fine-tuning pass.

## Sources

### Primary (HIGH confidence)
- npm registry direct queries + downloaded package tarballs (`@fluentui/react-components@9.74.4`, `@fluentui/react-icons@2.0.334`, `@fluentui/react-theme@9.2.1`, `@griffel/core@1.21.3`, `@griffel/react@1.5.32`) — package.json, .d.ts, and .js source read directly
- `@fluentui/react-components/dist/index.d.ts` and package-level type declarations for Button, Checkbox, Switch, Avatar, Dialog, Drawer, Combobox/Dropdown, Menu, TabList/Tab, Tooltip, Card, Field, ProgressBar, Slider, Spinner, RendererProvider, createDOMRenderer, FluentProviderProps, useToastController/ToastOptions — fetched via jsdelivr/unpkg CDN
- Direct repo reads: `frontend/src/components/ui/*.tsx` (all 21 in-scope components + scroll-area), `frontend/src/components/ui/index.ts`, `frontend/src/components/ui/checkbox.test.tsx`, `frontend/src/App.tsx`, `frontend/src/stores/theme-store.ts`, `frontend/src/styles/index.css`, `frontend/src/lib/utils.ts`, `frontend/index.html`, `frontend/vitest.config.ts`, `frontend/package.json`, `frontend/src/pages/avatar-page.tsx`, `.omc/plans/fluent-ui-migration-plan.md`, `.planning/PROJECT.md`

### Secondary (MEDIUM confidence)
- Griffel insertionPoint/RendererProvider mechanism applied specifically to override Tailwind's cascade — mechanism documented, combination reasoned rather than copied from an official Tailwind+Fluent guide
- Fluent icon default-sizing runtime behavior — prop existence confirmed in .d.ts, exact default value not confirmed against a live runtime (flagged for Phase 41 spike)
- toastId survival into ToastDispatchOptions — confirmed via TypeScript type algebra, not yet confirmed against a live runtime (flagged for Phase 41 spike)

### Tertiary (LOW confidence)
- Bundlephobia API query for @fluentui/react-icons full-import size (~15.5MB raw / ~3.09MB gzip) — single directional data point, rate-limited on further queries, not authoritative for actual tree-shaken output
- Microsoft's offline Fluent "Theme Designer" ramp-generation tool's current URL — could not reach a live current URL in this research session

---
*Research completed: 2026-08-06*
*Ready for roadmap: yes*
