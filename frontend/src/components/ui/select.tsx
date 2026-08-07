import * as React from "react";
import {
  Dropdown,
  Option,
  type DropdownProps,
  type OptionOnSelectData,
  type SelectionEvents,
} from "@fluentui/react-components";

import { cn } from "@/lib/utils";

/**
 * Fluent UI adapter for the legacy Radix-shaped Select surface.
 *
 * Contract preserved for all 25 consumer files (COMP-03):
 *  - `Select` keeps the single-value `value` / `onValueChange(string)` controlled API.
 *  - Internally backed by Fluent `Dropdown` + `Option`.
 *
 * value-derivation mechanism (highest-uncertainty decision, empirically probed):
 *  Fluent `Dropdown` displays whatever its `value` prop contains in the closed
 *  trigger — it does NOT auto-derive display text from `selectedOptions` alone.
 *  So we derive the display TEXT for the current `value` by walking the composed
 *  children to find the matching `SelectItem` (by its `value` prop) and reading
 *  its rendered text, mirroring how the original Radix Select surfaced the
 *  selected item's content in `SelectValue`. `onOptionSelect` returns
 *  `{ optionValue, optionText }` (probe-confirmed), so selection round-trips the
 *  plain string value back through `onValueChange` unchanged.
 */

type SelectContextValue = {
  value?: string;
  placeholder?: React.ReactNode;
};

const SelectContext = React.createContext<SelectContextValue>({});

/** Recursively find the SelectItem whose `value` matches and return its text children. */
function findSelectedText(
  children: React.ReactNode,
  value: string | undefined,
): React.ReactNode {
  if (value === undefined) return undefined;
  let found: React.ReactNode;
  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (found !== undefined) return;
      if (!React.isValidElement(child)) return;
      const props = child.props as { value?: string; children?: React.ReactNode };
      if (props.value === value && child.type === SelectItem) {
        found = props.children;
        return;
      }
      if (props.children) walk(props.children);
    });
  };
  walk(children);
  return found;
}

/** Extract a plain string from arbitrary React children for the Dropdown `value` prop. */
function textContent(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (React.isValidElement(node)) {
    return textContent((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
} & Omit<
  DropdownProps,
  "value" | "selectedOptions" | "onOptionSelect" | "defaultValue" | "children"
>;

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  children,
  ...props
}: SelectProps) {
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internal;

  // Fluent renders its own trigger button, so the consumer-facing `SelectTrigger`
  // never renders a distinct visible element. Consumers attach identifying props
  // (data-testid, aria-label, className, id, …) to `SelectTrigger` expecting them
  // on the real trigger — so we walk the children once to hoist those props (plus
  // `size` and the `SelectValue` placeholder) onto the Dropdown.
  const { placeholder, triggerSize, triggerProps } = React.useMemo(() => {
    let ph: React.ReactNode;
    let size: "sm" | "default" = "default";
    let tProps: Record<string, unknown> = {};
    const walk = (nodes: React.ReactNode) => {
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;
        if (child.type === SelectTrigger) {
          const { size: s, children: _c, ...rest } = child.props as {
            size?: "sm" | "default";
            children?: React.ReactNode;
          } & Record<string, unknown>;
          if (s) size = s;
          tProps = rest;
        }
        if (child.type === SelectValue && ph === undefined) {
          ph = (child.props as { placeholder?: React.ReactNode }).placeholder;
        }
        const kids = (child.props as { children?: React.ReactNode }).children;
        if (kids) walk(kids);
      });
    };
    walk(children);
    return { placeholder: ph, triggerSize: size, triggerProps: tProps };
  }, [children]);

  const selectedText = textContent(findSelectedText(children, currentValue));

  const handleOptionSelect = (_ev: SelectionEvents, data: OptionOnSelectData) => {
    const next = data.optionValue ?? "";
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <SelectContext.Provider value={{ value: currentValue, placeholder }}>
      <div data-slot="select" className="contents">
        <Dropdown
          {...(triggerProps as Record<string, unknown>)}
          data-slot="select-trigger"
          data-size={triggerSize}
          disabled={disabled}
          placeholder={typeof placeholder === "string" ? placeholder : undefined}
          value={selectedText}
          selectedOptions={currentValue ? [currentValue] : []}
          onOptionSelect={handleOptionSelect}
          {...props}
        >
          {children}
        </Dropdown>
      </div>
    </SelectContext.Provider>
  );
}

/**
 * Structural pass-through. Fluent's `Dropdown` renders its own trigger button
 * (which carries `data-slot="select-trigger"` + `data-size`, hoisted by
 * `<Select>`), so this component only forwards its children — typically
 * `SelectValue` — and does NOT re-emit the trigger slot to avoid a duplicate.
 * The `size` prop is read by `<Select>` during child inspection.
 */
function SelectTrigger({
  className,
  size: _size = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & { size?: "sm" | "default" }) {
  void _size;
  return (
    <div data-slot="select-trigger-inner" className={cn("contents", className)} {...props}>
      {children}
    </div>
  );
}

/** Renders nothing on its own; Fluent Dropdown surfaces the selected value in its trigger. */
function SelectValue({
  className,
  ...props
}: React.ComponentProps<"span"> & { placeholder?: React.ReactNode }) {
  // `placeholder` is consumed by <Select> above; strip it so it isn't spread to the DOM.
  const { placeholder: _placeholder, ...rest } = props;
  void _placeholder;
  return <span data-slot="select-value" className={cn("contents", className)} {...rest} />;
}

/** Structural pass-through — its children (SelectItems) flow into the Dropdown listbox. */
function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { position?: string }) {
  const { position: _position, ...rest } = props;
  void _position;
  return (
    <div data-slot="select-content" className={cn("contents", className)} {...rest}>
      {children}
    </div>
  );
}

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select-group" role="group" className={className} {...props} />;
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  value,
  ...props
}: Omit<React.ComponentProps<typeof Option>, "value"> & { value: string }) {
  return (
    <Option data-slot="select-item" value={value} className={className} {...props}>
      {children}
    </Option>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      role="separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

/** No-op: Fluent's listbox scrolls natively; retained for import compatibility. */
function SelectScrollUpButton(_props: React.ComponentProps<"div">) {
  return null;
}

/** No-op: Fluent's listbox scrolls natively; retained for import compatibility. */
function SelectScrollDownButton(_props: React.ComponentProps<"div">) {
  return null;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
