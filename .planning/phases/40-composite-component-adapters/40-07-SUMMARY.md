# 40-07 SUMMARY — Migrate DropdownMenu to Fluent UI (COMP-04)

**Status:** ✅ Complete
**Commit:** `3f777cf` — `feat(40-07): migrate DropdownMenu to Fluent UI and add theme-picker E2E coverage`
**Requirement:** [COMP-04] DropdownMenu adapter

## What was done

Replaced the Radix `DropdownMenuPrimitive.*` implementation of
`frontend/src/components/ui/dropdown-menu.tsx` with a Fluent UI v9
`Menu`-family adapter. All **15 named exports**, prop signatures, and
`data-slot` attributes are preserved so every consumer works unchanged:

- `DropdownMenu`, `DropdownMenuPortal`, `DropdownMenuTrigger`,
  `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuLabel`,
  `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`,
  `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`,
  `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`.

### Key design decisions

1. **Lifted checked-state model.** Fluent's `checkedValues: Record<string,
   string[]>` + `onCheckedValueChange` live on the `Menu` **root** (not
   `MenuList`, which triggers a Fluent warning). A registry owned by
   `DropdownMenu`, populated via `MenuCheckedContext` by each checkbox/radio
   item's `useEffect`, is the single source of truth — items never track their
   own checked boolean independently (research anti-pattern avoided).
2. **`onSelect` parity.** Fluent's `MenuItem` has **no `onSelect` prop** (only
   `onClick`); Radix's `DropdownMenuItem` uses `onSelect(event)`. Added
   `onSelect?: (event: Event) => void` to `DropdownMenuItemProps` and routed it
   through an `onClick` handler that fires both `onClick?.(event)` and
   `onSelect?.(event.nativeEvent)`. This fixed a regression in
   `persona-switcher.tsx`, the only consumer relying on `onSelect`.
3. **`asChild` trigger shim** via `isSingleRefCapableElement` — clones the
   caller's Fluent `Button` as the `MenuTrigger` child (theme-picker pattern)
   with no duplicate-handler collision, `forwardRef` on the trigger.

## Verification evidence

| Gate | Result |
|------|--------|
| `dropdown-menu.test.tsx` | **12/12 pass** (7 legacy + checkbox independence, radio mutual exclusivity, submenu, forwardRef, asChild collision-free) |
| Consumer `persona-switcher.test.tsx` | pass (onSelect regression fixed) |
| Coverage — statements | 87.33% (threshold 71) ✓ |
| Coverage — branches | 83.91% (threshold 82) ✓ |
| Coverage — functions | 73.77% (threshold 70) ✓ |
| Coverage — lines | 87.33% (threshold 71) ✓ |
| `dropdown-menu.tsx` (now non-excluded) | **97.05% lines, 93.33% funcs, 80% branches** |
| `npx tsc -b` | exit 0 (clean) |
| `npm run build` | success (4.98s) |
| E2E `theme-picker.spec.ts` | **5/5 pass** (open → select accent → dark/light toggle) |

### Regression analysis (full-suite failures)

The full `--coverage` run reported 25 failing tests across 7 files
(dry-run-report, hcp-profile-editor, persona-editor, prompts,
training-materials, training, user-pages). **None import DropdownMenu**, and all
were proven NOT to be caused by 40-07:

- **Contention flakes** (pass in isolation): persona-editor (45/45),
  training-materials (33/33), prompts (8/8).
- **Pre-existing on pristine HEAD** (`git stash` + isolated re-run on 3a5715e —
  identical failures): training (9), hcp-profile-editor (6), user-pages (2),
  dry-run-report (1). These match the documented Phase 39 Fluent
  `Tabs`/`Input` duplicate-text-node baseline (`fui-Tab__content--reserved-space`
  spans, "Found multiple elements") + the prompts userEvent-typing race.

The 5 DropdownMenu consumers (persona-knowledge-section, scenario-table,
knowledge-tab, skill-card, persona-switcher) are all clean.

## Files changed (single COMP-04 commit)

- `frontend/src/components/ui/dropdown-menu.tsx` — Fluent adapter
- `frontend/src/components/ui/dropdown-menu.test.tsx` — 12 unit tests
- `frontend/vitest.config.ts` — removed `dropdown-menu.tsx` from coverage exclude
- `frontend/e2e/theme-picker.spec.ts` — new E2E coverage

## Next

40-08 — ScrollArea adapter (final plan of Phase 40).
