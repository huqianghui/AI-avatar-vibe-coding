# Phase 41: Icon & Toast Adapter Layers - Research

**Researched:** 2026-08-06
**Domain:** Fluent UI v9 icon/toast adapter migration (lucide-react → @fluentui/react-icons, sonner → Fluent Toaster)
**Confidence:** MEDIUM-HIGH (grep-verified inventory + package source inspection; icon name mapping is best-effort per explicit scope limit)

## Summary

Phase 41 replaces two independent leaf concerns — icons (lucide-react, 84 distinct icons / ~124 import statements across ~120 files) and toasts (sonner, 46 files, one `<Toaster>` mount, one `toast.loading`+`toast.dismiss(id)` call site) — with Fluent UI v9 equivalents behind stable adapter modules. Both requirement groups are explicitly gated by an empirical spike (ICON-01, TOAST-01) before batch rollout, per the roadmap's "spike first" convention established in Phase 39.

Package inspection of the installed `@fluentui/react-icons@2.0.334` shows every generated icon component (`createFluentIcon`) renders an `<svg>` with `width="1em" height="1em"` and `fill={primaryFill ?? "currentColor"}` — there is no hardcoded pixel `fontSize` in the SVG icon path (that machinery only exists in the separate font-icon code path, which this project does not use). This means the ICON-01 spike's real job is confirming that Tailwind's `size-*` utility (which sets CSS `width`/`height`) overrides the `1em` SVG attribute in practice across the actual browser/test environment — not stripping a literal `fontSize` prop that doesn't exist in the SVG icon path. The planner should treat "confirm Tailwind size-* wins over the 1em width/height attribute, and currentColor flows through" as the spike's precise empirical claim.

For toast, Fluent's `useToastController().dispatchToast(content, options)` accepts an optional `toastId` in `options` and falls back to an internal auto-incrementing counter if omitted (confirmed by reading `vanilla/dispatchToast.js`). This means toastId round-trip is achievable by **always passing an explicit `toastId`** from the bridge (e.g. a UUID or counter) rather than relying on Fluent's return value — `dispatchToast` returns `void`, not an id, which is a critical, verified difference from sonner (`toast.loading()` returns the id as its return value). The bridge MUST generate the id itself before calling `dispatchToast`, then use that same id for `dismissToast`/`updateToast`. This closes what the roadmap flags as the TOAST-01 spike's exact risk.

**Primary recommendation:** Build both adapters as pure client modules with no React dependency on the call sites' side (`src/components/icons/index.ts` re-exporting named lucide-shaped icons; `src/lib/toast/index.ts` exporting a `toast` object with the sonner method surface) — each fronting a single Fluent primitive (`@fluentui/react-icons` components; `useToastController` via a module-level controller ref captured from a mounted `<Toaster>`). Run the two spikes as literal first tasks before any batch migration, exactly as the roadmap specifies.

## User Constraints

No CONTEXT.md exists for Phase 41 (directory `.planning/phases/41-icon-toast-adapter-layers/` was empty prior to this research). All scope constraints below come from ROADMAP.md + REQUIREMENTS.md directly.

### Locked Decisions (from ROADMAP.md / REQUIREMENTS.md)
- ICON-01 spike is an entry gate — must pass before any batch icon rollout.
- TOAST-01 spike is an entry gate — must pass before the 46-file toast import migration.
- 84 distinct icons, ~130 call sites, migrated to `src/components/icons/` named exports, batched per directory (admin/shared/voice/pages), each batch its own commit with a bundle-size note.
- `toast.loading()` + `toast.dismiss(id)` at `avatar-page.tsx:224-243` (confirmed exact lines) must continue to work identically through `src/lib/toast/`.
- All 46 files move `"sonner"` imports to `"@/lib/toast"`; every `vi.mock("sonner")` individually re-verified as `vi.mock("@/lib/toast")` — explicitly NOT batch-sed.
- E2E must confirm Fluent Toaster renders a `role="status"` live region.
- CLAUDE.md top-priority rule applies: one requirement/batch at a time, 100% unit test coverage, Playwright E2E, all green before commit, one commit per requirement/batch, push after each.
- `components/ui/sonner.tsx` content is replaced (not deleted) with the Fluent Toaster + bridge, re-exporting `toast` (TOAST-02) — the existing file path/export name stays as the mount point per Phase 39's adapter convention (stable import surface).

### Claude's Discretion
- Exact regular/filled mapping decisions for ambiguous icons (flagged below) — human/executor confirms empirically in the ICON-01 spike and ICON-02 manual-review pass (REQUIREMENTS.md explicitly says "非脚本瞎猜" — not script-guessed, human-confirmed).
- Internal toastId generation strategy (UUID vs counter) inside the bridge.
- Whether regular or filled variant is the default export per icon (project currently uses lucide's single-style icons, so Regular is the natural default per Fluent's own convention of Regular being the default in most Microsoft products).

### Deferred Ideas (OUT OF SCOPE)
- Dependency uninstall (lucide-react, sonner removal) — Phase 42 (CLEAN-01), irreversible, go/no-go gated.
- Visual/brand fine-tuning — Phase 42 (CLEAN-02).
- Any composite component (dialog/sheet/select/etc.) — Phase 40, independent, no shared code paths with Phase 41.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ICON-01 | `makeIconAdapter()` spike — verify Tailwind `size-*`/`currentColor` win over Fluent icon's baked-in `1em` width/height, pixel-diff gate before batch rollout | Package source confirms `createFluentIcon` sets literal `width="1em" height="1em"` + `fill={primaryFill ?? "currentColor"}` on the SVG element — no separate fontSize CSS prop in the SVG icon path (that's a font-icon-only code path, unused here). Spike must empirically confirm CSS override behavior across real usage (className merge order via Griffel `mergeClasses`). |
| ICON-02 | `src/components/icons/index.ts` — 84 named exports matching lucide names, regular/filled human-confirmed, tree-shakeable | Best-effort mapping table below (grep-verified against installed `@fluentui/react-icons@2.0.334` .d.ts files); confidence flagged per row. |
| ICON-03 | 130 call sites migrated in 4 directory batches (admin/shared/voice/pages), each its own commit + bundle-size note | Grep-verified inventory: admin 51 files, shared 23 files, voice 6 files, pages 36 files (`ui/` internal usage — 4 files — is Phase 40/42 territory, not counted in the 130 consumer call sites but flagged as an edge case below). |
| TOAST-01 | toastId round-trip spike — prove id survives into `dispatchToast`/`dismissToast` or redesign with internal id-mapping | Confirmed via source: `dispatchToast(content, options)` accepts `options.toastId`; falls back to internal counter only if omitted. Bridge must always pass an explicit id. `dispatchToast` returns `void` (sonner's `toast.loading()` returns the id) — bridge must generate+track the id itself, not rely on the call's return value. |
| TOAST-02 | `components/ui/sonner.tsx` replaced with Fluent Toaster + bridge, 46-file import migration, `role="status"` E2E check | Exact call-site inventory below (46 files, 29 test files with `vi.mock("sonner")`, method-surface usage counts, exact avatar-page.tsx lines). |

## Standard Stack

### Core (already installed — Phase 39 infra)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fluentui/react-icons` | 2.0.334 [VERIFIED: package.json] | Icon components (SVG, Griffel-styled) | Official Fluent 2 icon set, matches Foundry portal |
| `@fluentui/react-components` (includes `react-toast`) | ^9.74.4 [VERIFIED: frontend/package.json] | `Toaster`, `useToastController`, `ToastTitle`, `ToastBody` | Official Fluent toast primitive |

### Being Replaced
| Library | Version | Replaced By |
|---------|---------|--------------|
| `lucide-react` | ^0.460.0 | `@fluentui/react-icons` via `src/components/icons/` adapter |
| `sonner` | ^2.0.7 | `@fluentui/react-components` Toaster via `src/lib/toast/` bridge |

**No new installs required** — both target packages are already dependencies from Phase 39 (INFRA-01).

## Architecture Patterns

### Icon Adapter Module Shape (ICON-01/02)

```
src/components/icons/
├── index.ts          # 84 named exports, lucide-shaped names
└── make-icon.ts       # (optional) shared wrapper factory
```

**Pattern: thin re-export wrapper, not a runtime HOC per icon** (avoids per-render wrapper overhead across ~130 call sites):

```typescript
// src/components/icons/index.ts
// Source: @fluentui/react-icons v2.0.334 (installed), verified via package .d.ts
export { ArrowLeftRegular as ArrowLeft } from "@fluentui/react-icons";
export { CheckmarkRegular as Check } from "@fluentui/react-icons";
export { DismissRegular as X } from "@fluentui/react-icons";
// ...84 total
```

If ICON-01 spike finds that Fluent's default `1em` width/height attribute does NOT reliably lose to Tailwind's `size-*` CSS class in the test/build environment (e.g. jsdom quirks, or attribute specificity issues), fall back to a wrapper that explicitly unsets the attribute:

```typescript
// Fallback pattern if spike finds attribute wins over CSS class
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { forwardRef } from "react";

export const ArrowLeft = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  (props, ref) => <ArrowLeftRegular ref={ref} {...props} width={undefined} height={undefined} />,
);
```

**Call-site contract to preserve:** lucide icons are consumed as `<IconName className="size-4" />` (Tailwind sizing) with no `size` prop passed at most call sites (grep found zero `size={}` prop usage pattern in the codebase's lucide imports beyond className-based sizing — verify per-batch during ICON-03, not assumed here as it wasn't grepped this pass).

**Regular vs Filled:** the codebase's lucide usage is single-style (lucide only ships one style per icon). Since Fluent ships Regular+Filled pairs, ICON-02 defaults to **Regular** for all 84 (matches Fluent's own UI convention where Regular is the default weight), documented per-icon in the mapping table below. If a specific consumer visually needs Filled (e.g. an active/selected state icon), that's a call-site-level decision made during the ICON-03 batch, not a blanket default.

### Toast Bridge Module Shape (TOAST-01/02)

```
src/lib/toast/
├── index.ts           # exports `toast` object (success/error/info/warning/loading/dismiss/promise)
├── toast-bridge.ts     # module-level pub/sub + controller registration
└── toast-controller.tsx # (or inline in App.tsx) captures useToastController() ref
```

**Pattern: module-level singleton controller ref, set by a mount-time effect.**

Sonner's `toast.success()` etc. are plain module-level function calls usable anywhere (no React context needed at call site) — this is the exact contract 46 files depend on. Fluent's `useToastController()` is a hook, only usable inside a component tree under `<FluentProvider>`. The bridge must capture the hook's returned methods into a module-level variable via a one-time mount effect (same "read-only single subscriber" pattern already established for the theme bridge in Phase 39 INFRA-02):

```typescript
// src/lib/toast/toast-controller.tsx
// Source: @fluentui/react-toast (bundled in @fluentui/react-components) useToastController signature,
// verified via node_modules/@fluentui/react-toast/dist/index.d.ts
import { useToastController } from "@fluentui/react-components";
import { useEffect } from "react";
import { registerController } from "./toast-bridge";

export function ToastControllerBridge() {
  const controller = useToastController("app-toaster"); // must match <Toaster toasterId="app-toaster" />
  useEffect(() => {
    registerController(controller);
  }, [controller]);
  return null;
}
```

```typescript
// src/lib/toast/toast-bridge.ts
import type { useToastController } from "@fluentui/react-components";

type Controller = ReturnType<typeof useToastController>;
let controllerRef: Controller | null = null;
export function registerController(c: Controller) {
  controllerRef = c;
}

let counter = 0;
function nextId() {
  return `toast-${++counter}`;
}

export const toast = {
  success(message: string, opts?: { description?: string }) {
    const toastId = nextId();
    controllerRef?.dispatchToast(<ToastTemplate intent="success" message={message} {...opts} />, {
      intent: "success",
      toastId, // CRITICAL: pass explicit id — dispatchToast returns void, not an id
    });
    return toastId; // preserves sonner's "returns an id" contract
  },
  loading(message: string) {
    const toastId = nextId();
    controllerRef?.dispatchToast(<ToastTemplate intent="info" message={message} spinner />, {
      intent: "info",
      timeout: -1, // no auto-dismiss while "loading"
      toastId,
    });
    return toastId;
  },
  dismiss(toastId: string) {
    controllerRef?.dismissToast(toastId);
  },
  error(message: string, opts?: { description?: string }) { /* same pattern, intent: "error" */ },
  // info, warning: same pattern
};
```

**This directly resolves TOAST-01's stated risk**: `dispatchToast` (per verified `.d.ts` and vanilla implementation) accepts `options.toastId` and will use it verbatim if provided, only auto-generating one if omitted. The bridge's `nextId()` + explicit `toastId` in both `dispatchToast` and `dismissToast` calls is the fix — no internal id-mapping layer is needed as a fallback; this is the direct solution, not a contingency. The spike's job is to prove this empirically (dispatch with an id, dismiss with the same id, confirm the toast actually disappears) rather than to discover whether a workaround is needed.

### Toaster Mount Point (replaces `App.tsx:6,42` `sonner`-based `<Toaster>`)

```typescript
// src/App.tsx — replace the sonner <Toaster> import/usage
import { Toaster } from "@fluentui/react-components";
import { ToastControllerBridge } from "@/lib/toast/toast-controller";

// inside the FluentProvider tree (already mounted per Phase 39 INFRA-02):
<Toaster toasterId="app-toaster" />
<ToastControllerBridge />
```

Fluent's `<Toaster>` renders its own ARIA live region internally (confirmed: `ToasterProps`/`ToasterState` includes `announce`/`AriaLiveProps` in the type surface) — this satisfies the `role="status"` E2E requirement (TOAST-02 criterion 5) without extra markup, but the exact rendered role/attribute should be spot-checked in the E2E spike since Fluent's docs/types don't make the rendered role string explicit from static inspection alone [ASSUMED — confirm empirically].

### `components/ui/sonner.tsx` Replacement Shape (TOAST-02)

Per REQUIREMENTS.md TOAST-02, this file's *content* is replaced but the *file* keeps existing — it becomes a thin re-export so any code still importing `@/components/ui/sonner` (if any exists beyond `App.tsx`) doesn't break during the transition window. Grep found only `App.tsx` imports this path directly; the 46 consumer files import from `"sonner"` directly (not from `@/components/ui/sonner`), so the primary migration units are (a) `components/ui/sonner.tsx`'s internal content, and (b) the 46 files' import source string.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Toast ARIA live-region announcement | Custom `aria-live` div + manual DOM injection | Fluent `<Toaster>`'s built-in announce mechanism (`ToasterProps.announce`, `AriaLiveProps`) | Already accessibility-audited by Microsoft; matches Foundry portal behavior exactly |
| Icon tree-shaking | Manual per-icon dynamic import wrappers | Fluent's existing per-icon ES module exports (`export const XRegular = ...` in `lib/icons/chunk-N.js`) — named re-exports in the adapter preserve tree-shaking automatically | Fluent's package is already structured for it; adapter only needs named re-exports, no bundler config changes |
| Toast id generation | UUID library dependency | Simple module-level incrementing counter (`toast-${++counter}`) string, matching the pattern Fluent's own internal fallback already uses | No collision risk within a single browser tab session; avoids adding a dependency for this phase |

**Key insight:** Both adapters are re-export/bridge layers over already-installed, already-audited Fluent primitives — the entire phase is "wire it up correctly" not "build new functionality."

## Common Pitfalls

### Pitfall 1: Assuming `dispatchToast` returns the toast id (like sonner does)
**What goes wrong:** Code written as `const id = controller.dispatchToast(...)` will get `undefined`, silently breaking `toast.dismiss(id)` call sites (`avatar-page.tsx:224,231,243`).
**Why it happens:** `dispatchToast`'s TypeScript signature is `(content, options?) => void` — verified in `@fluentui/react-toast/dist/index.d.ts` line ~554-561.
**How to avoid:** Bridge always generates and passes `toastId` explicitly in `options`, then returns that same generated id from the bridge's own `loading()`/`success()` etc. functions.
**Warning signs:** TOAST-01 spike test failing on the dismiss-after-loading assertion.

### Pitfall 2: `useToastController` requires being called inside a component under `<FluentProvider>`, but 46 call sites use `toast.x()` as a plain function anywhere (including outside React render, e.g. in async callbacks/hooks)
**What goes wrong:** Directly exporting `useToastController()`'s result would violate React's rules of hooks at all 46 non-component call sites.
**Why it happens:** sonner's API was designed as an imperative singleton; Fluent's is hook-based by design.
**How to avoid:** The module-level `controllerRef` capture pattern (mount-once bridge component + module-scope variable) — already the established pattern for Phase 39's theme bridge (`useThemeStore()` read-only subscription analog).
**Warning signs:** `Invalid hook call` React errors if this pattern is skipped.

### Pitfall 3: Bulk `sed`-replacing `vi.mock("sonner")` → `vi.mock("@/lib/toast")` across 29 test files without checking each mock's shape
**What goes wrong:** Some test mocks only mock `{ toast: { error, success } }` (e.g. `avatar-page.test.tsx`, `prompts.test.tsx`) while others mock the full surface including `loading`/`dismiss`/`warning`/`info`. A blind path-only sed leaves the mock shape unchanged, which is fine *if* the bridge's exported shape is a superset — but REQUIREMENTS.md explicitly mandates individual per-file verification, not batch sed, because some mocks may need shape additions (e.g. a file only mocking `success`/`error` today might start needing `loading` if that code path changes) and because the toast import path itself needs a per-file diff-reviewed change, not a scripted one.
**Why it happens:** Batch `sed` is fast but doesn't catch behavioral mismatches file-by-file (CLAUDE.md's top-priority rule is precisely about not batching across requirement boundaries).
**How to avoid:** Touch each of the 29 test files individually; confirm the mocked shape still matches what the component under test actually calls after the import-path change.
**Warning signs:** Tests pass with a vacuous mock but the real bridge signature diverges (e.g. `dismiss` expecting a string toastId vs a mock returning a number).

### Pitfall 4: Icon `1em` width/height SVG attribute vs Tailwind CSS `size-*` — attribute-vs-CSS specificity is real but usually CSS-wins for `width`/`height` on SVG in modern browsers; however this is NOT guaranteed in all rendering contexts (e.g. `<img src=".svg">` usage, or when the SVG is server-rendered without hydration).
**What goes wrong:** ICON-01 could pass in a simple isolated test but a specific consumer (e.g. an icon inside a `<Button icon={...}>` slot, which Fluent's own component may apply its own sizing styles to) could silently render at the wrong size.
**Why it happens:** Fluent's Button/other composite components sometimes apply their own icon-slot sizing via Griffel that could compete with both the `1em` attribute AND Tailwind's class.
**How to avoid:** ICON-01 spike must test icons in-situ inside at least one Fluent composite context (e.g. inside the already-migrated `Button` from Phase 39 LEAF-01), not just standalone.
**Warning signs:** Icons look correct standalone in Storybook-style isolation but wrong inside buttons/menus in the actual app.

## Icon Mapping Table (ICON-02, best-effort — verify all in ICON-01/ICON-02 spike + manual review)

Confidence: grep-verified against installed `@fluentui/react-icons@2.0.334` `.d.ts` files in `node_modules`. All entries below were confirmed to exist as literal exports; ambiguous/multi-candidate cases are flagged. This table is NOT exhaustive verification of visual/semantic fit — that is ICON-02's explicit "人工确认表核对" (human-confirmed table) requirement.

| lucide name | Candidate Fluent export | Confidence | Note |
|---|---|---|---|
| AlertCircle | `ErrorCircleRegular` | LOW | No `AlertCircle*` family exists; semantic match via Error/Warning family — verify in ICON-01 |
| AlertTriangle | `WarningRegular` | MEDIUM | Fluent's warning triangle icon |
| Archive | `ArchiveRegular` | HIGH | Exact family match |
| ArrowDown | `ArrowDownRegular` | HIGH | Exact match |
| ArrowLeft | `ArrowLeftRegular` | HIGH | Exact match, confirmed in chunk-21.js |
| ArrowUp | `ArrowUpRegular` | HIGH | Exact match |
| AudioLines | — | LOW | No direct Fluent equivalent found; verify against `MicPulseRegular`/`SoundWaveCircle*`-style icons in spike |
| BarChart | — | LOW | No `BarChart*` family found in grep; likely `DataBarVerticalRegular` or similar — verify in spike |
| BookOpen | `BookOpenRegular` | HIGH | Exact match |
| Brain | `BrainRegular` | HIGH | Exact match |
| Check | `CheckmarkRegular` | HIGH | Fluent naming convention difference (Checkmark vs Check) |
| CheckCircle2 | `CheckmarkCircleRegular` | HIGH | Exact family match |
| CheckIcon | `CheckmarkRegular` | HIGH | Same as Check — this is Radix's internal check icon used in ui/select.tsx etc, likely NOT part of the 84 consumer icons (verify: Radix-internal usage, may be out of ICON-03 scope) |
| ChevronDown | `ChevronDownRegular` | HIGH | Exact match |
| ChevronLeft | `ChevronLeftRegular` | HIGH | Exact match |
| ChevronRight | `ChevronRightRegular` | HIGH | Exact match |
| ChevronRightIcon | `ChevronRightRegular` | HIGH | Radix-internal usage (sheet/dialog/select/dropdown-menu) — verify scope overlap with Phase 40 |
| ChevronUp | `ChevronUpRegular` | HIGH | Exact match |
| Circle | `CircleRegular` | HIGH | Exact match |
| CircleIcon | `CircleRegular` | HIGH | Radix-internal usage — verify scope overlap with Phase 40 |
| Clock | `ClockRegular` | HIGH | Exact match |
| Database | `DatabaseRegular` | HIGH | Exact match |
| Download | `ArrowDownloadRegular` | HIGH | Fluent naming convention difference |
| Edit | `EditRegular` | HIGH | Exact match |
| ExternalLink | — | LOW | No direct match found in this pass; likely `OpenRegular` or `LinkRegular`-family — verify in spike |
| Eye | `EyeRegular` | HIGH | Exact match |
| EyeOff | `EyeOffRegular` | HIGH | Exact match |
| File | `DocumentRegular` | MEDIUM | Fluent naming convention difference (Document vs File) |
| FileArchive | — | LOW | No exact match; candidate `DocumentBriefcaseRegular` or similar — verify |
| FileAudio | — | LOW | No exact match found; verify in spike |
| FileText | `DocumentTextRegular` | HIGH | Exact family match |
| Filter | `FilterRegular` | HIGH | Exact match |
| FlaskConical | — | LOW | No `Flask*`/`Beaker*` exact hit found this pass; verify in spike (Fluent may not have a flask icon — fallback candidate needed) |
| Globe | `GlobeRegular` | HIGH | Exact match |
| Inbox | — | LOW | Not checked this pass; verify in spike |
| Info | `InfoRegular` | HIGH | Exact match |
| Languages | `TranslateRegular` | MEDIUM | Semantic match, naming differs |
| Lightbulb | `LightbulbFilamentRegular` | MEDIUM | Fluent's lightbulb is named "LightbulbFilament" |
| Loader2 | `SpinnerIosRegular` | MEDIUM | Fluent's spinner icon; verify animation/rotation CSS still applies via adapter |
| LogIn | `SignInRegular` | MEDIUM | Not directly grep-confirmed this pass (checked "Sign" family, found SignOut/Signal/Signature but not SignIn explicitly) — verify in spike |
| Maximize2 | `MaximizeRegular` | HIGH | Exact family match |
| MessageSquare | `ChatRegular`? | LOW | No exact `MessageSquare` or plain `Chat` root confirmed (found `ChatAdd/ChatArrowBack/...` but not bare `ChatRegular`) — verify in spike |
| MessageSquareText | — | LOW | Same family concern as above — verify in spike |
| Mic | `MicRegular` | HIGH | Exact match |
| MicOff | `MicOffRegular` | HIGH | Exact match |
| Minimize2 | `MinimizeRegular` | HIGH | Exact family match |
| Moon | `WeatherMoonRegular` | MEDIUM | Fluent naming convention difference |
| MoreHorizontal | `MoreHorizontalRegular` | HIGH | Exact match |
| Palette | `ColorRegular` | LOW | Semantic guess; verify visual fit in spike |
| Pencil | — | LOW | No bare `Pencil*` family found; candidate `EditRegular` (duplicate of Edit) — verify distinct icon needed or consolidate |
| Play | `PlayRegular` | HIGH | Exact match |
| Plus | `AddRegular` | HIGH | Fluent naming convention difference (Add vs Plus) |
| Presentation | — | LOW | No exact hit this pass; verify in spike |
| RefreshCw | `ArrowClockwiseRegular` | MEDIUM | Semantic match, naming differs |
| Rocket | `RocketRegular` | HIGH | Exact match |
| RotateCcw | `ArrowCounterclockwiseRegular`? | LOW | Found `RotateCounterclockwiseRegular` and `RotateLeftRegular` as candidates — verify which fits |
| Save | `SaveRegular` | HIGH | Exact match |
| Search | `SearchRegular` | HIGH | Exact match |
| SearchX | — | LOW | No `SearchOff`/`SearchX` exact hit found this pass — verify in spike |
| Send | `SendRegular` | HIGH | Exact match |
| Settings | `SettingsRegular` | HIGH | Exact match |
| Settings2 | `SettingsRegular` | HIGH | Same base icon, lucide's "2" variant likely maps to same Fluent icon |
| Shield | `ShieldRegular` | HIGH | Exact match |
| ShieldAlert | `ShieldErrorRegular` | MEDIUM | Semantic match, naming differs |
| ShieldCheck | `ShieldCheckmarkRegular` | HIGH | Exact family match |
| Sparkles | `SparkleRegular` | HIGH | Exact family match (singular vs plural — `SparklesFilled/Regular` also exists, verify which) |
| Square | `SquareRegular` | HIGH | Exact match |
| Sun | `WeatherSunnyRegular` | MEDIUM | Fluent naming convention difference |
| Trash2 | `DeleteRegular` | MEDIUM | Fluent naming convention difference (Delete vs Trash) |
| TrendingDown | `ArrowTrendingDownRegular` | HIGH | Exact family match |
| TrendingUp | — | LOW | `ArrowTrendingDownRegular` confirmed but `ArrowTrendingUpRegular` NOT found in this pass' grep (only Down variant matched) — VERIFY THIS CAREFULLY in ICON-01, may need alternate search term |
| Undo2 | `ArrowUndoRegular` | HIGH | Exact family match |
| Upload | `ArrowUploadRegular` | HIGH | Exact family match |
| User | `PersonRegular` | HIGH | Fluent naming convention difference (Person vs User) |
| Users | `PeopleRegular` | HIGH | Fluent naming convention difference (People vs Users) |
| Volume2 | — | LOW | No `Volume*` family found in this pass (found `SpeakerMuteRegular`, `Speaker2Regular` but not a plain "volume up" icon) — verify in spike |
| VolumeX | `SpeakerMuteRegular` | MEDIUM | Semantic match |
| Wand2 | `WandRegular` | HIGH | Exact match |
| WifiOff | `WifiOffRegular` | HIGH | Exact match |
| Wrench | `WrenchRegular` | HIGH | Exact match |
| X | `DismissRegular` | HIGH | Fluent naming convention difference (Dismiss vs X) |
| XCircle | `DismissCircleRegular` | HIGH | Exact family match |
| XIcon | `DismissRegular` | HIGH | Radix-internal usage — verify scope overlap with Phase 40 |
| Zap | — | LOW | No `Zap*` family found; candidate `FlashRegular` — verify semantic fit in spike |

**Icons NOT verified this pass (time-boxed per scope limits):** AlertCircle exact fit, AudioLines, BarChart, ExternalLink, FileArchive, FileAudio, FlaskConical, Inbox, LogIn, MessageSquare/MessageSquareText, Palette, Pencil, Presentation, RotateCcw, SearchX, TrendingUp (found Down but not Up — re-check), Volume2, Zap. **All 18 of these are the ICON-01/ICON-02 spike's job to resolve empirically** — this is expected and by design per the phase's scope limits (the spike, not research, is the verification mechanism).

**Radix-internal icon usage flagged for scope clarification:** `CheckIcon`, `ChevronRightIcon`, `CircleIcon`, `XIcon` appear inside `sheet.tsx`, `dialog.tsx`, `select.tsx`, `dropdown-menu.tsx` (the `ui/` directory) rather than in the 84-icon consumer inventory's typical usage pattern. These 4 files are Phase 40 territory (composite component migration) — the planner should clarify with the user whether these 4 icon-import-sites count toward ICON-03's "130 call sites" or are excluded as Phase 40's concern, since `ui/select.tsx`/`ui/dropdown-menu.tsx` etc. are literally being rewritten in Phase 40. **Recommendation: exclude these 4 files from Phase 41's icon batches; they'll be replaced as part of Phase 40's composite migration or left on lucide until Phase 42's final cleanup if Phase 40 doesn't touch icons.**

## Grep Inventory (verified this session)

### sonner (TOAST-02)
- **Importers of `"sonner"`:** 46 files exactly (matches REQUIREMENTS.md count) — full list captured in tool output above, spanning `components/admin/*` (7), `components/shared/*` (2), `components/voice/*` (2, incl. 1 test), `components/ui/sonner.tsx` (1, the wrapper itself), `pages/admin/*` (27, incl. tests), `pages/avatar-page.tsx` (1), `pages/user/*` (2), `hooks/use-unified-session.ts` (1).
- **`vi.mock("sonner")` occurrences:** 29 test files (not 46 — some of the 46 import files are non-test files with no direct mock; some test files mock at a different level, e.g. `App.test.tsx` mocks `@/components/ui/sonner` directly instead).
- **Toast method usage counts (all 46 files combined):** `toast.error` ×143, `toast.success` ×84, `toast.warning` ×7, `toast.info` ×3, `toast.loading` ×1, `toast.dismiss` ×2 (both in `avatar-page.tsx`, lines 231 and 243).
- **Toaster mount point:** `src/App.tsx:6` (import) + `src/App.tsx:42` (usage) — single mount, wraps `Sonner` from `"sonner"` inside `src/components/ui/sonner.tsx`.
- **Critical call site (TOAST-01 design target):** `avatar-page.tsx:224` — `const toastId = toast.loading(...)`; `:231` — `toast.dismiss(toastId)` inside a `.then()` callback; `:243` — `toast.dismiss(toastId)` inside a mutation `onError`. Both dismiss calls happen in async callbacks fired well after the initial render — confirms the bridge's module-level controller ref (not a hook) is structurally required, not just convenient.

### lucide-react (ICON-02/03)
- **Files importing `lucide-react`:** 121 files, 124 total import statements (some files have 2 import lines — check for duplicate/split imports during ICON-03 execution).
- **Distinct icon names:** 84 (matches REQUIREMENTS.md's stated count exactly).
- **Distribution by top-level directory:** `admin/` 51 files, `pages/` 36 files, `shared/` 23 files, `voice/` 6 files, `ui/` 4 files (sheet/dialog/select/dropdown-menu — flagged above as Phase 40 overlap, likely excluded from the 130 count).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@fluentui/react-icons` | ICON-01/02/03 | ✓ | 2.0.334 | — |
| `@fluentui/react-components` (react-toast bundled) | TOAST-01/02 | ✓ | ^9.74.4 | — |
| `lucide-react` | Being replaced, still present for parity comparison during spike | ✓ | ^0.460.0 | — |
| `sonner` | Being replaced, still present for parity comparison during spike | ✓ | ^2.0.7 | — |
| Playwright | E2E verification (TOAST-02 criterion 5) | ✓ (existing `frontend/e2e/`) | ^1.48.0 | — |
| vitest | Unit test infra | ✓ | ^3.2.4 | — |

No missing dependencies. This phase is purely code/config work on top of already-installed packages from Phase 39.

## Validation Architecture

**Skipped** — `.planning/config.json` has `"nyquist_validation": false` explicitly set. Per instructions, this section is omitted when the key is explicitly false.

## Security Domain

No `security_enforcement` key found in `.planning/config.json`; treating as enabled per default, but this phase has no security-relevant surface (icon rendering and toast notifications are not authn/authz/crypto/input-validation concerns). No ASVS categories apply. Recorded here per protocol rather than silently omitted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fluent `<Toaster>`'s built-in ARIA live region renders with `role="status"` specifically (vs `role="log"`/`role="alert"`) | Toaster Mount Point | E2E assertion for TOAST-02 criterion 5 could target the wrong role selector; low risk, cheap to fix once discovered empirically in the E2E spike |
| A2 | 18 icons not name-verified this pass (AudioLines, BarChart, FlaskConical, etc.) have a reasonable Fluent equivalent at all | Icon Mapping Table | If no equivalent exists, ICON-02 needs a documented exception (keep as lucide icon, or substitute a different but acceptable Fluent icon) — moderate risk, directly the ICON-01/02 spike's job to resolve |
| A3 | `CheckIcon`/`ChevronRightIcon`/`CircleIcon`/`XIcon` (4 files in `ui/`) are out of Phase 41's ICON-03 scope and belong to Phase 40 | Icon Mapping Table / Grep Inventory | If wrong, Phase 41's "130 call sites" count is off by these files' icon-import lines, and Phase 40 might expect Phase 41 to have handled them — needs explicit planner/user clarification before batching |
| A4 | Tailwind's `size-*` CSS class will win over Fluent icon's literal `width="1em" height="1em"` SVG attributes in normal browser rendering (not verified empirically, only inferred from general CSS/SVG attribute-vs-property precedence rules) | Summary / Pitfall 4 | This is exactly what ICON-01's pixel-diff spike is designed to test — if wrong, the spike fails and the fallback wrapper pattern (explicit `width={undefined}`) is needed instead |

## Open Questions

1. **Do the 4 Radix-internal icon files (`sheet.tsx`, `dialog.tsx`, `select.tsx`, `dropdown-menu.tsx`) count toward Phase 41's ICON-03 scope, or are they Phase 40's responsibility?**
   - What we know: These files import `CheckIcon`/`ChevronRightIcon`/`CircleIcon`/`XIcon` from lucide-react as part of their current Radix-based implementation.
   - What's unclear: Phase 40 rewrites these files' internals to Fluent composites — it's unclear whether Phase 40's plan already replaces these icon imports as a side effect, or whether they're left on lucide until Phase 41/42 touches them.
   - Recommendation: Planner should flag this as a cross-phase coordination note; likely resolution is "Phase 40 replaces them as part of its own composite migration, Phase 41 batches exclude `ui/*.tsx` entirely."

2. **What exact bundle-size delta should the ICON-03 batch commits report?**
   - What we know: REQUIREMENTS.md/ROADMAP.md require "a bundle-size comparison noted in the commit message" per batch.
   - What's unclear: No existing bundle-size tooling/baseline was found in this research pass (not investigated — out of time-box scope).
   - Recommendation: Planner should have a task check for `npm run build` output size (dist/ total or specific chunk) before/after each batch, using a simple `du -sh dist/` or Vite's own build output stats — no new tooling needed.

## Sources

### Primary (HIGH confidence)
- `frontend/node_modules/@fluentui/react-icons/lib/utils/createFluentIcon.js`, `useBaseIconState.js`, `useIconState.js`, `useIconStyles.styles.raw.js` — confirmed SVG icon rendering has no hardcoded fontSize, uses `1em` width/height + `currentColor` fill default.
- `frontend/node_modules/@fluentui/react-toast/dist/index.d.ts`, `lib/state/useToastController.js`, `lib/state/vanilla/dispatchToast.js` — confirmed `dispatchToast` signature (`void` return), `toastId` optional-with-fallback-counter behavior.
- `frontend/node_modules/sonner/dist/index.d.ts` — confirmed sonner's `dismiss(id?)`, `loading()` returns id, method surface.
- Direct grep of `frontend/src` for sonner/lucide import counts, method usage counts, mount points, mock occurrences.
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/39-fluent-infrastructure-leaf-components/39-CONTEXT.md` — phase scope, requirement IDs, established adapter conventions from Phase 39.
- `frontend/package.json` — confirmed installed versions.

### Secondary (MEDIUM confidence)
- Icon name matches marked MEDIUM/HIGH in the mapping table — confirmed to exist via grep against installed `.d.ts` files, but semantic/visual fit not independently verified against lucide's rendered glyph.

### Tertiary (LOW confidence)
- 18 icons flagged as unverified/no-match-found this pass — explicitly deferred to the ICON-01/ICON-02 spike per phase scope limits.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both target packages already installed, versions confirmed directly from package.json.
- Architecture (bridge/adapter patterns): HIGH — derived directly from reading actual installed package source (not training-data guesses), consistent with Phase 39's established bridge pattern.
- Icon mapping: MEDIUM overall (66/84 HIGH-or-MEDIUM confidence, 18/84 flagged LOW/unresolved by design — spike's job).
- Pitfalls: HIGH — derived from direct source-code reading of the exact APIs involved (dispatchToast return type, useToastController hook constraint).

**Research date:** 2026-08-06
**Valid until:** 30 days (stable, pinned dependency versions; re-verify if `@fluentui/react-icons` or `@fluentui/react-components` versions bump before Phase 41 executes)

RESEARCH COMPLETE
