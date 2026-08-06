# Stack Research

**Domain:** Fluent UI v9 (Fluent 2) adapter-mode migration on top of existing React 18 + Vite 6 + Tailwind v4 stack
**Researched:** 2026-08-06
**Confidence:** HIGH (versions/peer-deps/exports verified directly against npm registry tarballs and TypeScript declaration files; Griffel injection-order mechanics verified against `@griffel/core` and `@griffel/react` source code, not just docs)

> **Note:** This replaces the prior (2026-07-31) version of this file, which researched the v2.0 Avatar MVP delta stack (citations, CRM-Excel, es-ES i18n). Those decisions are now shipped/validated — see `.planning/PROJECT.md` — and are out of scope here. This file is the stack research for the **v3.0 Fluent UI v9 migration** milestone only (Phase 39 infrastructure).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@fluentui/react-components` | `9.74.4` (npm `latest` as of 2026-08-06, published 2026-07-15) | Fluent 2 component library — single umbrella package that re-exports ~50 sub-packages (`react-button`, `react-dialog`, `react-select`, `react-provider`, `react-theme`, etc.) plus `@griffel/react` styling APIs (`makeStyles`, `mergeClasses`, `FluentProvider`, `RendererProvider`, `createDOMRenderer`) | This is the only package you need to `npm install` for components — it is a facade over the individually-versioned Fluent v9 packages (accordion 9.12.1, dialog 9.18.2, provider 9.22.18, theme 9.2.1, etc.), so you get one version to track instead of ~50. Verified via `npm view @fluentui/react-components dependencies` — it depends on `@griffel/react": "^1.5.32"` internally (installed transitively; do not add separately unless you need lower-level Griffel APIs — see Supporting Libraries). |
| `@fluentui/react-icons` | `2.0.334` (published 2026-07-24) | Fluent System Icons, one named export per icon (e.g. `ArrowRight24Regular`) | Verified peer dep is `react: >=16.8.0 <20.0.0` (React 18 fully supported). Package itself depends on `@griffel/react: ^1.6.1` (slightly newer range than react-components' internal Griffel — both ranges are satisfied by npm's dedupe within `^1.x`, confirmed no conflict since Griffel 1.x has no breaking changes across 1.5–1.7). `sideEffects` is scoped to only `**/headless/fonts/styles.css` and `**/headless/styles.css` — icon SVG/JSX modules themselves are pure, so named icon imports tree-shake cleanly. |
| `@griffel/react` (transitive, do not pin) | `^1.5.32`–`^1.7.6` range (do not confuse with `@griffel/core@1.21.3` — separate, independently-versioned package) | CSS-in-JS engine Fluent v9 is built on (atomic CSS, `makeStyles`, DOM style injection) | You do NOT install this directly. It ships as a `dependencies` entry (not `peerDependencies`) of both `@fluentui/react-components` and `@fluentui/react-icons`, confirmed via tarball inspection — npm installs and dedupes it automatically. `sideEffects: false`. Only reach for `@griffel/react` directly if you need `RendererProvider`/`createDOMRenderer` for style-order control (see Griffel/Tailwind section below) — but even that doesn't require a separate install, since `@fluentui/react-components` re-exports both. |

**Peer dependency confirmation (verified via `npm view @fluentui/react-components peerDependencies`):**
```
"@types/react": ">=16.14.0 <20.0.0"
"@types/react-dom": ">=16.9.0 <20.0.0"
"react": ">=16.14.0 <20.0.0"
"react-dom": ">=16.14.0 <20.0.0"
```
Your current `react@^18.3.0`, `react-dom@^18.3.0`, `@types/react@^18.3.0`, `@types/react-dom@^18.3.0` all satisfy these ranges — **no React upgrade needed, React 19 is explicitly NOT required** (v9 supports up to but excluding 20).

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fluentui/react-theme` (transitive, not installed directly) | `9.2.1` | Provides `createLightTheme`, `createDarkTheme`, `BrandVariants`, `webLightTheme`, `webDarkTheme`, `teamsLightTheme`, `teamsDarkTheme`, `Theme`, `PartialTheme` types | Fully re-exported by `@fluentui/react-components` (confirmed: `export { createLightTheme }`, `export { createDarkTheme }`, `export { BrandVariants }`, `export { webLightTheme }`, `export { webDarkTheme }` all present in `@fluentui/react-components/dist/index.d.ts`). Import everything from `@fluentui/react-components` directly — do not add `@fluentui/react-theme` as a separate dependency, it adds no value and creates a second version to track. |
| `@fluentui/tokens` (transitive) | `1.0.0-alpha.23` | Low-level design token primitives that `react-theme`'s `createLightTheme`/`createDarkTheme` are built on | Never import directly for this milestone — `createLightTheme`/`BrandVariants` from `@fluentui/react-components` is the correct entry point for generating your 10 pre-generated themes. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| No new dev tool required | Fluent v9 ships fully-typed `.d.ts` files and works with the existing `tsc -b` gate | Confirmed `types` field points to `./dist/index.d.ts` in both `react-components` and `react-icons` package.json. No `@types/*` shim packages needed. |
| Vite `optimizeDeps.include` (config change, not a package) | Pre-bundle Fluent's CJS/ESM dual-package graph in dev to avoid the "hundreds of small ESM module requests" cold-start slowdown | See Vite Config section below — this is a config edit to `vite.config.ts`, not an npm install. |
| `rollup-plugin-visualizer` (optional, one-off) | Bundle-size before/after comparison for the migration plan's Phase D commit note | Only add temporarily for the one analysis commit, then remove — not a permanent devDependency. |

## Installation

```bash
# Core — components + icons only. Griffel and react-theme come transitively.
cd frontend
npm install @fluentui/react-components@^9.74.4 @fluentui/react-icons@^2.0.334
```

No `-D` (devDependency) installs are required. No `@griffel/*` package should be added to `package.json` directly — it is already present in the tree transitively and adding it explicitly risks version drift from what `@fluentui/react-components` expects internally (Griffel's own source comments note its constants use a global `Symbol.for()` registry shared across instances — duplicate/mismatched installs are a documented risk class, not a theoretical one).

## Griffel vs Tailwind: Style Injection Order (verified from source, not just docs)

This is the #1 infrastructure risk flagged for this milestone. Verified mechanics, read directly from the published `@griffel/core` / `@griffel/react` package source (not just narrative docs):

**How Griffel injects styles:**

1. Griffel does NOT inject one big stylesheet. It creates one `<style>` tag per "style bucket" (reset `r`, catch-all `d`, link `l`, visited `v`, focus-within `w`, focus `f`, focus-visible `i`, hover `h`, active `a`, at-rules for reset `s`, keyframes `k`, at-rules `t`, `@media` `m`, `@container` legacy `c` / sorted `x` — 15 fixed buckets, in a hardcoded `styleBucketOrdering` array), and inserts each bucket's `<style>` tag into `<head>` at a position determined by:
   - `insertionPoint` — if provided to `createDOMRenderer(document, { insertionPoint })`, all buckets are anchored relative to that DOM element.
   - Bucket sort order (`styleBucketOrderingMap`) — buckets are inserted in the fixed order above, scanning existing `[data-make-styles-bucket]` elements already in `<head>`, **not** based on when your app code happens to render.
2. Every Griffel class is a single, low-specificity atomic class (one class selector, specificity 0,1,0) — Griffel classes never use nested selectors or `!important`. Tailwind utility classes are also atomic, single-class, unnested, specificity 0,1,0. **Both systems structurally avoid specificity wars by design.**
3. Because both use equal-specificity atomic selectors, **the practical conflict is not "who wins the specificity war" — it is "whichever stylesheet's rule for the same CSS property appears later in `<head>` source order wins"** (standard CSS cascade tie-break when specificity is equal).

**Concrete, actionable control (implement in Phase 39/A):**

```tsx
// src/main.tsx or App.tsx — one renderer instance for the whole app
import { RendererProvider, createDOMRenderer, FluentProvider } from "@fluentui/react-components";

// In index.html, add as the FIRST child of <head>:
//   <div id="fluent-insertion-point" style="display:none"></div>
// This must appear BEFORE Tailwind's injected <style>/<link> (which @tailwindcss/vite
// emits from processing your src/styles/index.css import, later in the head).
const insertionPoint = document.getElementById("fluent-insertion-point");
const renderer = createDOMRenderer(document, { insertionPoint });

<RendererProvider renderer={renderer} targetDocument={document}>
  <FluentProvider theme={theme}>
    <App />
  </FluentProvider>
</RendererProvider>
```

- Anchoring `insertionPoint` as the first element in `<head>` forces all Griffel bucket `<style>` tags to be inserted immediately after it — i.e. as early as possible, **before** Tailwind's stylesheet. That means **Tailwind wins ties by default** (it appears later in source order), matching the migration plan's own decision (`.omc/plans/fluent-ui-migration-plan.md` §2: "consumer `className` (Tailwind) transmits and can override Griffel classes for layout, but not guaranteed for token colors/borders").
- **Always pass an explicit `insertionPoint` — do not rely on the default (`undefined`) behavior.** Without it, Griffel appends bucket stylesheets at the very end of `<head>`, in whatever order components first mount — fragile and inconsistent between dev/prod, and specifically flagged in the migration plan as a StrictMode double-render risk. An explicit anchor makes bucket position deterministic and independent of render timing, removing that risk category entirely.
- `RendererProvider` and `createDOMRenderer` are both re-exported directly from `@fluentui/react-components` (confirmed present in its `.d.ts`) — no separate `@griffel/react` import needed even for this advanced control.
- Secondary levers (`compareMediaQueries`/`compareContainerQueries` on `createDOMRenderer`) only order Griffel's own `@media`/`@container` buckets relative to each other — irrelevant to Tailwind interop, skip for this migration.

**SSR:** Not applicable — this is a Vite SPA (`vite build` → static assets served by nginx per `frontend/Dockerfile`), not an SSR framework. `renderToStyleElements`/`rehydrateRendererCache` (Griffel's SSR APIs, also re-exported by `@fluentui/react-components`) are not needed here.

## FluentProvider + Theme Creation (10 pre-generated themes: 5 accent × light/dark)

All required APIs come from `@fluentui/react-components` directly (verified re-exports — no extra package):

```ts
// src/styles/fluent-theme.ts
import { createLightTheme, createDarkTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

// One BrandVariants (16-step ramp: keys 10..160) per accent, hand-authored to align with
// the existing Tailwind accent CSS custom properties already defined for the 5 accent classes.
const blueBrand: BrandVariants = { 10: "...", 20: "...", /* ...through 160 */ };
// repeat for each of the other 4 accents already defined in theme-store.ts's 5 accent classes

export const fluentThemes: Record<string, { light: Theme; dark: Theme }> = {
  blue: { light: createLightTheme(blueBrand), dark: createDarkTheme(blueBrand) },
  // ...4 more accents = 10 Theme objects total, generated once at module load (not per render)
};

export function getFluentTheme(mode: "light" | "dark", accent: string): Theme {
  return fluentThemes[accent][mode];
}
```

- `webLightTheme` / `webDarkTheme` (also re-exported) are Microsoft's default un-branded Fluent 2 themes — useful only as a sanity-check fallback while wiring up `FluentProvider`, not for the final 10-theme brand matrix (they carry Microsoft's own blue brand, not this project's 5 accents).
- `BrandVariants` is a plain object type with 16 numeric keys (10, 20, ..., 160) — `createLightTheme` and `createDarkTheme` both take the *same* `BrandVariants` object and internally adjust for light vs. dark palettes; you don't need a separate ramp per mode. This matches the migration plan's "theme is a one-way mapping generated offline, written as constants" approach (`.omc/plans/fluent-ui-migration-plan.md` §3).
- Wire `FluentProvider`'s `theme` prop to `useThemeStore()` (existing store, `useSyncExternalStore` over `document.documentElement.classList`) so the existing `.dark` + 5-accent-class mechanism continues to drive which of the 10 pre-generated `Theme` objects is active — no change to the theme store itself, just a new consumer reading from it.

## Bundle-Size Impact

| Package | Tree-shaking mechanism | Verified evidence |
|---------|------------------------|--------------------|
| `@fluentui/react-components` | `"sideEffects": false` at package root + ESM (`module`/`import` condition → `lib/index.js`) + named exports per component | Confirmed via `package.json` inspection (`sideEffects: False`, `module: lib/index.js`). With Vite/Rollup's production build, unused named exports (e.g. `Accordion` if never imported) are eliminated. Because it's one umbrella package aggregating ~50 sub-packages, Rollup must parse the full re-export graph to determine reachability — this adds build-time analysis cost but does not bloat the shipped bundle; dead code is still eliminated. |
| `@fluentui/react-icons` | `"sideEffects": false` for icon modules (only 2 CSS-font-related glob paths marked side-effectful) | Confirmed via `package.json`: `sideEffects: ["**/headless/fonts/styles.css", "**/headless/styles.css"]` — icon SVG/JSX modules are NOT in this list, so named imports like `import { ArrowRight24Regular } from "@fluentui/react-icons"` tree-shake cleanly; only imported icons ship. This directly satisfies the migration plan's Phase D requirement ("具名导入保证 tree-shaking"). Package is large on disk (~299MB unpacked, since it ships every icon in every size/theme as individual files) but this has zero bearing on shipped bundle size given correct named-import usage. Do not `import * as Icons`, and do not use the `/fonts` icon-font subpath (side-effectful, pulls in a whole webfont). |
| Griffel (`@griffel/react`, `@griffel/core`) | Runtime CSS-in-JS — atomic rule sets generated at `makeStyles()` call time, injected as `<style>` tags at runtime, not bundled as static CSS strings beyond the JS describing the rules | Griffel's own runtime footprint is small (~30KB unpacked per package-size check) — not a factor comparable to component code size. |

**One directional data point obtained (rate-limited on further bundlephobia queries):** a naive full, non-tree-shaken import of `@fluentui/react-icons` reports ~15.5MB raw / ~3.09MB gzip via Bundlephobia — this underscores why per-icon named imports (not namespace imports) are essential; it is not representative of actual shipped size when only the ~84 icons this codebase needs are imported by name.

**Practical guidance for Phase 39/D:** Always import from the top-level named export surface (`import { Button } from "@fluentui/react-components"`, `import { ArrowRight24Regular } from "@fluentui/react-icons"`). Never deep-import from internal `lib/` paths. Verify actual shipped delta after Phase B/D by running `npm run build` and diffing `dist/assets/*.js` sizes before/after — console-printed Vite build output sizes are sufficient for a directional before/after comparison; add `rollup-plugin-visualizer` only if a visual breakdown is wanted for the commit note, then remove it.

## Vite-Specific Configuration

**Recommended `vite.config.ts` change — `optimizeDeps.include`:**

```ts
// frontend/vite.config.ts
export default defineConfig({
  // ...existing config (React plugin, Tailwind plugin, @/ alias)...
  optimizeDeps: {
    include: ["@fluentui/react-components", "@fluentui/react-icons"],
  },
});
```

**Why:** `@fluentui/react-components` aggregates ~50 separate ESM sub-packages (confirmed via its own `dependencies` list: `@fluentui/react-accordion`, `@fluentui/react-avatar`, `@fluentui/react-button`, `@fluentui/react-dialog`, etc.). In Vite dev mode, without `optimizeDeps.include`, the first cold start after adding Fluent triggers Vite's dependency crawler to discover and pre-bundle this fan-out on the fly — slow, and can trigger a dev-server "new dependencies optimized" restart mid-session. Explicitly listing both umbrella entry points lets esbuild pre-bundle the whole graph upfront. This is a standard Vite pattern for large aggregated ESM packages, not a bug fix — low risk, purely a dev-experience improvement.

**Not required for this project:**
- `ssr.noExternal` / `ssr.external` — irrelevant; this is a client-only Vite SPA build (confirmed via `vite build` → static assets served by nginx per `frontend/Dockerfile`), no Vite SSR mode in use.
- `resolve.dedupe` — not needed; Fluent's internal Griffel dependency ranges (`^1.5.32` from react-components, `^1.6.1` from react-icons) both resolve within the same `1.x` major line, and npm/Vite naturally dedupes without manual intervention.
- No CommonJS interop plugin — both packages ship proper `exports` maps with dual `import`/`require` conditions; Vite's default esbuild-based CJS handling is sufficient. No `@rollup/plugin-commonjs` needed.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `@fluentui/react-components` (umbrella package) | Installing individual `@fluentui/react-button`, `@fluentui/react-dialog`, etc. sub-packages directly | Only if you need to pin one sub-package's version independently (e.g. patch a component bug without bumping the umbrella). Not warranted here — adds version-management overhead for zero benefit given tree-shaking already eliminates unused code from the umbrella. |
| `createLightTheme`/`createDarkTheme` + `BrandVariants` (from `@fluentui/react-components`) | `webLightTheme`/`webDarkTheme` as final themes | Only if shipping Microsoft's default un-branded Fluent 2 look with zero brand customization — not applicable here, since the milestone requires 5 custom accent brands aligned to existing Tailwind CSS variables. |
| Explicit `insertionPoint` via `createDOMRenderer` + `RendererProvider` | Default `FluentProvider` with no explicit renderer (Griffel's implicit default, styles appended at first-render time) | Only acceptable for a throwaway prototype where style-order determinism doesn't matter. For this production migration where Tailwind coexists long-term (Phases A–E), explicit `insertionPoint` is required — this is the single most important config decision surfaced by this research. |
| `@fluentui/react-icons` standard SVG entry | `@fluentui/react-icons`'s `/fonts` icon-font subpath | Only if you specifically need webfont-based icon rendering (e.g. legacy `<i>`-tag usage) — irrelevant here, and it defeats tree-shaking since it's the one side-effectful export path. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `@fluentui/react` (Fluent UI **v8**, the older "Northstar"-era package sometimes still surfaced in search results/tutorials) | Wrong major version — v8 is the pre-Griffel, JSS-based Fluent 1 design system, not the Fluent 2 / Azure AI Foundry portal look this milestone targets. Entirely different component API; would require a second, incompatible adapter layer. | `@fluentui/react-components` (v9) — confirmed this ships Fluent 2 / the Foundry-portal aesthetic. |
| `@fluentui/react-northstar` | Deprecated predecessor exploration of a "Fluent 2"-style API before v9 consolidated it; no longer actively maintained. | `@fluentui/react-components` v9. |
| Installing `@griffel/react` or `@griffel/core` directly in `package.json` | Unnecessary — both are already transitive dependencies, and `RendererProvider`/`createDOMRenderer`/`makeStyles`/`mergeClasses` are all re-exported from `@fluentui/react-components`. Adding them explicitly risks version drift from what Fluent's internals expect — Griffel's own source notes its constants are shared via a global `Symbol.for()` registry, so duplicate/mismatched installs are a real, documented risk class. | Import everything Griffel-related from `@fluentui/react-components`'s public API surface. |
| Installing `@fluentui/react-theme` directly | Same reasoning — fully re-exported by `@fluentui/react-components` (confirmed present in its `.d.ts`: `createLightTheme`, `createDarkTheme`, `BrandVariants`, `webLightTheme`, `webDarkTheme`). | Import from `@fluentui/react-components`. |
| Any second global CSS reset/normalize layer applied alongside Griffel and Tailwind Preflight (e.g. re-adding `emotion`/`styled-components` global resets, or a hand-rolled global reset targeting the same elements Griffel's `r` bucket already resets) | Griffel already injects its own scoped reset bucket (`r`, first in `styleBucketOrdering`) for Fluent components specifically. Tailwind v4 already applies its own global Preflight reset via `@tailwindcss/vite`. A third global reset would double-apply and fight both, producing hard-to-trace order bugs. | Keep Tailwind Preflight as the one global reset; let Griffel's scoped `r` bucket handle only Fluent-internal component resets (already scoped by Griffel's atomic class model, not applied globally). |
| A separate icon-font `<link>`/`@font-face` for Fluent System Icons | Bypasses tree-shaking — the `/fonts` subpath and its two CSS files are the only side-effectful part of `@fluentui/react-icons`, and using them forces loading the entire icon set as a webfont regardless of which ~84 icons are actually used. | Named SVG-icon imports (`import { ArrowRight24Regular } from "@fluentui/react-icons"`), matching the migration plan's Phase D icon-adapter approach exactly. |
| Keeping `@radix-ui/react-slot` around specifically to reimplement `asChild` for the new adapter layer | Fluent v9 has no `Slot`/`asChild` concept, and the migration plan already resolved this ("adapter 内用最小 cloneElement 替代") — pulling in more Radix for this one pattern reintroduces a dependency Phase F is meant to remove. | Minimal `React.cloneElement`-based helper inside the adapter layer, no new package. |
| Upgrading React to 19 "to be safe" for Fluent v9 | Unnecessary and out of scope — verified peer range `react: ">=16.14.0 <20.0.0"` fully covers `react@^18.3.0` already in use; no compatibility gap exists. | Keep React 18.3, do not touch this dependency for this milestone. |

## Stack Patterns by Variant

**If a future SSR/Next.js migration is ever considered (not applicable to the current Vite SPA):**
- Use `renderToStyleElements` + `rehydrateRendererCache` (both re-exported from `@fluentui/react-components`) to extract Griffel's server-rendered styles and rehydrate them client-side. Out of scope for now — no config change needed today.

**If bundle size monitoring becomes an ongoing practice after Phase D:**
- Add `rollup-plugin-visualizer` as a devDependency permanently only if the team wants recurring bundle reports; otherwise keep it a one-off, removed-after-use tool per commit.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-------------------|-------|
| `@fluentui/react-components@9.74.4` | `react@^18.3.0`, `react-dom@^18.3.0` | Verified peer range `>=16.14.0 <20.0.0` — no upgrade needed. |
| `@fluentui/react-components@9.74.4` | `@fluentui/react-icons@2.0.334` | No direct interdependency, but both independently depend on compatible `@griffel/react` ranges (`^1.5.32` vs `^1.6.1`) that npm resolves to a single deduped `1.x` install without conflict. |
| `@fluentui/react-components@9.74.4` | `typescript@^5.6.0` (existing) | Fluent v9's `.d.ts` files use standard modern TS syntax; no minimum-TS-version issue observed against 5.6. |
| `@fluentui/react-components` (Griffel-based styling) | `tailwindcss@^4.0.0` + `@tailwindcss/vite@^4.0.0` (existing) | Coexist safely via atomic-CSS-vs-atomic-CSS equal-specificity design; requires an explicit `insertionPoint` (see Griffel section) for deterministic style-source-order — not because of a specificity conflict, but to make override behavior between the two systems predictable rather than mount-order-dependent. |
| `@fluentui/react-components` | `vite@^6.0.0` | No Vite-major-version-specific incompatibility found; the only recommended addition is `optimizeDeps.include` for dev-server cold-start performance, a general Vite pattern for large aggregated ESM packages, not a Fluent-specific fix. |

## Sources

- npm registry direct queries (`npm view @fluentui/react-components ...`, `npm view @fluentui/react-icons ...`, `npm view @griffel/react versions`, `npm view @griffel/core version`, publish-date `time` field) — HIGH confidence, live registry data checked 2026-08-06.
- Downloaded and inspected actual package tarballs via `npm pack` for `@fluentui/react-components@9.74.4`, `@fluentui/react-icons@2.0.334`, `@fluentui/react-theme@9.2.1`, `@griffel/core@1.21.3`, `@griffel/react@1.5.32` — read `package.json` (`sideEffects`, `exports`, `dependencies`, `peerDependencies`) and `.d.ts`/`.js` source directly (`createDOMRenderer.d.ts`, `createDOMRenderer.js`, `getStyleSheetForBucket.js`, `constants.js`, `index.d.ts`) — HIGH confidence, verified against shipped code, not documentation prose.
- `@fluentui/react-components/dist/index.d.ts` re-export list — confirmed `RendererProvider`, `createDOMRenderer`, `makeStyles`, `mergeClasses`, `FluentProvider`, `createLightTheme`, `createDarkTheme`, `BrandVariants`, `webLightTheme`, `webDarkTheme`, `teamsLightTheme`, `teamsDarkTheme`, `Theme`, `PartialTheme` are all present — HIGH confidence.
- WebFetch of Griffel's `@griffel/react` package declaration files (`RendererContext.d.ts`, `renderToStyleElements.d.ts`) for SSR API surface — MEDIUM confidence (decl files, not narrative docs, but sufficient to confirm API existence and non-necessity for this SPA project).
- Bundlephobia API query — partially rate-limited (429s); obtained one successful data point for a naive full import of `@fluentui/react-icons@2.0.334` (~15.5MB raw / ~3.09MB gzip) — MEDIUM confidence, single directional data point, not authoritative for actual tree-shaken output size.
- GitHub issue search (`microsoft/fluentui` repo) for Vite `optimizeDeps` guidance — LOW confidence / inconclusive (search tooling returned minimal results); the `optimizeDeps.include` recommendation is based on general, well-established Vite dependency-optimization practice for large multi-package ESM aggregations, not a directly-sourced Fluent-specific GitHub issue — flagged as the one area validated more by general Vite knowledge than a Fluent-specific citation.
- `.planning/PROJECT.md` and `.omc/plans/fluent-ui-migration-plan.md` (repo) — milestone scope, adapter-mode decisions, and already-resolved risk items (scroll-area kept on Radix, `SheetContent side="bottom"` single call site, toast bridge requirements) — HIGH confidence (read directly).
- `frontend/package.json` (repo) — confirmed current React 18.3, Vite 6, Tailwind v4, TypeScript 5.6, and the 24-component Radix/shadcn baseline being migrated away from — HIGH confidence (read directly).

---
*Stack research for: Fluent UI v9 (Fluent 2) migration infrastructure — AI Avatar Platform frontend, v3.0 milestone*
*Researched: 2026-08-06*
