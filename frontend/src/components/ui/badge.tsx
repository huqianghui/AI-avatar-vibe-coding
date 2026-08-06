import * as React from "react";
import {
  Badge as FluentBadge,
  mergeClasses,
  type BadgeProps as FluentBadgeProps,
} from "@fluentui/react-components";

import { useBadgeDestructiveStyles } from "./badge.styles";

/**
 * shadcn-compatible `variant` union, preserved verbatim from the pre-migration
 * `cva()` definition so every existing call site keeps compiling with the exact
 * same prop values (LEAF-02). `success` has no Button equivalent -- Badge-only.
 */
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success";

/**
 * variant -> Fluent (color, appearance) two-axis lookup table (FEATURES.md's
 * verified mapping; not a rename -- Fluent Badge has a genuinely different,
 * two-axis appearance system compared to Button's single `appearance` axis).
 */
const VARIANT_MAP: Record<
  BadgeVariant,
  { color: FluentBadgeProps["color"]; appearance: FluentBadgeProps["appearance"] }
> = {
  default: { color: "brand", appearance: "filled" },
  secondary: { color: "informative", appearance: "tint" },
  destructive: { color: "danger", appearance: "filled" },
  outline: { color: "subtle", appearance: "outline" },
  success: { color: "success", appearance: "filled" },
};

export interface BadgeProps extends Omit<React.ComponentPropsWithoutRef<"span">, "color"> {
  variant?: BadgeVariant;
}

/**
 * Fluent-backed adapter for the legacy shadcn `Badge`. Follows the pattern
 * established by Button (Plan 02): a variant mapping table plus an isolated
 * Griffel override file for the one variant (`destructive`) that needs a
 * byte-identical color Fluent's built-in palette doesn't provide.
 */
function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const destructiveStyles = useBadgeDestructiveStyles();
  const { color, appearance } = VARIANT_MAP[variant];
  const isDestructive = variant === "destructive";

  return (
    <FluentBadge
      data-slot="badge"
      color={color}
      appearance={appearance}
      className={mergeClasses(isDestructive ? destructiveStyles.root : undefined, className)}
      {...props}
    />
  );
}

export { Badge };
