import * as React from "react";
import {
  TabList as FluentTabList,
  Tab as FluentTab,
  mergeClasses,
  type SelectTabData,
  type SelectTabEvent,
} from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy Radix-based `Tabs` (COMP-05a).
 *
 * Fluent ships `TabList`/`Tab` but has NO panel/`TabsContent` primitive
 * (research Pattern 3) -- `Tabs` (root) becomes a hand-built React Context
 * provider replicating Radix root's `value`/`onValueChange` job, and
 * `TabsContent` becomes a hand-built `<div role="tabpanel">` reading that
 * shared context.
 *
 * Behavioral note (confirmed empirically this session via a throwaway probe
 * against the ORIGINAL pre-migration Radix `tabs.tsx`, then deleted): Radix's
 * `TabsContent` does NOT unmount inactive panels -- both panels stay in the
 * DOM simultaneously, with the inactive one carrying `hidden` + `data-state=
 * "inactive"` and the active one visible with `data-state="active"`. This
 * hand-built adapter matches that exact behavior (render-both, `hidden`-toggle)
 * rather than conditionally unmounting, for two reasons: (1) it's the more
 * faithful behavioral port, and (2) `skill-editor.tsx:924` already manually
 * passes its OWN `forceMount hidden={activeTab !== "settings"}` props through
 * to `TabsContent`, which only makes sense against a render-both contract --
 * a conditional-unmount adapter would double up on hiding logic and diverge
 * from that real call site's intent.
 *
 * `data-state` is set manually on both `TabsTrigger` (via `ctx.value ===
 * value`) and `TabsContent`'s panel wrapper, derived purely from the
 * adapter's own known value -- never read back from Fluent internals -- so
 * the 3 pre-existing Playwright E2E specs (`conference.spec.ts`,
 * `admin-dry-run.spec.ts`, `admin-skill-editor.spec.ts`) that assert
 * `data-state="active"/"inactive"` on `role="tab"`/`role="tabpanel"`
 * elements keep passing unmodified. Matches Checkbox's Phase 39 precedent
 * (39-05-SUMMARY.md).
 */

interface TabsContextValue {
  value?: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`${componentName} must be used within <Tabs>`);
  }
  return ctx;
}

export interface TabsProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value: controlledValue, defaultValue, onValueChange, children, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = React.useCallback(
      (next: string) => {
        if (!isControlled) {
          setUncontrolledValue(next);
        }
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const contextValue = React.useMemo<TabsContextValue>(
      () => ({ value, onValueChange: handleValueChange }),
      [value, handleValueChange],
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} data-slot="tabs" {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

export type TabsListProps = React.ComponentProps<"div">;

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const ctx = useTabsContext("TabsList");

    const handleTabSelect = React.useCallback(
      (_event: SelectTabEvent, data: SelectTabData) => {
        ctx.onValueChange(String(data.value));
      },
      [ctx],
    );

    return (
      <FluentTabList
        ref={ref}
        data-slot="tabs-list"
        selectedValue={ctx.value}
        onTabSelect={handleTabSelect}
        className={mergeClasses(
          "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </FluentTabList>
    );
  },
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends Omit<React.ComponentProps<"button">, "value"> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = useTabsContext("TabsTrigger");
    const isActive = ctx.value === value;

    return (
      <FluentTab
        ref={ref}
        value={value}
        data-slot="tabs-trigger"
        data-state={isActive ? "active" : "inactive"}
        className={mergeClasses(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
          className,
        )}
        {...props}
      >
        {children}
      </FluentTab>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.ComponentProps<"div"> {
  value: string;
  /**
   * Preserved from the pre-migration Radix contract for `skill-editor.tsx`'s
   * `forceMount` usage -- accepted but has no runtime effect on this
   * adapter, since the adapter ALWAYS renders both panels (render-both +
   * `hidden`-toggle contract, see file-level doc comment above); `forceMount`
   * was Radix's opt-in to that same render-both behavior, which is now the
   * unconditional default here.
   */
  forceMount?: boolean;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, forceMount: _forceMount, hidden, children, ...props }, ref) => {
    const ctx = useTabsContext("TabsContent");
    const isActive = ctx.value === value;

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-slot="tabs-content"
        data-state={isActive ? "active" : "inactive"}
        hidden={hidden ?? !isActive}
        className={mergeClasses(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
