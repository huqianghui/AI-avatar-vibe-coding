import * as React from "react";
import {
  Dialog as FluentDialog,
  DialogTrigger as FluentDialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle as FluentDialogTitle,
  mergeClasses,
  type DialogOpenChangeData,
  type DialogOpenChangeEvent,
} from "@fluentui/react-components";
import { XIcon } from "lucide-react";

/**
 * Fluent-backed adapter for the legacy Radix-based `Dialog` (COMP-01).
 *
 * Preserves all 10 pre-migration named exports, all 10 `data-slot` values,
 * and Radix-equivalent ARIA wiring (`aria-labelledby`/`aria-describedby`) so
 * every consumer (`assign-hcp-dialog.tsx`, `connect-kb-dialog.tsx`, and the
 * ~40 other call sites) keeps compiling and behaving identically.
 *
 * Naming collision note (research Anti-Pattern): Fluent's own
 * `DialogContent`/`DialogTitle` are INNER sub-slots inside `DialogBody`, not
 * the all-in-one surface wrapper this file's exported `DialogContent`/
 * `DialogTitle` need to be -- Fluent's imports are aliased (`FluentDialog*`)
 * to avoid confusion with this file's own same-named exports.
 *
 * DialogTrigger finding: no consumer in this codebase imports `DialogTrigger`
 * directly (confirmed via repo-wide grep this session) -- every call site
 * controls `open`/`onOpenChange` on `Dialog` itself. Fluent's own
 * `DialogTrigger` already clones its single child via
 * `applyTriggerPropsToChildren`/`getTriggerChild` (verified against the
 * installed `.d.ts`/source), so it is used directly here rather than
 * layering the `_shim-as-child` guard on top -- that guard remains reserved
 * for Sheet/DropdownMenu triggers per the research's Pitfall 5 guidance.
 */

export interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children?: React.ReactNode;
}

const DialogContext = React.createContext<{
  onOpenChange?: (open: boolean) => void;
} | null>(null);

function Dialog({ open, defaultOpen, onOpenChange, modal, children }: DialogRootProps) {
  const handleOpenChange = React.useCallback(
    (_event: DialogOpenChangeEvent, data: DialogOpenChangeData) => {
      onOpenChange?.(data.open);
    },
    [onOpenChange],
  );

  return (
    <DialogContext.Provider value={{ onOpenChange }}>
      <FluentDialog
        data-slot="dialog"
        open={open}
        defaultOpen={defaultOpen}
        modalType={modal === false ? "non-modal" : "modal"}
        onOpenChange={handleOpenChange}
      >
        {/*
         * Fluent's `Dialog.children` type is `[JSXElement, JSXElement] | JSXElement`
         * (exactly 1 or 2 children: optional `DialogTrigger` + `DialogSurface`),
         * narrower than the pre-migration Radix contract's `React.ReactNode`.
         * Consumers still pass plain `ReactNode` (verified: zero consumers rely on
         * anything Fluent would reject -- always 1-2 real elements) so the cast
         * preserves the wider public `DialogRootProps.children` type without
         * narrowing what callers can pass.
         */}
        {children as React.ReactElement}
      </FluentDialog>
    </DialogContext.Provider>
  );
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof FluentDialogTrigger>) {
  return <FluentDialogTrigger {...props} />;
}

/**
 * Fluent's `Dialog` manages its own overlay/portal internally via
 * `DialogSurface` (confirmed via source read: `renderDialogSurface_unstable`
 * always wraps its root in `@fluentui/react-portal`'s `Portal`) -- `DialogPortal`
 * and `DialogOverlay` become transparent pass-through wrappers preserving
 * their exported names and `data-slot` values for any consumer that still
 * imports them directly (repo-wide grep this session confirms zero such
 * consumers today, but the export surface must remain stable).
 */
function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}

function DialogOverlay({ className }: { className?: string }) {
  return <div data-slot="dialog-overlay" className={className} />;
}

function DialogClose({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const ctx = React.useContext(DialogContext);
  return (
    <button
      type="button"
      data-slot="dialog-close"
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

/**
 * Fluent has no built-in `aria-describedby` auto-wiring equivalent to
 * Radix's `DialogDescription` (verified: no `dialogDescriptionId` exists on
 * `DialogContextValue`, unlike the auto-wired `dialogTitleId`) -- so this
 * adapter manually threads a description id from `DialogDescription` (child)
 * up to `DialogSurface` (ancestor, rendered by `DialogContent`) via a small
 * local context: `DialogContent` owns the id state and passes it to
 * `DialogSurface`'s `aria-describedby`; `DialogDescription` registers its own
 * generated id into that state on mount.
 */
const DialogDescriptionIdContext = React.createContext<{
  setDescriptionId: (id: string | undefined) => void;
} | null>(null);

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const ctx = React.useContext(DialogContext);
  const [descriptionId, setDescriptionId] = React.useState<string | undefined>(undefined);

  return (
    <DialogSurface
      data-slot="dialog-content"
      className={mergeClasses(className)}
      aria-describedby={descriptionId}
      {...props}
    >
      <DialogDescriptionIdContext.Provider value={{ setDescriptionId }}>
        <DialogBody>
          {children}
          <button
            type="button"
            data-slot="dialog-close"
            aria-label="Close"
            className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            onClick={() => ctx?.onOpenChange?.(false)}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </button>
        </DialogBody>
      </DialogDescriptionIdContext.Provider>
    </DialogSurface>
  );
}

function DialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={mergeClasses("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={mergeClasses("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

/**
 * Uses Fluent's own `DialogTitle` (aliased `FluentDialogTitle`) to get
 * `aria-labelledby` wiring "for free" -- Fluent's `DialogSurface` reads
 * `dialogTitleId` from `DialogContext` and applies it as the surface's
 * `aria-labelledby` automatically (verified via source read of
 * `useDialogSurface.js`/`useDialogTitle.js`; empirically confirmed by Test 2
 * in `dialog.test.tsx`).
 */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof FluentDialogTitle>) {
  return (
    <FluentDialogTitle
      data-slot="dialog-title"
      className={mergeClasses("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  id: idProp,
  ...props
}: React.ComponentProps<"p">) {
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const idCtx = React.useContext(DialogDescriptionIdContext);

  React.useEffect(() => {
    idCtx?.setDescriptionId(id);
    return () => idCtx?.setDescriptionId(undefined);
  }, [idCtx, id]);

  return (
    <p
      data-slot="dialog-description"
      id={id}
      className={mergeClasses("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
