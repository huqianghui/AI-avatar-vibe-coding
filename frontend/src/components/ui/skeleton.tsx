import * as React from "react";
import {
  Skeleton as FluentSkeleton,
  SkeletonItem,
  mergeClasses,
} from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy plain-`<div>` `Skeleton`. Fluent splits
 * this into a wrapper `Skeleton` (shimmer animation/aria-label) and a
 * `SkeletonItem` (the actual shaped block) -- this adapter composes the two
 * internally while exposing the exact same flat, single-component call
 * signature (`<Skeleton className="h-4 w-32" />`) consumers already use
 * (FEATURES.md row 8). `data-slot="skeleton"` stays on the outer element.
 */
function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <FluentSkeleton
      data-slot="skeleton"
      className={mergeClasses("bg-accent animate-pulse rounded-md", className)}
      {...props}
    >
      <SkeletonItem className="h-full w-full" />
    </FluentSkeleton>
  );
}

export { Skeleton };
