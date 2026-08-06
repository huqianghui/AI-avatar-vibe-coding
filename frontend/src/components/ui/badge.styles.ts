import { makeStyles } from "@fluentui/react-components";

/**
 * Griffel override for the Badge `destructive` variant (mirrors D-04 / 39-CONTEXT.md,
 * applied here per the plan's discretion clause since Badge variants were not
 * explicitly locked in CONTEXT.md decisions).
 *
 * Fluent Badge's `color="danger"` uses Fluent's own built-in danger palette token,
 * NOT this codebase's `var(--destructive)` custom property -- so it does not render
 * byte-identical to the pre-migration red. Rather than accept the approximation,
 * this reuses the EXACT same override values already extracted (verbatim from the
 * production Tailwind build output) in `button.styles.ts`'s `useDestructiveStyles`,
 * so Badge's destructive variant and Button's destructive variant stay pixel-identical.
 *
 * Kept in sync with `button.styles.ts` -- if that file's values ever change, mirror
 * the change here too.
 */
export const useBadgeDestructiveStyles = makeStyles({
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
