import * as React from "react";
import {
  Slider as FluentSlider,
  mergeClasses,
  type SliderProps as FluentSliderProps,
} from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy Radix-based `Slider` (LEAF-05).
 *
 * Radix's/this codebase's public contract is **array-based** even for
 * single-thumb sliders (`value?: number[]`, `onValueChange?: (value:
 * number[]) => void`), matching Radix's multi-thumb-capable `Slider.Root`
 * API; Fluent's `Slider` is **scalar-only** (`value?: number`, `onChange?:
 * (ev, data: { value: number }) => void`) -- there is no dual/range-thumb
 * variant in Fluent v9. A grep across every current consumer
 * (`scoring-weights.tsx`, `vl-instance-dialog.tsx`, `rubric-editor.tsx` x2,
 * `personality-sliders.tsx` x2, `vl-instance-editor.tsx` x3) confirms zero
 * dual-thumb usage in this codebase today (every call site passes a
 * single-element array, e.g. `value={[weights[key]]}`) -- see SUMMARY for
 * the full grep result. This adapter therefore shims a single-value
 * array<->scalar boundary in both directions; it does not attempt to support
 * multi-thumb ranges.
 */
export interface SliderProps
  extends Omit<FluentSliderProps, "value" | "defaultValue" | "onChange"> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, onValueChange, ...props }, ref) => {
    return (
      <FluentSlider
        ref={ref}
        data-slot="slider"
        value={value?.[0]}
        defaultValue={defaultValue?.[0]}
        onChange={(_ev, data) => {
          onValueChange?.([data.value]);
        }}
        className={mergeClasses(className)}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
