import * as React from "react";
import { Tooltip as FluentTooltip, type TooltipProps as FluentTooltipProps } from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy Radix-based `Tooltip` (COMP-05b).
 *
 * Preserves all 4 pre-migration named exports (`TooltipProvider`, `Tooltip`,
 * `TooltipTrigger`, `TooltipContent`) and their compound-children usage
 * pattern (`<Tooltip><TooltipTrigger asChild>...</TooltipTrigger>
 * <TooltipContent>...</TooltipContent></Tooltip>`) even though Fluent's own
 * `Tooltip` is a single component that takes its trigger as a `children`
 * prop and its content via a `content` prop -- there is no separate
 * `TooltipTrigger`/`TooltipContent` sub-component in Fluent (confirmed via
 * `.d.ts` read: `Tooltip: React.FC<TooltipProps>` with `content` as a slot
 * and `children` typed as `TriggerProps<TooltipTriggerProps>['children']`).
 *
 * `Tooltip` (root, hand-built) walks its `children` looking for the
 * `TooltipTrigger` and `TooltipContent` marker elements, then renders a
 * single `FluentTooltip` with the trigger's child as `children` and the
 * content element's children as the `content` slot. `TooltipTrigger` and
 * `TooltipContent` themselves are just typed marker components (they never
 * render anything on their own -- they're unwrapped by `Tooltip`).
 *
 * `relationship` default injection (research Pattern 4 / T-40-06): Fluent's
 * `relationship: 'label' | 'description' | 'inaccessible'` is REQUIRED with
 * no default (confirmed via `.d.ts` JSDoc: no `@default` tag, unlike
 * `positioning`/`withArrow`/`showDelay`/`hideDelay` which all declare one).
 * Every consumer in this codebase (repo-wide grep, confirmed this session)
 * never passes `relationship` explicitly, so `TooltipContent` accepts an
 * optional `relationship` prop and this adapter injects `"label"` as the
 * default when omitted -- this is the same default Radix effectively
 * provided implicitly (Radix's `Tooltip.Content` sets `aria-describedby` by
 * default via its portal + `Content`'s own internal id wiring, closest in
 * spirit to Fluent's `"label"` here since the pre-migration usage is
 * overwhelmingly icon-only buttons needing an accessible name).
 *
 * `side` -> `positioning` translation: legacy `side="left"|"right"` (the
 * only 2 values used anywhere in this codebase, confirmed via grep) map to
 * Fluent's direction-agnostic `PositioningShorthandValue`'s `'before'`/
 * `'after'` respectively (Fluent has no `'left'`/`'right'` -- `before`/
 * `after` are the horizontal equivalents, RTL-aware). `side="top"`/
 * `"bottom"` map to `'above'`/`'below'` for defensive completeness even
 * though no consumer currently uses them.
 *
 * `TooltipTrigger`'s `asChild` (all ~20 confirmed call sites use it,
 * confirmed via grep: zero bare non-asChild usages besides this file's own
 * 2 unit tests) needs no `isSingleRefCapableElement` shim of its own --
 * Fluent's `Tooltip` already clones/augments its single trigger child
 * internally via `applyTriggerPropsToChildren`/`getTriggerChild` (verified
 * via source read of `useTooltipBase.js`), the same native-cloning mechanism
 * Dialog's `FluentDialogTrigger` uses (per `dialog.tsx`'s own doc comment,
 * 40-01). `TooltipTrigger` here therefore just marks its child for
 * extraction by `Tooltip` and passes it straight through unmodified --
 * Fluent's `Tooltip` does the actual cloning.
 */

export type TooltipSide = "top" | "right" | "bottom" | "left";

function mapSideToPositioning(side: TooltipSide): NonNullable<FluentTooltipProps["positioning"]> {
  switch (side) {
    case "left":
      return "before";
    case "right":
      return "after";
    case "top":
      return "above";
    case "bottom":
      return "below";
    default:
      return "above";
  }
}

export interface TooltipProviderProps {
  /**
   * Preserved from the pre-migration Radix contract. Fluent has no
   * provider-level delay configuration equivalent (tooltip timing is
   * controlled per-instance via `Tooltip`'s own `showDelay`/`hideDelay`,
   * both defaulting to 250ms) -- accepted for signature compatibility but
   * has no runtime effect. `FluentProvider` (mounted at the app root since
   * Phase 39) already supplies the `TooltipVisibilityProvider` context
   * Fluent's `Tooltip` needs, so no provider wiring is required here at all.
   */
  delayDuration?: number;
  children?: React.ReactNode;
}

function TooltipProvider({ delayDuration: _delayDuration, children }: TooltipProviderProps) {
  return <React.Fragment>{children}</React.Fragment>;
}

export interface TooltipTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

/**
 * Marker component -- `Tooltip` (below) extracts this element's `children`
 * and `asChild` are both irrelevant here since the trigger's child is always
 * handed to Fluent's own `Tooltip` as `children`, which performs its own
 * `asChild`-equivalent cloning regardless of whether this component ever
 * renders. Kept as a distinct component (not a plain marker constant) so
 * `React.isValidElement` / `.type` checks in `Tooltip` remain robust against
 * minifier/bundler renaming (compared against a symbol or displayName).
 */
function TooltipTrigger({ asChild: _asChild, children }: TooltipTriggerProps) {
  return <React.Fragment>{children}</React.Fragment>;
}
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps extends Omit<React.ComponentProps<"div">, "children"> {
  side?: TooltipSide;
  sideOffset?: number;
  relationship?: FluentTooltipProps["relationship"];
  children?: React.ReactNode;
}

/**
 * Marker component -- `Tooltip` (below) extracts this element's `children`,
 * `side`, `sideOffset`, and `relationship` props to configure the single
 * underlying `FluentTooltip` it renders. Never renders anything on its own.
 */
function TooltipContent({
  side: _side,
  sideOffset: _sideOffset,
  relationship: _relationship,
  className: _className,
  children,
}: TooltipContentProps) {
  return <React.Fragment>{children}</React.Fragment>;
}
TooltipContent.displayName = "TooltipContent";

export interface TooltipRootProps {
  children?: React.ReactNode;
}

function Tooltip({ children }: TooltipRootProps) {
  const childArray = React.Children.toArray(children);

  const triggerElement = childArray.find(
    (child): child is React.ReactElement<TooltipTriggerProps> =>
      React.isValidElement(child) && child.type === TooltipTrigger,
  );
  const contentElement = childArray.find(
    (child): child is React.ReactElement<TooltipContentProps> =>
      React.isValidElement(child) && child.type === TooltipContent,
  );

  const triggerChild: React.ReactNode = triggerElement?.props.children ?? null;

  if (!contentElement) {
    // No TooltipContent provided -- render the trigger's child as-is with no
    // tooltip wiring, rather than throwing, to stay resilient against
    // partial/defensive usages (e.g. conditionally omitted content).
    return <React.Fragment>{triggerChild}</React.Fragment>;
  }

  const {
    side = "top",
    relationship = "label",
    children: contentChildren,
  } = contentElement.props;

  return (
    <FluentTooltip
      content={{ children: contentChildren, "data-slot": "tooltip-content" } as never}
      relationship={relationship}
      positioning={mapSideToPositioning(side)}
      withArrow
    >
      {triggerChild as React.ReactElement | null}
    </FluentTooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
