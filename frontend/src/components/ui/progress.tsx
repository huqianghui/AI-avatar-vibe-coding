import * as React from "react";
import { ProgressBar as FluentProgressBar, mergeClasses } from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy Radix-based `Progress` (LEAF-05).
 *
 * Radix's/this codebase's public contract uses a **0-100** scale for `value`
 * (matching the pre-migration `translateX(-${100 - (value ?? 0)}%)` math);
 * Fluent's `ProgressBar` uses a **0-1 decimal** scale by default (`max`
 * defaults to `1`) -- per FEATURES.md/PITFALLS.md's Pitfall 13, a missed
 * division here silently renders a near-empty bar instead of crashing, so
 * this is the single highest-risk numeric-contract translation in Phase 39.
 *
 * Conversion chosen: divide the public 0-100 `value` by 100 before forwarding
 * to Fluent, leaving Fluent's `max` at its default of `1` (rather than
 * passing the raw 0-100 value through with an explicit `max={100}`) -- this
 * keeps the adapter's internal math self-contained and easy to unit-test
 * against a single well-known conversion (`value / 100`), and avoids a
 * second prop (`max`) that would need to stay in sync with the division if a
 * future caller ever wanted a non-100 external scale.
 *
 * `undefined` is forwarded as `undefined` (not `0`) so Fluent renders its own
 * indeterminate/busy animated state (Fluent's own contract: value omitted =
 * indeterminate) rather than a crashed or zero-width definite bar.
 */
export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "color"> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    const fluentValue = value === undefined ? undefined : value / 100;

    return (
      <FluentProgressBar
        ref={ref}
        data-slot="progress"
        value={fluentValue}
        className={mergeClasses(className)}
        {...props}
      />
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
