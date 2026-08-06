import {
  Checkbox as FluentCheckbox,
  type CheckboxProps as FluentCheckboxProps,
} from "@fluentui/react-components";

export interface CheckboxProps
  extends Omit<FluentCheckboxProps, "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
}

/**
 * Fluent-backed adapter for the legacy Radix-based `Checkbox` (LEAF-04).
 *
 * Radix's tri-state contract uses the literal string `"indeterminate"`;
 * Fluent's uses `"mixed"` for the exact same concept (Pitfall 5) -- both the
 * shape (`onChange(ev, data)` vs bare `onCheckedChange(checked)`) AND the
 * string vocabulary differ, and both must be shimmed at this boundary so no
 * existing call site (`login.tsx`, `left-panel.tsx`, `topic-guide.tsx`) needs
 * to change:
 *   - inbound: public `checked="indeterminate"` -> Fluent `checked="mixed"`
 *   - outbound: Fluent `data.checked === "mixed"` -> `onCheckedChange("indeterminate")`
 *
 * `data-state` is computed and re-emitted manually from the adapter's OWN
 * incoming `checked` prop (never read back from Fluent internals) since
 * Fluent's native Checkbox does not emit a Radix-style `data-state` attribute
 * -- this keeps `checkbox.test.tsx`'s 2 pre-existing assertions (lines 20/26)
 * passing unmodified (FEATURES.md's explicit cost-tradeoff recommendation:
 * cheaper than rewriting tests to ARIA equivalents).
 */
function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const fluentChecked: boolean | "mixed" | undefined =
    checked === "indeterminate" ? "mixed" : checked;
  const fluentDefaultChecked: boolean | "mixed" | undefined =
    defaultChecked === "indeterminate" ? "mixed" : defaultChecked;

  const dataState =
    checked === true ? "checked" : checked === "indeterminate" ? "indeterminate" : "unchecked";

  return (
    <FluentCheckbox
      data-slot="checkbox"
      data-state={dataState}
      checked={fluentChecked}
      defaultChecked={fluentDefaultChecked}
      onChange={(_ev, data) => {
        onCheckedChange?.(data.checked === "mixed" ? "indeterminate" : data.checked);
      }}
      className={className}
      {...props}
    />
  );
}

export { Checkbox };
