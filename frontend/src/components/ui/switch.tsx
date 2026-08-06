import {
  Switch as FluentSwitch,
  type SwitchProps as FluentSwitchProps,
} from "@fluentui/react-components";

export interface SwitchProps extends Omit<FluentSwitchProps, "checked" | "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Fluent-backed adapter for the legacy Radix-based `Switch` (LEAF-04).
 *
 * Switch has no tri-state concept in either library (unlike Checkbox), so
 * this is a simple boolean-only shape shim -- `onChange(ev, data)` where
 * `data.checked: boolean` maps directly to the legacy `onCheckedChange(checked)`
 * contract, with no vocabulary translation needed (Pitfall 5's explicit
 * warning: verify this isn't accidentally reusing Checkbox's mixed/indeterminate
 * translation function -- it does not, by construction, since this file never
 * imports from checkbox.tsx).
 *
 * `data-slot="switch"` is preserved on the rendered native `<input>` (Fluent's
 * primary slot receives arbitrary `data-*` props via JSX passthrough,
 * confirmed via source read of `getPartitionedNativeProps`).
 */
function Switch({ className, checked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <FluentSwitch
      data-slot="switch"
      checked={checked}
      onChange={(_ev, data) => {
        onCheckedChange?.(data.checked);
      }}
      className={className}
      {...props}
    />
  );
}

export { Switch };
