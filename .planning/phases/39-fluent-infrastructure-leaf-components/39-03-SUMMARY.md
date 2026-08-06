---
phase: 39-fluent-infrastructure-leaf-components
plan: 03
subsystem: ui
tags: [fluent-ui, griffel, badge, divider, skeleton, css-in-js, react18, testing]

requires:
  - phase: 39-fluent-infrastructure-leaf-components
    provides: "39-02: Button (frontend/src/components/ui/button.tsx) internally Fluent-backed, establishing the variant-mapping + isolated *.styles.ts Griffel-override adapter pattern"
provides:
  - "Badge (frontend/src/components/ui/badge.tsx) internally backed by Fluent UI's Badge, with a variant -> (color, appearance) two-axis lookup table covering all 5 pre-migration variants (default/secondary/destructive/outline/success), preserving exported name, props, and data-slot=\"badge\""
  - "badge.styles.ts: isolated Griffel makeStyles override reusing button.styles.ts's exact destructive-red values verbatim, so Badge's destructive variant stays pixel-identical to Button's"
  - "Separator (frontend/src/components/ui/separator.tsx) internally backed by Fluent UI's Divider (a rename, not a 1:1 API match), preserving exported name Separator, orientation/decorative props, and manually re-emitted data-orientation attribute for CSS/test compatibility"
  - "Skeleton (frontend/src/components/ui/skeleton.tsx) internally composed as Fluent Skeleton wrapping a single SkeletonItem, while keeping the original flat single-component call signature (no children required from consumers) and data-slot=\"skeleton\""
affects: [39-04, 39-05, 39-06, 39-07]

tech-stack:
  added: []
  patterns:
    - "Cross-component Griffel override reuse: badge.styles.ts's destructive override is intentionally NOT re-derived -- it copies button.styles.ts's exact CSS values verbatim (with a comment noting the shared source), keeping any future destructive-red change a two-file, not two-derivation, edit"
    - "Manual data-* attribute re-emission when a Fluent primitive drops a Radix data-attribute the codebase's own CSS/tests still key on (Separator's data-orientation has no Fluent Divider equivalent, so the adapter sets it explicitly rather than either dropping it or forcing a Tailwind rewrite)"
    - "Composing a Fluent 'wrapper + item' pair (Skeleton + SkeletonItem) behind a single flat exported component, forwarding the consumer's className to the inner SkeletonItem so its shape props (width/height Tailwind utilities) keep applying to the actual visible shimmering block"

key-files:
  created:
    - frontend/src/components/ui/badge.styles.ts
    - frontend/src/components/ui/badge.test.tsx
  modified:
    - frontend/src/components/ui/badge.tsx
    - frontend/src/components/ui/separator.tsx
    - frontend/src/components/ui/skeleton.tsx
    - frontend/src/components/ui/index.ts

key-decisions:
  - "[Phase 39]: 39-03: Badge's destructive Griffel override reuses button.styles.ts's exact color-mix()/var(--destructive) values instead of re-deriving them independently, since both plans require the same byte-identical red and re-deriving risks silent drift between the two components over time"
  - "[Phase 39]: 39-03: index.ts barrel export updated to drop the badgeVariants re-export (Rule 3 auto-fix -- zero external consumers found via repo-wide grep, mirroring the identical Button/buttonVariants precedent from 39-02); Badge's own asChild prop was also dropped since the pre-migration Radix Slot-based asChild had zero real call sites (grep confirmed) and Fluent Badge has no Slot equivalent -- no shim was needed"
  - "[Phase 39]: 39-03: Separator's data-orientation attribute is preserved via manual re-emission (data-orientation={orientation}) rather than letting Fluent Divider's native output stand, since the codebase's own Tailwind classes (data-[orientation=...]:) and all 4 pre-existing separator.test.tsx assertions depend on it and Fluent Divider has no built-in equivalent"

patterns-established:
  - "Griffel override value reuse across sibling components sharing the same design token (destructive red), rather than independent re-derivation per component"
  - "Manual data-* attribute re-emission as the standard technique when a Fluent primitive's native output drops a Radix-era attribute still depended on by existing CSS selectors or test assertions"

requirements-completed: [LEAF-02]

duration: 35min
completed: 2026-08-06
---

# Phase 39 Plan 03: Badge + Separator + Skeleton to Fluent UI Migration Summary

**Badge, Separator, and Skeleton are now internally backed by Fluent UI (Badge/Divider/Skeleton+SkeletonItem respectively), each with unchanged export signatures, `data-slot` contracts, and zero pre-existing test regressions across the full 225-file / 2824-test suite.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (Task 1: Badge; Task 2: Separator; Task 3: Skeleton)
- **Files modified:** 6 (2 rewritten in-place with no new test file needed, 1 rewritten with a new test file, 1 new styles file, 1 barrel-export edit)

## Accomplishments

- `badge.tsx` rewritten to wrap Fluent UI's `Badge`, with a `VARIANT_MAP` two-axis lookup table (`color` + `appearance`) covering all 5 pre-migration variants, including the Badge-only `success` variant (`{color: "success", appearance: "filled"}`) that has no Button equivalent.
- `badge.styles.ts` created: reuses `button.styles.ts`'s `useDestructiveStyles` Griffel override values verbatim (same `var(--destructive)`/`color-mix()` background, hover, and `:global(.dark)` steps) so Badge's `destructive` variant is pixel-identical to Button's, not merely visually close.
- `badge.test.tsx` created with 9 tests: all 5 variant mappings, the Griffel CSSOM destructive-color assertion (reusing Button's `document.styleSheets` → `cssRules` matching technique from 39-02), default-variant fallback, `data-slot="badge"` presence, and custom `className` passthrough.
- Confirmed via repo-wide grep that no consumer uses `Badge asChild` — the pre-migration Radix-`Slot`-based `asChild` prop was dropped entirely rather than shimmed, since Fluent Badge has no `Slot` equivalent and there was zero real usage to preserve.
- `separator.tsx` rewritten to wrap Fluent's `Divider` (a rename, not a 1:1 API — verified against FEATURES.md row 7), keeping the exported name `Separator`, `orientation`/`decorative` props, and manually re-emitting `data-orientation` (which Fluent Divider does not produce natively) so the codebase's `data-[orientation=...]:` Tailwind selectors and all 4 pre-existing `separator.test.tsx` assertions pass **unmodified** — no D-06 test rewrite was needed for this component.
- `skeleton.tsx` rewritten to internally compose `<Skeleton><SkeletonItem/></Skeleton>` from `@fluentui/react-components`, while the exported `Skeleton` remains a single flat component taking the same `className`/native-div props consumers already pass. All 4 pre-existing `skeleton.test.tsx` assertions (className passthrough, `animate-pulse` class, `data-slot`, no-crash render) pass unmodified.
- `index.ts` barrel export updated to drop the now-nonexistent `badgeVariants` re-export (mirrors the identical `buttonVariants` precedent from 39-02) — confirmed zero consumers via repo-wide grep.
- Full frontend test suite (225 files / 2824 tests) passes with zero regressions. `npx tsc -b` clean. `npm run build` succeeds.

## Task Commits

Each component was committed independently per D-07 (one-component-one-commit):

1. **Task 1: Badge migration (color+appearance lookup table)** - `012d2b0` (feat)
2. **Task 2: Separator migration (Divider rename adapter)** - `61bd13a` (feat)
3. **Task 3: Skeleton migration (Skeleton+SkeletonItem wrapper)** - `64fa8f5` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `frontend/src/components/ui/badge.tsx` — Fluent-backed `Badge`; `VARIANT_MAP` two-axis lookup table, `useBadgeDestructiveStyles()` Griffel hook wired via `mergeClasses`, `data-slot="badge"` preserved.
- `frontend/src/components/ui/badge.styles.ts` — new file; isolated Griffel `makeStyles` destructive override reusing `button.styles.ts`'s exact values verbatim.
- `frontend/src/components/ui/badge.test.tsx` — new file; 9 tests covering all variant mappings, the Griffel color match, default fallback, `data-slot`, and `className`.
- `frontend/src/components/ui/separator.tsx` — Fluent `Divider`-backed `Separator`; `orientation` mapped to `vertical` boolean, `data-orientation` manually re-emitted, `decorative` accepted as a no-op compat prop.
- `frontend/src/components/ui/skeleton.tsx` — Fluent `Skeleton`+`SkeletonItem`-backed `Skeleton`; single flat exported component, visual classes applied via `mergeClasses` on the outer `Skeleton`, `SkeletonItem` sized via `h-full w-full`.
- `frontend/src/components/ui/index.ts` — dropped `badgeVariants` re-export (deviation, see below); `Badge`/`Separator`/`Skeleton` re-exports unchanged.

## Decisions Made

- Badge's `asChild` prop was dropped (not shimmed) since zero real call sites exist — see Deviations below.
- Separator keeps re-emitting `data-orientation` manually rather than rewriting the 4 existing test assertions to an ARIA-equivalent, since Fluent Divider genuinely has no ARIA/data-attribute equivalent for orientation and the current tests/CSS selectors are cheaper and safer to preserve as-is (per D-06's spirit: prefer minimal-diff test preservation over unnecessary rewrites).
- Skeleton's consumer `className` is applied to the outer `Skeleton` wrapper (not the inner `SkeletonItem`) so `data-slot`, width/height Tailwind utilities, and `animate-pulse` all continue to land on the same DOM node existing tests and consumer styling expect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `index.ts` barrel export referenced dropped `badgeVariants` symbol**

- **Found during:** Task 1, immediately after rewriting `badge.tsx`
- **Issue:** The pre-migration `badge.tsx` exported a `cva()`-generated `badgeVariants` function, re-exported from `index.ts`. The Fluent-backed rewrite has no `cva()` step and produces no such function, so leaving the barrel export as-is would break `tsc -b`.
- **Fix:** Grepped the entire repo for `badgeVariants` usage outside `badge.tsx`/`index.ts` themselves — zero consumers found. Removed the `badgeVariants` re-export from `index.ts`, keeping only `export { Badge } from "./badge";`.
- **Files modified:** `frontend/src/components/ui/index.ts`
- **Commit:** `012d2b0` (included in the Badge commit, since `tsc -b` would fail without it — not deferrable to a separate commit)

**2. [Rule 3 - Blocking issue] Legacy string-ref type incompatibility with Fluent's `RefAttributes<HTMLDivElement>`**

- **Found during:** Task 1 (Badge) and Task 2 (Separator), running `npx tsc -b` after initial implementation
- **Issue:** Using `React.ComponentProps<"span">` / `React.ComponentProps<"div">` as the prop-spread source (rather than `ComponentPropsWithoutRef`) includes the legacy string-ref variant in the `ref` type, which is incompatible with Fluent's `RefAttributes<HTMLDivElement>` root-slot typing when spread via `{...props}`.
- **Fix:** Switched both `BadgeProps` and `Separator`'s inline prop type to `React.ComponentPropsWithoutRef<"span"|"div">`, which excludes the legacy string-ref union member and resolves cleanly against Fluent's slot types.
- **Files modified:** `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/separator.tsx`
- **Commit:** `012d2b0`, `61bd13a` respectively

**3. [Rule 2 - Missing critical functionality, scoped down] Badge's `asChild` prop dropped rather than shimmed**

- **Found during:** Task 1, reading the pre-migration `badge.tsx`
- **Issue:** The pre-migration Badge used `@radix-ui/react-slot`'s `Slot` for an `asChild` prop, same pattern as the pre-migration Button. Unlike Button (which has ~140 call sites and a confirmed `asChild` shim requirement), a repo-wide grep found **zero** `<Badge asChild>` call sites.
- **Fix:** Dropped the `asChild` prop entirely from the new `BadgeProps` interface rather than building a `cloneElement` shim for a prop nothing uses — avoids unnecessary complexity per the "no scope creep" principle. If a future consumer needs it, the same `cloneElement` shim pattern from `button.tsx` can be added at that time.
- **Files modified:** `frontend/src/components/ui/badge.tsx`
- **Commit:** `012d2b0`

---

**Total deviations:** 3 auto-fixed (2 blocking type-compat fixes, 1 scoped-down missing-feature decision)
**Impact on plan:** All three necessary for a clean `tsc -b` and to avoid unused-complexity scope creep. No visual or behavioral regression.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes introduced. This plan only changes internal rendering/styling of three existing pure-presentation leaf components (matches the plan's own threat register: T-39-05, disposition `accept`).

## Verification

- `npx vitest run src/components/ui/badge.test.tsx src/components/ui/separator.test.tsx src/components/ui/skeleton.test.tsx` → **17/17 passed**
- `npx vitest run` (full suite) → **225 files / 2824 tests passed** (zero regressions)
- `npx tsc -b` → clean
- `npm run build` → success
- Spot-checked real consumer test files that render/exercise these components: `status-badge.test.tsx`, `sub-state-badge.test.tsx`, `recommended-scenario.test.tsx`, `hcp-profile-card.test.tsx` (Badge), `conference-header.test.tsx` (Separator), `hcp-table.test.tsx`, `avatar-view.test.tsx`, `sources-panel.test.tsx`, `reports.test.tsx` (Skeleton) — all pass with zero modifications needed.
- Per orchestrator's explicit anti-stall guardrail: the full Playwright E2E suite was intentionally **not** run/monitored for this plan — Phase 39's E2E regression baseline was already established green in Plan 39-01, and this is a component-level change verified sufficiently by vitest + tsc + build.

## Self-Check: PASSED

- `frontend/src/components/ui/badge.tsx` — FOUND
- `frontend/src/components/ui/badge.styles.ts` — FOUND
- `frontend/src/components/ui/badge.test.tsx` — FOUND
- `frontend/src/components/ui/separator.tsx` — FOUND
- `frontend/src/components/ui/skeleton.tsx` — FOUND
- `frontend/src/components/ui/index.ts` — FOUND (modified)
- Commit `012d2b0` — FOUND in `git log`
- Commit `61bd13a` — FOUND in `git log`
- Commit `64fa8f5` — FOUND in `git log`

## Next Phase Readiness

Wave 3 continues with the remaining leaf components (39-04 through 39-07), reusing the cross-component Griffel-value-reuse and manual data-attribute re-emission patterns established here, on top of the variant-mapping-table and `*.styles.ts` conventions from 39-02.

---
*Phase: 39-fluent-infrastructure-leaf-components*
*Completed: 2026-08-06*
