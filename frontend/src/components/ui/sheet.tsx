import * as React from "react";
import {
  OverlayDrawer,
  DrawerBody,
  mergeClasses,
  type DialogOpenChangeData,
  type DialogOpenChangeEvent,
} from "@fluentui/react-components";
import { XIcon } from "lucide-react";

import { isSingleRefCapableElement } from "./_shim-as-child";

/**
 * Fluent-backed adapter for the legacy Radix-based `Sheet` (COMP-02).
 *
 * Preserves all 8 pre-migration named exports and all 8 `data-slot` values so
 * the sole consumer, `avatar-page.tsx`'s bottom sheet at lines ~430-449,
 * keeps compiling and rendering identically.
 *
 * Fluent's `OverlayDrawer` has no separate "Root" primitive analogous to
 * Radix's `SheetPrimitive.Root` -- `OverlayDrawer` itself is the controlled
 * surface. `Sheet` therefore becomes a lightweight React Context provider
 * holding `{ open, onOpenChange }` that `SheetTrigger`/`SheetContent`/
 * `SheetClose` all consume (same hand-rolled-context precedent used by
 * Dialog in 40-01 for its `DialogContext`).
 */

export interface SheetRootProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const SheetContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} | null>(null);

function Sheet({ open, onOpenChange, children }: SheetRootProps) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      <div data-slot="sheet">{children}</div>
    </SheetContext.Provider>
  );
}

/**
 * No consumer in this codebase imports `SheetTrigger` without `asChild`
 * (confirmed via repo-wide grep this session: the sole call site,
 * `avatar-page.tsx`, always passes `asChild` with a single plain `<button>`
 * child). Unlike Dialog's `FluentDialogTrigger` (which only clones its child
 * when rendered inside a Fluent `Dialog` context), Sheet has no equivalent
 * Fluent root component to delegate to, so it reuses the shared
 * `isSingleRefCapableElement` shim (Pitfall 5) to clone an `onClick` handler
 * onto the trigger's child directly.
 */
function SheetTrigger({
  asChild,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(SheetContext);
  const handleClick = React.useCallback(
    (event: React.MouseEvent) => {
      ctx?.onOpenChange?.(true);
      if (typeof onClick === "function") {
        (onClick as unknown as (e: React.MouseEvent) => void)(event);
      }
    },
    [ctx, onClick],
  );

  if (asChild) {
    if (isSingleRefCapableElement(children)) {
      const child = children;
      return React.cloneElement(child, {
        ...props,
        "data-slot": "sheet-trigger",
        onClick: handleClick,
      } as Partial<{ className?: string }> & Record<string, unknown>);
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        "SheetTrigger: asChild requires a single ref-forwarding child element; falling back to default render",
      );
    }
  }

  return (
    <button type="button" data-slot="sheet-trigger" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

function SheetClose({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const ctx = React.useContext(SheetContext);
  return (
    <button
      type="button"
      data-slot="sheet-close"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        ctx?.onOpenChange?.(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export type SheetSide = "top" | "right" | "bottom" | "left";

/**
 * Maps the legacy `side` prop to Fluent's `OverlayDrawer` `position` prop.
 * Fluent's `position` type is `'start' | 'end' | 'bottom'` (confirmed via
 * `.d.ts`) -- there is no native `'top'` value. `side="top"` has zero call
 * sites in the codebase (confirmed via grep), so rather than invent a
 * degradation shim for an untested/unused value, it falls back to `'end'`
 * with a dev-mode warning.
 */
function mapSideToPosition(side: SheetSide): "start" | "end" | "bottom" {
  switch (side) {
    case "left":
      return "start";
    case "right":
      return "end";
    case "bottom":
      return "bottom";
    case "top":
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          "SheetContent: side=\"top\" has no native Fluent OverlayDrawer position equivalent (only 'start'|'end'|'bottom' exist) and has zero usage in this codebase; falling back to 'end'",
        );
      }
      return "end";
    default:
      return "end";
  }
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<"div"> & {
  side?: SheetSide;
}) {
  const ctx = React.useContext(SheetContext);

  const handleOpenChange = React.useCallback(
    (_event: DialogOpenChangeEvent, data: DialogOpenChangeData) => {
      ctx?.onOpenChange?.(data.open);
    },
    [ctx],
  );

  return (
    <OverlayDrawer
      data-slot="sheet-content"
      open={ctx?.open}
      position={mapSideToPosition(side)}
      onOpenChange={handleOpenChange}
      className={mergeClasses("flex flex-col gap-4", className)}
      {...(props as Record<string, unknown>)}
    >
      <DrawerBody>
        {children}
        <button
          type="button"
          data-slot="sheet-close"
          aria-label="Close"
          className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          onClick={() => ctx?.onOpenChange?.(false)}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </DrawerBody>
    </OverlayDrawer>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={mergeClasses("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={mergeClasses("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={mergeClasses("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sheet-description"
      className={mergeClasses("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
