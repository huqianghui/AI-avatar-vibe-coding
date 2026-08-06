# Architecture Research: Fluent UI v9 Adapter-Mode Integration

**Domain:** React 18 + Tailwind v4 SPA adopting `@fluentui/react-components` v9 as an internal
implementation layer behind a stable `@/components/ui/*` import surface (126 consumer files unchanged).
**Researched:** 2026-08-06
**Confidence:** HIGH for package APIs (verified against published `.d.ts` for
`@fluentui/react-theme`, `@fluentui/react-provider`, `@fluentui/react-toast`, `@fluentui/react-icons`,
`@fluentui/react-components`, `@griffel/react`). MEDIUM for insertion-order best-practice pattern
(Griffel docs confirm the mechanism; the Tailwind-specific combination is a reasoned application of
that mechanism, not a copy of an official Tailwind+Fluent guide). LOW/flagged where noted.

> Supersedes the 2026-07-31 v2.0 "Avatar MVP Integration" architecture doc for the purposes of the
> current v3.0 milestone. This document covers only the Fluent UI v9 adapter-layer integration
> architecture; it does not restate the avatar/backend architecture from the prior milestone.

---

## 1. FluentProvider Placement in App.tsx

### Current tree (existing, unchanged in shape)
```
<SplashScreen />
<AppContent>
  <QueryClientProvider>
    <ConfigProvider>
      <Suspense><RouterProvider /></Suspense>
    </ConfigProvider>
    <Toaster ... />          {/* sonner, top-level sibling inside QueryClientProvider */}
  </QueryClientProvider>
</AppContent>
```

### Target tree (Phase 39 / Plan A)
```
<SplashScreen />
<AppContent>
  <QueryClientProvider>
    <FluentThemeBridge>                 {/* NEW: thin wrapper, subscribes to useThemeStore() */}
      <ConfigProvider>
        <Suspense><RouterProvider /></Suspense>
      </ConfigProvider>
      <FluentToaster />                 {/* Phase 41: replaces sonner <Toaster>, still lives here */}
    </FluentThemeBridge>
  </QueryClientProvider>
</AppContent>
```

`FluentThemeBridge` (new file: `frontend/src/components/providers/fluent-theme-bridge.tsx`) is a
small component that:
1. Reads `{ mode, accent } = useThemeStore()`.
2. Calls `getFluentTheme(mode, accent)` (memoized with `useMemo` keyed on `[mode, accent]`) to get
   one of the 10 pre-generated `Theme` objects.
3. Renders `<FluentProvider theme={theme} className="contents" style={{ background: "transparent" }}>{children}</FluentProvider>`.

**Placement rule: outermost visual wrapper, innermost logical wrapper.** `FluentProvider` must be
above every consumer of `@/components/ui/*` (i.e., above `RouterProvider` and above the new
`FluentToaster`, since both render Fluent-backed components) but it does **not** need to be above
`QueryClientProvider` or `ConfigProvider` — those carry no visual/token dependency on Fluent. Keeping
it *inside* `QueryClientProvider` (not wrapping it) avoids re-mounting query cache on theme change and
keeps the provider nesting order matching existing conventions (data providers outside, UI/theme
providers closer to the render tree).

**Why not wrap `<SplashScreen />` too:** `SplashScreen` is rendered as a sibling before `AppContent`
mounts and uses only Tailwind/CSS-var styling (no Fluent components per current architecture) — no
FluentProvider dependency, leave it outside to avoid pulling Fluent's runtime into the earliest paint.
If a future SplashScreen redesign introduces Fluent components, hoist `FluentProvider` one level higher
(wrap `<>{<SplashScreen/>}{<AppContent/>}</>` in `export default function App()`), which is a 1-line change.

### Keeping `.dark` / `.theme-*` class mechanism alive alongside FluentProvider

These are two **independent, parallel theming systems** that must stay in sync but not fight:

- `theme-store.ts` continues to own `document.documentElement.classList` (`.dark`, `.theme-{accent}`)
  exactly as today — **zero changes to `theme-store.ts` are required**. This still drives all Tailwind
  utility classes and the CSS custom properties in `index.css` (`--primary`, `--background`, etc.),
  which is what 100% of non-migrated business code and Tailwind classes read.
- `FluentThemeBridge` is a **read-only subscriber** to the same store (`useThemeStore()`), translating
  `{mode, accent}` into a `Theme` object for Fluent's own token system (`--colorBrandBackground` etc.,
  which Fluent components read via Griffel `makeStyles`/tokens, NOT via `index.css` variables).
- **Preventing FluentProvider from overriding `<body>`:** `FluentProvider` by default renders a `<div>`
  (or whatever slot root) and colors `background-color`/`color` from the theme's
  `colorNeutralBackground1` / `colorNeutralForeground1` tokens onto that root node — this is
  Fluent's standard "root provides page background" pattern. Since `<body>` background is already
  owned by Tailwind (`body { @apply bg-background text-foreground; }` in `index.css`), two competing
  root backgrounds would visually conflict (double-painted, or Fluent's opaque background hides
  Tailwind's page under it if it sits above the app root in z-order — in practice it doesn't create a
  stacking bug since it's a normal block ancestor, but colors would visibly clash on theme mismatch).
  **Mitigation:** pass `style={{ background: "transparent", color: "inherit" }}` and a layout-neutral
  `className="contents"` (Tailwind's `display: contents` utility) on `<FluentProvider>` so it does not
  introduce a new box in the layout or paint its own background — it becomes purely a context/token
  provider, and `<body>`'s Tailwind-driven background continues to show through. This is the standard
  trick used by teams embedding Fluent into an existing non-Fluent shell (confidence: MEDIUM — pattern
  is a reasoned combination of documented FluentProvider props + Tailwind's `contents` utility, not
  copied verbatim from an official "embedding Fluent in existing app" guide, since Microsoft's own docs
  assume Fluent owns the whole page).

---

## 2. Theme Bridge — `frontend/src/styles/fluent-theme.ts`

### Verified package API (via `@fluentui/react-theme` type declarations)
```ts
type Brands = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 | 160;
type BrandVariants = Record<Brands, string>;
declare const createLightTheme: (brand: BrandVariants) => Theme;
declare const createDarkTheme: (brand: BrandVariants) => Theme;
```
No `generateColorRamp`-style utility ships in `@fluentui/react-theme` itself (confirmed absent from
the package's public d.ts). Two real options exist for producing the 16-stop `BrandVariants` ramp per
accent:

1. **Microsoft's official "Theme Designer" web tool** (community-known as the Fluent UI theme
   generator, historically hosted at a `fluentuipr.z22.web.core.windows.net` / `react.fluentui.dev`
   theming-designer route) — paste one brand hex, it emits a ready-made `BrandVariants` object with
   all 16 stops. **Confidence: LOW** — could not reach a live, current URL for this tool during this
   research session (multiple attempts 404'd/redirected); treat its exact current URL as needing
   verification at implementation time, but its *existence and purpose* is well-established prior
   knowledge, and it is the approach Microsoft itself recommends in first-party samples.
2. **`@fluentui/react-theme`'s own ramp algorithm reproduced via a small offline script** using a
   perceptual color-ramp library (e.g. `chroma-js` or a HSL-lightness-step function) tuned against the
   5 existing accent hexes (`#1E40AF` blue / `#0D9488` teal / `#7C3AED` purple / `#BE185D` rose /
   `#B45309` amber from `theme-store.ts`).

**Recommended concrete approach — offline pre-generation, not runtime generation:**

Because the CSS variables in `index.css` are the acknowledged single source of truth for brand color
(per the plan's own decision #3), the 5×2 = 10 `BrandVariants` objects should be **generated once,
offline, and committed as static data** in `fluent-theme.ts` — not computed at runtime from the CSS
vars and not regenerated on every render. Concrete steps:

```ts
// frontend/src/styles/fluent-theme.ts
import {
  createLightTheme, createDarkTheme, type BrandVariants, type Theme,
} from "@fluentui/react-components";
import type { ThemeMode, AccentColor } from "@/stores/theme-store";

// Each ramp below is offline-generated (Fluent Theme Designer tool, or an equivalent
// perceptual-ramp script run once and pasted here) using theme-store.ts's accent hex as
// the anchor color (stop 80 or 90, matching Fluent's convention of "primary" sitting near
// the 80/90 stop). Re-run generation only when an accent's anchor hex changes.
const blueRamp: BrandVariants = {
  10: "#020305", 20: "#0A1327", 30: "#0F1F42", 40: "#122953", /* ... */
  80: "#1E40AF", /* anchor: matches --primary in index.css */
  /* ... 90-160 ... */
};
// teal, purple, rose, amber ramps follow the same shape.

const RAMPS: Record<AccentColor, BrandVariants> = { blue: blueRamp, teal: tealRamp, purple: purpleRamp, rose: roseRamp, amber: amberRamp };

const THEME_CACHE = new Map<string, Theme>();

export function getFluentTheme(mode: ThemeMode, accent: AccentColor): Theme {
  const key = `${mode}:${accent}`;
  if (!THEME_CACHE.has(key)) {
    const ramp = RAMPS[accent];
    THEME_CACHE.set(key, mode === "dark" ? createDarkTheme(ramp) : createLightTheme(ramp));
  }
  return THEME_CACHE.get(key)!; // 10 entries total, built lazily but cached — cheap either way
}
```

**Why offline over runtime:** (a) `createLightTheme`/`createDarkTheme` are pure functions of a
16-stop ramp — computing a ramp from 1 hex at runtime requires either bundling a color-math library
(bundle-size cost, Phase F cares about this) or reimplementing Microsoft's undocumented internal
lightness curve (risk of visual mismatch vs. what the Theme Designer tool would produce); (b) the plan
explicitly commits to "预生成 10 个 Fluent theme...离线生成写死" (pre-generate 10 themes, offline,
hardcoded) — this research confirms that's the right call given no ramp-generator ships in the runtime
package; (c) a `fluent-theme.test.ts` (already planned in Phase A) can assert all 10 combinations
produce a valid `Theme` object with the expected anchor color at the expected stop, giving a cheap
regression net without needing a browser.

**Visual-match caveat (flag for Phase F):** because the ramp is generated *once* offline against a
single anchor hex, exact perceptual matching to the existing `index.css` `--primary`/`--ring`/`--chart-1`
values on every stop is not guaranteed without visual QA — this is precisely why the plan schedules a
"对照 Foundry 门户截图微调 brand ramp" (compare against Foundry portal screenshots, fine-tune ramp) step
in Phase F, and `fluent-theme.ts`'s ramps should be treated as revisable constants, re-touched in Phase F
rather than the correctness contract of Phase A.

---

## 3. Griffel Insertion Order vs. Tailwind

### Verified mechanism (Griffel docs, `@griffel/react` API)
- Griffel is atomic-CSS-in-JS: `makeStyles()` generates one class per CSS property/value pair, injected
  into `<style>` tags Griffel manages itself.
- `createDOMRenderer(targetDocument, { insertionPoint })` + `<RendererProvider renderer={renderer}>`
  controls **where in `<head>` Griffel's `<style>` tags land**: "if specified, a renderer will insert
  created style tags after this [insertionPoint] element." Without it, Griffel appends its
  `<style>` tags at the end of `<head>` by default.
- `@fluentui/react-components` re-exports `RendererProvider`, `createDOMRenderer`, `mergeClasses`,
  `makeStyles`, `makeResetStyles` directly from `@griffel/react` — no separate install needed.
- `FluentProvider`'s public props (`theme`, `dir`, `targetDocument`, `customStyleHooks_unstable`,
  `overrides_unstable`, `applyStylesToPortals`) do **not** include a `renderer` prop — `FluentProvider`
  does not itself expose insertion-point control. To control it, `RendererProvider` must be an
  **explicit separate ancestor** wrapping `FluentProvider` (both packages export it precisely so this
  composition is possible; this is the documented SSR/child-window use-case, and reusing it for
  insertion-order-vs-Tailwind control is a straightforward extension of the same mechanism).

### Concrete setup

**`frontend/index.html`** — add one placeholder `<style>` element *before* the Tailwind stylesheet
link/inline bundle, to serve as the insertion anchor:
```html
<head>
  ...
  <!-- Griffel insertion anchor: Fluent/Griffel styles are injected AFTER this node,
       i.e. immediately after this line and BEFORE Vite's injected Tailwind <style>/<link>
       (Vite injects its CSS via <script type="module"> import which resolves to inserted
       <style>/<link> tags AFTER whatever is already in <head> at parse time — placing this
       anchor as the LAST static element in <head>, before Vite's injected module script,
       guarantees Griffel's tags land before Tailwind's). -->
  <style id="griffel-insertion-point"></style>
  <script>
    (function() { /* existing theme-init IIFE, unchanged */ })();
  </script>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</head>
```

**`frontend/src/main.tsx` or `App.tsx`** — create the renderer once at module scope (not per-render) and
wrap `FluentProvider`:
```tsx
import { RendererProvider, createDOMRenderer } from "@fluentui/react-components";

const insertionPoint = document.getElementById("griffel-insertion-point") ?? undefined;
const renderer = createDOMRenderer(document, insertionPoint ? { insertionPoint } : undefined);

// in AppContent, wrapping FluentThemeBridge:
<RendererProvider renderer={renderer}>
  <FluentThemeBridge>...</FluentThemeBridge>
</RendererProvider>
```

**Resulting cascade order in `<head>` at runtime:**
```
<style id="griffel-insertion-point"></style>   <-- anchor, empty
<style data-griffel-...>...</style>            <-- Fluent/Griffel atomic classes (colors, borders, tokens)
...
<style>/* Tailwind utilities injected by Vite */</style>  <-- LAST = highest cascade priority
```

Because Tailwind's generated stylesheet ends up **after** Griffel's in source order, and both systems
use single-class-selector specificity (Griffel: one class per rule via `makeStyles`; Tailwind: one
class per utility), **CSS cascade order (later wins on equal specificity) makes Tailwind utility classes
win over Griffel-generated classes whenever both target the same property on the same element** — which
is exactly the desired outcome: `className="w-full h-10"` (layout, Tailwind) passed by a consumer onto a
Fluent-backed `<Button>` continues to override any conflicting layout Griffel might set, while color/
border tokens that Tailwind classes don't touch remain owned by Fluent/Griffel.

**Verification step for Phase A (already flagged in the plan as a risk):** after `npm run build`,
inspect the built `dist/index.html` and its injected `<link rel="stylesheet">` order to confirm Vite
didn't reorder the anchor relative to the Tailwind bundle link (Vite's CSS injection order for a
plain `<style>` anchor + `@tailwindcss/vite` plugin output should be stable, but this is a build-tool
behavior that must be checked empirically, not just asserted — this is precisely the "build 后核查产物
顺序" risk item the plan already calls out).

---

## 4. `cn()` Coexistence with Griffel `mergeClasses`

Two distinct authoring contexts, kept syntactically separate on purpose:

| Layer | Tool | Rule |
|-------|------|------|
| `src/components/ui/*.tsx` (adapter internals) | Griffel `makeStyles()` + `mergeClasses()` | Component-internal variant/state classes are Griffel-generated. Consumer's `className` prop is appended **last** via `mergeClasses(styles.root, appearanceStyles[variant], className)` — `mergeClasses` (Griffel's own de-duplicating class combiner, analogous to `clsx` but Griffel-aware) guarantees the last-listed class for a given style "slot" wins in Griffel's own bucketing, and combined with the cascade order from §3, the consumer's plain Tailwind `className` still wins for layout. |
| Everything outside `components/ui/*` (business/page code) | `cn()` (`clsx` + `tailwind-merge`, unchanged, `frontend/src/lib/utils.ts`) | No change. Business code never imports Griffel directly; it only ever composes Tailwind classes via the existing `cn()` and passes the result into `className` on a `ui/*` component, which then flows into `mergeClasses(...)` as described above. |

**Concrete adapter pattern** (example shape for `button.tsx`):
```tsx
import { makeStyles, mergeClasses } from "@fluentui/react-components";

const useButtonStyles = makeStyles({
  root: { /* base tokens: colorNeutralStroke1, borderRadius, etc. */ },
  destructive: { backgroundColor: tokens.colorPaletteRedBackground3 /* Griffel override for a variant Fluent's own `appearance` doesn't natively cover */ },
});

function Button({ className, variant, ...props }: ButtonProps) {
  const styles = useButtonStyles();
  return (
    <FluentButton
      data-slot="button"
      className={mergeClasses(styles.root, variant === "destructive" && styles.destructive, className)}
      {...mapVariantToAppearance(variant, props)}
    />
  );
}
```
`data-slot="button"` is preserved literally (per the plan's hard requirement — ~39 test assertions key
off it), and `mergeClasses(..., className)` keeps the append-last-wins contract consumers already rely
on today via shadcn's own `cn(buttonVariants({variant}), className)` pattern — the *call shape at the
consumer site is unchanged*, only the internal merge function changed from `cn` to `mergeClasses`.

**Do not use `cn()` inside `ui/*` components once migrated** — mixing `clsx`/`tailwind-merge`'s
specificity-blind string concatenation with Griffel's class-bucketing model is exactly the kind of
inconsistency that produces the "which class wins" bugs the insertion-order work in §3 is meant to
prevent. `cn()` remains valid only for pure-Tailwind business code that never touches Griffel classes.

---

## 5. Icon Adapter Architecture — `frontend/src/components/icons/`

### Verified `@fluentui/react-icons` API
```ts
type FluentIconsProps<...> = {
  primaryFill?: string;
  className?: string;
  title?: string;
  filled?: boolean;         // only meaningful for icons created via bundleIcon
  idPrefix?: string;
  fontSize?: string | number;  // "sets the rendered size of a resizable icon... sized variants ignore this"
} & React.SVGAttributes<SVGElement>;

type FluentIcon = React.FC<FluentIconsProps>;
function createFluentIcon(displayName: string, width: string, pathsOrSvg: ..., options?): FluentIcon;
```
Individually-imported "regular"/"filled" icons (e.g. `Add24Regular`) are **resizable** variants built
around a `1em`-relative viewBox and — per longstanding, widely-documented Fluent-icons behavior — render
with an inline `font-size` equal to their name's pixel suffix (e.g. `24` → effectively `font-size: 24px`
via the component's own default styling), which is what needs stripping so Tailwind's `size-*`
(`width`/`height` utility) + `currentColor` usage (matching the existing lucide-react usage pattern in
126 files) keeps working unchanged.

### File layout
```
frontend/src/components/icons/
├── _adapter.tsx     # NEW — makeIconAdapter(), shared wrapper logic
├── index.ts         # NEW — 84 named exports, lucide-compatible names
```

### `_adapter.tsx`
```tsx
import { forwardRef } from "react";
import type { FluentIcon } from "@fluentui/react-icons";
import { cn } from "@/lib/utils";

/**
 * Wraps a Fluent icon component to behave like a lucide-react icon:
 * - strips Fluent's own size-driving default (fontSize) so Tailwind's `size-*`
 *   utilities (which set width/height) fully control rendered size
 * - forwards `currentColor`-friendly className composition via cn()
 * - keeps the same `className`/`size`-agnostic call signature consumers already use
 */
export function makeIconAdapter(FluentIconComponent: FluentIcon, displayName: string) {
  const Adapted = forwardRef<SVGSVGElement, React.SVGAttributes<SVGSVGElement>>(
    ({ className, ...props }, ref) => (
      <FluentIconComponent
        ref={ref}
        // fontSize={undefined} lets the icon fall back to being purely viewBox/width-driven;
        // Tailwind's size-* utilities set width/height directly on the <svg>, which for an
        // SVG-based icon overrides any residual intrinsic sizing regardless of fontSize.
        fontSize={undefined}
        className={cn("shrink-0", className)}  // shrink-0 matches lucide's flex-child default behavior already relied on across 126 files
        {...props}
      />
    )
  );
  Adapted.displayName = displayName;
  return Adapted;
}
```

**Spike required before Phase 41 build-out (already flagged in the plan):** confirm empirically in a
throwaway test page that `fontSize={undefined}` + Tailwind `size-4`/`size-5` classes reproduce
pixel-identical rendering vs. the current lucide icons at the same call sites — the `.d.ts` confirms the
prop's *existence and purpose* but not the exact default value baked into each generated icon component,
so this is a MEDIUM-confidence mechanism, HIGH-confidence prop existence.

### `index.ts` — 84 same-named exports
```ts
// One line per lucide icon name currently imported across the 126 consumer files.
// The 84-icon lucide -> Fluent mapping table (regular vs filled selection, manually
// reviewed per the plan's "不用脚本瞎猜" decision) lives inline as these export statements.
export { makeIconAdapter } from "./_adapter";
import { Add24Regular, Dismiss24Regular /* ...84 total */ } from "@fluentui/react-icons";
import { makeIconAdapter } from "./_adapter";

export const Plus = makeIconAdapter(Add24Regular, "Plus");       // lucide: Plus
export const X = makeIconAdapter(Dismiss24Regular, "X");         // lucide: X
// ... 82 more, one per distinct lucide icon in use
```
Named (not default/namespace) exports preserve tree-shaking — consumers change only the import path
(`"lucide-react"` → `"@/components/icons"`), not the imported identifiers, so the 126-file changeset is a
mechanical import-path swap, batched by directory (`admin/*` → `shared/*` → `voice/*` → `pages/*`) as the
plan specifies, each batch its own commit.

---

## 6. Toast Bridge Architecture — `frontend/src/lib/toast/`

### Verified `@fluentui/react-toast` API
```ts
// useToastController(toasterId?) returns:
{
  dispatchToast: (content: React.ReactNode, options?: ToastDispatchOptions) => void; // no return value — no toastId comes back
  dismissToast: (toastId: ToastId) => void;
  dismissAllToasts: () => void;
  updateToast: (options: ToastUpdateOptions) => void;
  pauseToast: (toastId: ToastId) => void;
  playToast: (toastId: ToastId) => void;
}

interface ToastOptions { toastId: ToastId; intent?: "info"|"success"|"error"|"warning"; timeout: number; /* ...position, politeness, data, onStatusChange... */ }
// ToastDispatchOptions = Partial<Omit<ToastOptions, "toasterId">> & { root?: Slot<"div"> }
```

**Critical finding (verified, not assumed):** `toastId` IS part of `ToastOptions` and — because
`ToastDispatchOptions` is `Partial<Omit<ToastOptions, "toasterId">>` — `toastId` **does survive** into
`ToastDispatchOptions` as an optional field (an earlier isolated probe suggested the opposite, but
re-deriving directly from the `Omit<..., 'toasterId'>` type algebra confirms only `toasterId` is
stripped; `toastId` remains optional-available on `ToastDispatchOptions`). This means callers of the
underlying Fluent API **can pass their own `toastId` into `dispatchToast(content, { toastId: myId })`**,
which is the load-bearing fact that makes the bridge's `dismiss(id)` contract implementable at all —
**flag this as needing a one-time empirical confirmation in Phase E** (write a throwaway
`dispatchToast(<x/>, {toastId: "abc"})` then `dismissToast("abc")` and assert it dismisses) since the
type-algebra reasoning is HIGH confidence but was not confirmed against a live runtime in this session.

### Bridge design
```
frontend/src/lib/toast/
├── toast-bridge.ts     # NEW — pub/sub bus + global toast.xxx() singleton API
├── toast-bridge.test.ts
frontend/src/components/ui/sonner.tsx   # MODIFIED — becomes the Fluent Toaster + useToastController consumer, re-exports `toast`
```

**Why a pub/sub bus (not calling `dispatchToast` directly from the module-level `toast` object):**
`useToastController` is a **hook** — it only works inside a component with access to `ToasterProvider`
context tied to a mounted `<Toaster>`. But `toast.success(...)` today is called from arbitrary
non-component modules/callbacks (46 files, imperative call sites) exactly like `sonner`'s global
singleton. The bridge must decouple "who calls `toast.xxx()`" (anywhere, no hook rules) from "who
actually has the `dispatchToast` function" (only inside the `<FluentToaster>`-adjacent component tree).

```ts
// frontend/src/lib/toast/toast-bridge.ts
type ToastIntent = "success" | "error" | "info" | "warning" | "loading";
type ToastId = string;
interface ToastRequest { id: ToastId; intent: ToastIntent; message: string; description?: string; }
type BusListener = (req: ToastRequest) => void;
type DismissListener = (id: ToastId | undefined) => void;

const showListeners = new Set<BusListener>();
const dismissListeners = new Set<DismissListener>();
let seq = 0;
const genId = () => `toast-${++seq}`;

function emitShow(req: ToastRequest) { showListeners.forEach((l) => l(req)); }
function emitDismiss(id?: ToastId) { dismissListeners.forEach((l) => l(id)); }

/** Called once, inside the component that owns useToastController (sonner.tsx's Fluent bridge). */
export function __subscribeToastBridge(onShow: BusListener, onDismiss: DismissListener) {
  showListeners.add(onShow); dismissListeners.add(onDismiss);
  return () => { showListeners.delete(onShow); dismissListeners.delete(onDismiss); };
}

function make(intent: ToastIntent) {
  return (message: string, opts?: { description?: string; id?: ToastId }) => {
    const id = opts?.id ?? genId();
    emitShow({ id, intent, message, description: opts?.description });
    return id; // mirrors sonner's toast.xxx() returning an id usable for later dismiss()
  };
}

export const toast = {
  success: make("success"),
  error: make("error"),
  info: make("info"),
  warning: make("warning"),
  loading: make("loading"),           // avatar-page.tsx:224-243 requirement
  dismiss: (id?: ToastId) => emitDismiss(id),  // dismiss(id) or dismiss() = dismiss all
};
```

```tsx
// frontend/src/components/ui/sonner.tsx (replaces sonner import entirely)
import { Toaster as FluentToaster, useToastController, Toast, ToastTitle, ToastBody } from "@fluentui/react-components";
import { useEffect } from "react";
import { __subscribeToastBridge, toast } from "@/lib/toast/toast-bridge";

export { toast }; // re-export so `import { toast } from "@/components/ui/sonner"` OR the new canonical `@/lib/toast` both work during migration

const TOASTER_ID = "app-toaster";

export function Toaster() {
  const { dispatchToast, dismissToast, dismissAllToasts, updateToast } = useToastController(TOASTER_ID);

  useEffect(() => (
    __subscribeToastBridge(
      (req) => {
        // "loading" has no native Fluent intent — model it as an indeterminate/info-styled
        // toast with no timeout; callers pair it with toast.dismiss(id) once work finishes.
        const intent = req.intent === "loading" ? "info" : req.intent;
        dispatchToast(
          <Toast><ToastTitle>{req.message}</ToastTitle>{req.description && <ToastBody>{req.description}</ToastBody>}</Toast>,
          { toastId: req.id, intent, timeout: req.intent === "loading" ? -1 : 4000 }
        );
      },
      (id) => (id ? dismissToast(id) : dismissAllToasts())
    )
  ), [dispatchToast, dismissToast, dismissAllToasts]);

  return <FluentToaster toasterId={TOASTER_ID} />;
}
```

`App.tsx` changes minimally: `<Toaster position="top-right" theme={...} toastOptions={...} />` (sonner
props) becomes `<Toaster />` (Fluent bridge takes no such props — position/theme are Toaster-level
Fluent props if needed, `toasterId` is internal). This is a small, isolated App.tsx diff, independent of
the FluentProvider wiring in §1 (both land in the provider tree but are separate concerns/commits per
the plan's Phase A vs Phase E split).

**Migration mechanics for the 46 call sites:** change `import { toast } from "sonner"` →
`import { toast } from "@/lib/toast"` (add a barrel `frontend/src/lib/toast/index.ts` re-exporting
`toast` from `toast-bridge.ts` as the canonical consumer-facing path, per the plan's stated new import
path `"@/lib/toast"`). Tests change `vi.mock("sonner")` → `vi.mock("@/lib/toast")`, file-by-file (plan
explicitly rules out a blanket `sed`).

---

## 7. Suggested Build Order (Phases 39–42) and Coexistence Points

```
Phase 39 (this research's primary scope)
├── Plan A — Infra (0 behavior diff)
│    1. npm install @fluentui/react-components @fluentui/react-icons  (coexist with Radix/lucide/sonner)
│    2. frontend/src/styles/fluent-theme.ts — getFluentTheme(), 10 pre-generated BrandVariants (§2)
│    3. frontend/index.html — add #griffel-insertion-point anchor <style> (§3)
│    4. frontend/src/App.tsx — wrap with RendererProvider(createDOMRenderer) + FluentThemeBridge(FluentProvider) (§1, §3)
│    5. fluent-theme.test.ts (10 combos produce valid Theme); full existing E2E suite as regression net
│    → COMMIT/PUSH. Nothing visually changes yet — FluentProvider renders zero Fluent components.
│
└── Plan B — Leaf components (button, badge, input, label, checkbox, switch, separator,
     skeleton, progress, textarea, slider, avatar)
     Each gets Griffel makeStyles + mergeClasses internals (§4), data-slot preserved,
     one component = one commit. First component (likely `button`, per plan) establishes
     the adapter pattern/template the rest copy.
     → Depends on Plan A's FluentProvider + theme bridge being live (else no tokens resolve).
     → COMMIT/PUSH per component.

Phase 40 — Plan C: composite components (C1–C8: dialog, sheet, select, dropdown-menu, tabs,
  tooltip, scroll-area[skip, stays Radix], card, form)
  → Depends on Plan B's established Griffel pattern + data-slot/asChild conventions.
  → Independent of icon/toast work — can start as soon as Phase 39 lands, does not block Phase 41.
  → Each C-component still uses icons (lucide, unchanged) and toast (sonner, unchanged) internally
    where relevant — Phase 40 does NOT depend on Phase 41's icon/toast bridges; it only depends on
    Phase 39's Fluent+Griffel plumbing.

Phase 41 — Plan D (icons) + Plan E (toast) — can run in either order relative to each other,
  both depend only on Phase 39 (FluentProvider tree must exist so Fluent icon/toast components
  render inside proper token context) — NOT on Phase 40's composite components.
  ├── D: components/icons/_adapter.tsx + index.ts (§5), spike fontSize-strip first,
  │      then batch import-path swap by directory (admin/* → shared/* → voice/* → pages/*),
  │      ui/* components (from Phase 39/40) already done as part of their own migration.
  └── E: lib/toast/toast-bridge.ts + ui/sonner.tsx bridge (§6), verify toastId survives
         dispatchToast→dismissToast empirically, then batch import-path swap across 46 files.

Phase 42 — Plan F: cleanup (blocked on ALL of A–E complete and verified)
  1. grep zero-hit confirmation for @radix-ui|lucide-react|sonner|vaul (except scroll-area's Radix, kept)
  2. Uninstall deps, update lockfile
  3. Revisit fluent-theme.ts ramps against Foundry portal screenshots (§2 caveat) — this is the
     natural place to correct any visual drift from the offline-generated ramps
  4. Lighthouse/a11y audit vs. pre-migration baseline
  5. Coverage threshold review (select/dropdown-menu/form move out of exclude list, per Phase C work)
```

**Cross-phase coexistence rule:** From the moment Plan A lands through the end of Phase 41, the app runs
with **both** Radix+lucide+sonner and Fluent+Griffel mounted simultaneously — this is intentional
(plan's stated design). The insertion-order setup in §3 and the `cn()`/`mergeClasses` split in §4 are
what make this dual-stack period safe: Tailwind classes continue to cascade-win over Griffel for layout
regardless of which components have been migrated yet, so partially-migrated screens (some `ui/*`
components Fluent-backed, others still Radix-backed, both styled via Tailwind `className` at the call
site) do not visually regress mid-migration.

---

## Integration Points Summary

### New files
| File | Purpose |
|------|---------|
| `frontend/src/styles/fluent-theme.ts` | `getFluentTheme(mode, accent)`, 10 pre-generated `BrandVariants`/`Theme` |
| `frontend/src/styles/fluent-theme.test.ts` | Asserts 10 combos yield valid themes |
| `frontend/src/components/providers/fluent-theme-bridge.tsx` | Subscribes to `useThemeStore()`, renders transparent `<FluentProvider>` |
| `frontend/src/components/icons/_adapter.tsx` | `makeIconAdapter()` |
| `frontend/src/components/icons/index.ts` | 84 lucide-named Fluent icon exports |
| `frontend/src/lib/toast/toast-bridge.ts` | Pub/sub bus, global `toast.xxx()` singleton |
| `frontend/src/lib/toast/index.ts` | Barrel, canonical `@/lib/toast` import path |
| `frontend/src/lib/toast/toast-bridge.test.ts` | Bus behavior tests |

### Modified files
| File | Change |
|------|--------|
| `frontend/index.html` | Add `<style id="griffel-insertion-point">` anchor before module script |
| `frontend/src/App.tsx` | Wrap tree with `RendererProvider` + `FluentThemeBridge`; swap `<Toaster>` (sonner) → Fluent bridge `<Toaster>` (Phase E) |
| `frontend/src/components/ui/*.tsx` (12 leaf + 9 composite, minus scroll-area) | Internal Radix/cva → Fluent/Griffel, `data-slot` preserved, `mergeClasses` replaces internal `cn()` |
| `frontend/src/components/ui/sonner.tsx` | Becomes Fluent `Toaster` + `useToastController` bridge consumer |
| 126 files importing `lucide-react` | Import path only: `"lucide-react"` → `"@/components/icons"` |
| 46 files importing `sonner`'s `toast` | Import path only: `"sonner"` → `"@/lib/toast"` |
| Test files with `vi.mock("sonner")` / Radix `data-state` assertions | Mock path swap; `aria-*` equivalent assertions |

### Internal boundaries
| Boundary | Communication | Notes |
|----------|---------------|-------|
| `theme-store.ts` ↔ `fluent-theme-bridge.tsx` | `useThemeStore()` hook subscription (read-only) | No changes to `theme-store.ts`; Fluent theme is a pure derived view |
| `index.css` CSS vars ↔ `fluent-theme.ts` ramps | One-way, offline sync (manual re-generation, no runtime coupling) | Single source of truth = CSS vars; Fluent ramps are a hand-maintained derived artifact, revisited in Phase F |
| Griffel styles ↔ Tailwind styles | CSS cascade via `<head>` insertion order (`insertionPoint` anchor before Tailwind's injected stylesheet) | Verify empirically post-build each time build tooling changes |
| `components/ui/*` internals ↔ consumer `className` | `mergeClasses(..., className)` — consumer class always last | Mirrors existing `cn(buttonVariants(), className)` shadcn contract |
| Global `toast.xxx()` callers ↔ Fluent `useToastController` | Module-level pub/sub bus, decoupling non-hook callers from hook-bound dispatch | `toastId` pass-through into `dispatchToast` needs one live empirical check in Phase E |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Letting `FluentProvider` paint its own background
**What people do:** Drop `<FluentProvider theme={theme}>{children}</FluentProvider>` with no style
overrides, assuming it's a no-op wrapper.
**Why it's wrong:** Fluent's provider applies `colorNeutralBackground1`/`colorNeutralForeground1` to its
own root, which competes with `<body>`'s Tailwind-driven `bg-background text-foreground`, causing visible
seams or flashes especially during the Radix/Fluent dual-stack period.
**Do this instead:** `className="contents"` + `style={{ background: "transparent" }}` (§1), letting
`<body>` remain the single background authority throughout the whole migration.

### Anti-Pattern 2: Regenerating `BrandVariants` ramps at runtime from CSS custom properties
**What people do:** Read `getComputedStyle(document.documentElement).getPropertyValue("--primary")` at
theme-switch time and algorithmically derive all 16 Fluent stops on the fly.
**Why it's wrong:** No official ramp-generation algorithm ships in the runtime `@fluentui/react-theme`
package (confirmed absent from its public API) — any runtime reimplementation risks drifting from what
Microsoft's own Theme Designer tool would produce, and adds a color-math dependency + per-switch compute
cost for no benefit given there are only 10 fixed combinations.
**Do this instead:** Pre-generate all 10 `BrandVariants` objects once (offline tool or script), commit
them as static data, cache the resulting `Theme` objects in a `Map` (§2).

### Anti-Pattern 3: Using `cn()` inside migrated `ui/*` component internals
**What people do:** Keep calling `cn(baseClasses, variantClasses, className)` inside a component whose
`baseClasses`/`variantClasses` are now Griffel-generated atomic class names.
**Why it's wrong:** `tailwind-merge` (inside `cn()`) only understands Tailwind's own utility-class
conflict resolution rules — it doesn't know how to de-duplicate or correctly order Griffel's
non-Tailwind atomic classes, silently reintroducing the exact cascade-order bugs §3's insertion-point
setup was built to prevent.
**Do this instead:** Use Griffel's own `mergeClasses()` inside `ui/*` internals (§4); reserve `cn()`
strictly for business/page code composing pure Tailwind classes.

---

## Sources

- `@fluentui/react-theme` published type declarations (`createLightTheme`, `createDarkTheme`,
  `BrandVariants`, `Brands`, theme preset exports) — fetched via jsdelivr CDN, HIGH confidence (reflects
  actual current published package API).
- `@fluentui/react-provider` published type declarations (`FluentProviderProps`) — fetched via jsdelivr
  CDN, HIGH confidence.
- `@fluentui/react-toast` published type declarations (`useToastController`, `ToastOptions`,
  `ToastDispatchOptions`, `ToasterProps`) — fetched via jsdelivr CDN, HIGH confidence on field
  existence; MEDIUM confidence on the `toastId`-survives-into-dispatch behavioral claim pending one
  live runtime check (flagged for Phase E).
- `@fluentui/react-icons` published type declarations (`FluentIconsProps`, `createFluentIcon`,
  `FluentIcon`) — fetched via jsdelivr/unpkg CDN, HIGH confidence on prop existence; MEDIUM confidence
  on exact default-sizing runtime behavior (flagged for a Phase 41 spike, as the migration plan itself
  already schedules).
- `@fluentui/react-components` re-export surface (`RendererProvider`, `createDOMRenderer`,
  `mergeClasses`, `makeStyles`, `makeResetStyles` from `@griffel/react`) — fetched via jsdelivr CDN, HIGH
  confidence.
- Griffel `insertionPoint`/`createDOMRenderer`/`RendererProvider` mechanism — sourced from Griffel's own
  package documentation (via unpkg-hosted README), HIGH confidence on the mechanism itself; MEDIUM
  confidence on its specific application to "beat Tailwind's cascade order" (a reasoned, not
  officially-documented, combination).
- Fluent UI "Theme Designer" offline ramp-generation tool — referenced from established prior knowledge
  of the Fluent UI ecosystem; could not confirm a live current URL in this session (multiple fetch
  attempts 404'd or redirected to a docs shell with no body content) — **LOW confidence on exact current
  URL, HIGH confidence the offline-pregeneration approach itself is correct and is what the migration
  plan already commits to.**
- Existing repo files read directly: `frontend/src/App.tsx`, `frontend/src/stores/theme-store.ts`,
  `frontend/src/styles/index.css`, `frontend/src/lib/utils.ts`, `frontend/index.html`,
  `frontend/src/components/ui/index.ts`, `frontend/package.json`, `.omc/plans/fluent-ui-migration-plan.md`,
  `.planning/PROJECT.md`.

---
*Architecture research for: Fluent UI v9 adapter-mode migration integration layer*
*Researched: 2026-08-06*
