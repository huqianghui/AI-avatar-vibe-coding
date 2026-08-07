import * as React from "react";
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuItemCheckbox,
  MenuItemRadio,
  MenuDivider,
} from "@fluentui/react-components";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { isSingleRefCapableElement } from "./_shim-as-child";

/**
 * Fluent UI v9 `Menu`-family adapter behind the legacy Radix DropdownMenu
 * surface (COMP-04). All 15 named exports and prop signatures are preserved so
 * every consumer works unchanged.
 *
 * Checkbox / radio checked-state is LIFTED to Fluent `MenuList`'s
 * `checkedValues` (Record<string, string[]>) + `onCheckedValueChange` dict
 * model — items never track their own checked boolean independently (research
 * anti-pattern). `DropdownMenuContent` owns the dict and derives it from a
 * registry populated by the checkbox/radio items via context; on user toggle it
 * routes the change back to each item's `onCheckedChange` / the group's
 * `onValueChange`. See Phase 40-07.
 */

// ---------------------------------------------------------------------------
// Lifted checked-state plumbing
// ---------------------------------------------------------------------------

interface ItemReg {
  name: string;
  value: string;
  checked: boolean;
  onChange?: (checked: boolean) => void; // checkbox item
  onSelect?: (value: string) => void; // radio item (delegates to group)
}

interface MenuCheckedContextValue {
  registerItem: (id: string, reg: ItemReg) => void;
  unregisterItem: (id: string) => void;
}

const MenuCheckedContext = React.createContext<MenuCheckedContextValue | null>(
  null,
);

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

// ---------------------------------------------------------------------------

function DropdownMenu({
  children,
  ...props
}: React.ComponentProps<typeof Menu>) {
  const [registry, setRegistry] = React.useState<Record<string, ItemReg>>({});

  const registerItem = React.useCallback((id: string, reg: ItemReg) => {
    setRegistry((prev) => {
      const existing = prev[id];
      if (
        existing &&
        existing.name === reg.name &&
        existing.value === reg.value &&
        existing.checked === reg.checked &&
        existing.onChange === reg.onChange &&
        existing.onSelect === reg.onSelect
      ) {
        return prev;
      }
      return { ...prev, [id]: reg };
    });
  }, []);

  const unregisterItem = React.useCallback((id: string) => {
    setRegistry((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Derive Fluent's checkedValues dict from the item registry — the single
  // source of truth, grouped by `name` (multi-select for checkboxes,
  // single-select for radios). These props live on `Menu` (not `MenuList`) per
  // Fluent's own guidance.
  const checkedValues = React.useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const reg of Object.values(registry)) {
      const arr = out[reg.name] ?? (out[reg.name] = []);
      if (reg.checked) arr.push(reg.value);
    }
    return out;
  }, [registry]);

  const handleCheckedValueChange = React.useCallback(
    (
      _ev: React.SyntheticEvent | Event,
      data: { name: string; checkedItems: string[] },
    ) => {
      for (const reg of Object.values(registry)) {
        if (reg.name !== data.name) continue;
        const nowChecked = data.checkedItems.includes(reg.value);
        if (reg.onSelect) {
          // radio: fire only when this item became the selected one
          if (nowChecked && !reg.checked) reg.onSelect(reg.value);
        } else if (reg.onChange && nowChecked !== reg.checked) {
          reg.onChange(nowChecked);
        }
      }
    },
    [registry],
  );

  const ctx = React.useMemo<MenuCheckedContextValue>(
    () => ({ registerItem, unregisterItem }),
    [registerItem, unregisterItem],
  );

  return (
    <MenuCheckedContext.Provider value={ctx}>
      <Menu
        checkedValues={checkedValues}
        onCheckedValueChange={handleCheckedValueChange}
        {...props}
      >
        {children}
      </Menu>
    </MenuCheckedContext.Provider>
  );
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  // Fluent's MenuPopover portals internally; the Radix Portal wrapper is a
  // passthrough here so consumers importing it keep working.
  return <>{children}</>;
}

type DropdownMenuTriggerProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
};

const DropdownMenuTrigger = React.forwardRef<
  HTMLElement,
  DropdownMenuTriggerProps
>(({ asChild, children, ...props }, ref) => {
  if (asChild && isSingleRefCapableElement(children)) {
    // Clone the caller's element (e.g. a Fluent Button) as the trigger. Fluent
    // `MenuTrigger` merges its own trigger props/ref onto this same child via
    // useMergedRefs, so `data-slot` + our ref coexist with Fluent's wiring
    // without a duplicate-handler collision.
    const child = React.cloneElement(
      children,
      {
        "data-slot": "dropdown-menu-trigger",
        ref,
        ...props,
      } as React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> },
    );
    return <MenuTrigger>{child}</MenuTrigger>;
  }
  return (
    <MenuTrigger>
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        data-slot="dropdown-menu-trigger"
        {...props}
      >
        {children}
      </button>
    </MenuTrigger>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

type DropdownMenuContentProps = Omit<React.ComponentProps<"div">, "ref"> & {
  sideOffset?: number;
  // Radix positioning props are visual-only under the Fluent adapter (Menu
  // positioning lives on the root); accepted for API parity, not forwarded.
  align?: "start" | "center" | "end";
};

function DropdownMenuContent({
  className,
  sideOffset: _sideOffset,
  align: _align,
  children,
  ...props
}: DropdownMenuContentProps) {
  // Checked-state (checkedValues / onCheckedValueChange) is owned by the
  // `DropdownMenu` (Fluent `Menu`) root; the content just renders the popover
  // and list surface.
  return (
    <MenuPopover
      data-slot="dropdown-menu-content"
      className={cn(
        "bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className,
      )}
      {...props}
    >
      <MenuList>{children}</MenuList>
    </MenuPopover>
  );
}

function DropdownMenuGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="dropdown-menu-group"
      className={className}
      {...props}
    />
  );
}

type DropdownMenuItemProps = React.ComponentProps<typeof MenuItem> & {
  inset?: boolean;
  variant?: "default" | "destructive";
  /** Radix `onSelect(event)` parity — Fluent's MenuItem has no onSelect, so we
   *  route item activation (onClick) through it. Fires on the same user gesture
   *  that dismisses the menu, matching Radix semantics for consumers. */
  onSelect?: (event: Event) => void;
};

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onSelect,
  onClick,
  ...props
}: DropdownMenuItemProps) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onClick?.(event);
      onSelect?.(event.nativeEvent);
    },
    [onClick, onSelect],
  );
  return (
    <MenuItem
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      onClick={handleClick}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

type DropdownMenuCheckboxItemProps = Omit<
  React.ComponentProps<typeof MenuItemCheckbox>,
  "name" | "value"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Group name — checkboxes sharing a name form one multi-select dict group.
   *  Defaults to a per-item id so each checkbox toggles independently. */
  name?: string;
  value?: string;
};

function DropdownMenuCheckboxItem({
  className,
  children,
  checked = false,
  onCheckedChange,
  name,
  value,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const autoId = React.useId();
  const groupName = name ?? autoId;
  const itemValue = value ?? "on";
  const menu = React.useContext(MenuCheckedContext);

  React.useEffect(() => {
    if (!menu) return;
    menu.registerItem(autoId, {
      name: groupName,
      value: itemValue,
      checked,
      onChange: onCheckedChange,
    });
    return () => menu.unregisterItem(autoId);
  }, [menu, autoId, groupName, itemValue, checked, onCheckedChange]);

  return (
    <MenuItemCheckbox
      name={groupName}
      value={itemValue}
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </MenuItemCheckbox>
  );
}

type DropdownMenuRadioGroupProps = React.ComponentProps<"div"> & {
  value?: string;
  onValueChange?: (value: string) => void;
};

function DropdownMenuRadioGroup({
  className,
  value,
  onValueChange,
  children,
  ...props
}: DropdownMenuRadioGroupProps) {
  const name = React.useId();
  const ctx = React.useMemo<RadioGroupContextValue>(
    () => ({ name, value, onValueChange }),
    [name, value, onValueChange],
  );
  return (
    <RadioGroupContext.Provider value={ctx}>
      <div
        role="group"
        data-slot="dropdown-menu-radio-group"
        className={className}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

type DropdownMenuRadioItemProps = Omit<
  React.ComponentProps<typeof MenuItemRadio>,
  "name"
> & {
  value: string;
};

function DropdownMenuRadioItem({
  className,
  children,
  value,
  ...props
}: DropdownMenuRadioItemProps) {
  const group = React.useContext(RadioGroupContext);
  const menu = React.useContext(MenuCheckedContext);
  const id = React.useId();
  const groupName = group?.name ?? "";
  const checked = group?.value === value;

  React.useEffect(() => {
    if (!menu || !group) return;
    menu.registerItem(id, {
      name: groupName,
      value,
      checked,
      onSelect: (v) => group.onValueChange?.(v),
    });
    return () => menu.unregisterItem(id);
  }, [menu, group, id, groupName, value, checked]);

  return (
    <MenuItemRadio
      name={groupName}
      value={value}
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </MenuItemRadio>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuDivider>) {
  return (
    <MenuDivider
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof Menu>) {
  // A nested Fluent Menu renders a submenu when placed inside a MenuList.
  return <Menu {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof MenuItem> & { inset?: boolean }) {
  return (
    <MenuTrigger>
      <MenuItem
        data-slot="dropdown-menu-sub-trigger"
        data-inset={inset}
        className={cn(
          "focus:bg-accent focus:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronRightIcon className="ml-auto size-4" />
      </MenuItem>
    </MenuTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "ref">) {
  return (
    <MenuPopover
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg",
        className,
      )}
      {...props}
    >
      <MenuList>{children}</MenuList>
    </MenuPopover>
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
