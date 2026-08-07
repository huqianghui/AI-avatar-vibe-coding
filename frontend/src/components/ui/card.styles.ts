import { makeStyles, tokens } from "@fluentui/react-components";

/**
 * Griffel token overrides for `Card` (COMP-06, 40-05-PLAN.md).
 *
 * Card's go/no-go decision (Option B, documented in 40-05-PLAN.md and
 * 40-RESEARCH.md's "Card (COMP-06)" section) is to KEEP the plain
 * `<div>`/`<h4>`/`<p>` structure from the original shadcn implementation
 * rather than adopt Fluent's real `Card` component, because Fluent's `Card`
 * bakes in selectable-list semantics (`selected`, `onSelectionChange`,
 * focus-ring-as-list-item) that don't match this codebase's usage (plain
 * content containers, zero selection-list usage).
 *
 * This file only layers Fluent design tokens on top of the existing
 * Tailwind-driven surface (border/background/radius/shadow), mirroring the
 * Phase 39 `button.styles.ts` precedent -- additive styling only, no
 * structural change and no Fluent `Card`/`CardPreview`/`CardHeader`
 * component imports.
 */
export const useCardStyles = makeStyles({
  root: {
    // NOTE: Griffel disallows the `borderColor` shorthand (see
    // https://aka.ms/griffel-css-shorthands) -- set each physical side's
    // color longhand individually instead of the shorthand.
    borderTopColor: tokens.colorNeutralStroke1,
    borderRightColor: tokens.colorNeutralStroke1,
    borderBottomColor: tokens.colorNeutralStroke1,
    borderLeftColor: tokens.colorNeutralStroke1,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow2,
  },
});
