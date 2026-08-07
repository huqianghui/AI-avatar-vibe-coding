import * as React from "react";

/**
 * Shared Phase 40 copy of the `isSingleRefCapableElement` guard first
 * established by Phase 39's `button.tsx` (LEAF-01, lines 54-67). Extracted
 * here so every Phase 40 composite that needs an `asChild`-equivalent
 * `cloneElement` shim (Sheet, DropdownMenu triggers) reuses one
 * implementation instead of copy-pasting it 3-4 times (research Pitfall 5 /
 * Assumption A2).
 *
 * `button.tsx` itself is intentionally left unmodified -- it is out of this
 * plan's `files_modified` scope and Phase 39 already shipped/committed it.
 */
export function isSingleRefCapableElement(
  children: React.ReactNode,
): children is React.ReactElement<{ className?: string }> {
  if (!React.isValidElement(children)) {
    return false;
  }
  // A Fragment is itself a valid element but cannot accept a ref, and its
  // children are not addressable as a single cloneElement target -- reject it
  // explicitly (Pitfall 16: multi-child asChild, e.g. <>{<span/>}{<span/>}</>).
  if (children.type === React.Fragment) {
    return false;
  }
  return true;
}
