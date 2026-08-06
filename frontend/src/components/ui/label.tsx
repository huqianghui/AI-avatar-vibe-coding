import * as React from "react";
import { Label as FluentLabel, mergeClasses } from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy Radix `Label` (LEAF-03). Unlike
 * Input/Textarea, Fluent's `Label` root slot IS the native `<label>`
 * element directly (no wrapper `<div>`/`<span>` -- see `LabelSlots.root:
 * Slot<'label'>` in the shipped `.d.ts`), so there is no Pitfall 20
 * ref-forwarding-target concern here; `htmlFor` passes straight through as
 * a native attribute.
 */
function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    <FluentLabel
      data-slot="label"
      className={mergeClasses(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
