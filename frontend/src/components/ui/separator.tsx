import * as React from "react";
import { Divider as FluentDivider, mergeClasses } from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy Radix `Separator`. Not a rename --
 * Fluent's equivalent component is named `Divider` (FEATURES.md row 7).
 * Radix's `decorative` (controls `aria-hidden`/`role="none"` vs
 * `role="separator"`) has no direct Fluent prop; Fluent's `Divider` always
 * renders `role="separator"`. Kept as a no-op accepted prop for call-site
 * compatibility (no consumer currently passes it non-default).
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative: _decorative = true,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  return (
    <FluentDivider
      data-slot="separator-root"
      data-orientation={orientation}
      vertical={orientation === "vertical"}
      className={mergeClasses(
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
