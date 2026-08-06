import { makeStyles } from "@fluentui/react-components";

/**
 * Griffel override for the Button `destructive` variant (D-04, 39-CONTEXT.md).
 *
 * Fluent's Button `appearance` enum (`secondary|primary|outline|subtle|transparent`)
 * has no built-in danger/destructive appearance. Rather than approximate with an
 * existing appearance, this pins the exact pre-migration colors extracted from
 * `button.tsx`'s former `cva()` destructive variant:
 *
 *   default:      "bg-destructive text-white hover:bg-destructive/90
 *                  focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40
 *                  dark:bg-destructive/60"
 *
 * `--destructive` itself is a CSS custom property (light: #EF4444, dark:
 * oklch(0.396 0.141 25.723), see `frontend/src/styles/index.css`) that already
 * cascades correctly through `:root`/`.dark` regardless of which styling engine
 * consumes it -- so referencing `var(--destructive)` here (rather than a hardcoded
 * hex) keeps this override in sync with theme-store's existing single source of
 * truth (per Pitfall 19's guidance: never hardcode around a token, reference it).
 *
 * The dark-mode opacity step (`dark:bg-destructive/60`) and hover opacity step
 * (`hover:bg-destructive/90`) are reproduced with `color-mix()` (the same function
 * Tailwind v4 itself generates for its own `/NN` opacity utilities, confirmed by
 * reading the built `dist/*.css` output during read_first) so the computed color is
 * byte-identical to the pre-migration Tailwind classes, not merely visually close.
 *
 * `:global(.dark)` is Griffel's ancestor-selector escape (compiled by its stylis
 * `globalPlugin` into `.dark <generated-class>`), matching how `theme-store.ts`
 * toggles `.dark` on `document.documentElement` -- an ancestor of every Button.
 */
export const useDestructiveStyles = makeStyles({
  root: {
    backgroundColor: "var(--destructive)",
    color: "#ffffff",
    ":hover": {
      backgroundColor: "color-mix(in oklab, var(--destructive) 90%, transparent)",
    },
    ":global(.dark)": {
      backgroundColor: "color-mix(in oklab, var(--destructive) 60%, transparent)",
    },
  },
});
