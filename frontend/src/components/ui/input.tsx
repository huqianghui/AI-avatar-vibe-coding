import * as React from "react";
import {
  mergeClasses,
  renderInput_unstable,
  useInput_unstable,
  useInputStyles_unstable,
  type InputProps as FluentInputProps,
} from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy plain `<input>` shadcn `Input`
 * (LEAF-03). Fluent's `Input` wraps the native `<input>` in a root `<span>`
 * slot (FEATURES.md row 3, Pitfall 20) -- per Fluent's own `InputSlots`
 * typing, only `className`/`style` go to the wrapper `root` slot; every other
 * top-level native prop (including `ref`) is routed to the inner `input`
 * slot automatically. This is verified explicitly by a unit test (not
 * assumed) since a real consumer (`chat-input.tsx`, `avatar-input-bar.tsx`)
 * depends on `ref.current.focus()` resolving to the actual `<input>`
 * element.
 *
 * IMPORTANT (Rule 1 auto-fix, discovered running the full suite, not just
 * this component's own tests): the high-level `<FluentInput>` component
 * unconditionally asserts its own internally-controlled `value` state
 * (`useControllableState`, defaulting to `''`) onto the DOM on every
 * render, even when the caller passes neither `value` nor `defaultValue`.
 * This silently fights and undoes react-hook-form's classic *uncontrolled*
 * `register()` pattern (`fieldRef.current.value = x` direct DOM mutation,
 * used pervasively across the admin forms -- `rubric-editor.tsx`,
 * `scenario-editor.tsx`, `skill-editor.tsx`, etc.), which has no competing
 * React-controlled value to fight against a plain native `<input>`.
 * Confirmed via source read of `@fluentui/react-input`'s `useInput.js`
 * (`state.input.value = value` set unconditionally) and reproduced/fixed in
 * isolation before applying here. Fix: drop down to Fluent's own unstable
 * hooks (`useInput_unstable`/`useInputStyles_unstable`/
 * `renderInput_unstable` -- the exact same hooks the public `<Input>`
 * component itself is built from) and, only when the caller supplied
 * neither `value` nor `defaultValue` (the genuine-uncontrolled case), erase
 * the internally-computed `state.input.value` so the rendered `<input>`
 * gets no `value` prop at all and stays truly uncontrolled -- letting
 * react-hook-form's direct ref/DOM mutation stick. Controlled (`value`+
 * `onChange`) and `defaultValue`-only usages are unaffected (verified by
 * dedicated tests below).
 */
export type InputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "size" | "defaultValue" | "value"
> & {
  defaultValue?: string | number;
  value?: string | number;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, children: _children, value, defaultValue, ...props }, ref) => {
    // `Input` never renders children (native `<input>` can't have any); this
    // codebase's global JSX typings (via react-i18next's type augmentation)
    // add an optional `children` field to every intrinsic element's props,
    // which is incompatible with Fluent's `InputProps` (`children?: never`)
    // when spread verbatim -- explicitly drop it before spreading.
    // Route `className` (which Fluent would otherwise apply to the wrapper
    // `root` slot) to the `input` slot explicitly so pre-migration visual
    // utility classes keep landing on the actual native element -- matching
    // prior flat-`<input>` behavior and existing `toHaveClass` assertions.
    // `data-slot` is a plain top-level native prop, so it is already routed
    // to the `input` slot without any special handling.
    // A handful of real `type="number"` call sites pass a numeric `value`
    // (native `<input>` coerces this to a string); Fluent's `InputProps`
    // narrows `value`/`defaultValue` to `string` only, so stringify here to
    // preserve those existing call sites unmodified.
    const stringValue = value === undefined ? undefined : String(value);
    const stringDefaultValue = defaultValue === undefined ? undefined : String(defaultValue);

    const state = useInput_unstable(
      {
        ...props,
        type: type as FluentInputProps["type"],
        value: stringValue,
        defaultValue: stringDefaultValue,
        input: { className: mergeClasses(className) },
      },
      ref,
    );

    // `data-slot` is set directly on the resolved `input` slot state rather
    // than passed through `useInput_unstable`'s props argument, since
    // `InputProps`'s narrow slot typing rejects arbitrary `data-*` keys on a
    // plain object literal (unlike JSX, which special-cases them).
    (state.input as unknown as Record<string, unknown>)["data-slot"] = "input";

    // Genuine-uncontrolled case (no `value`, no `defaultValue`): erase
    // Fluent's own internally-computed controlled value so react-hook-form's
    // (and any other) direct ref-based DOM mutation is not overwritten on
    // the next render. See file-level comment above.
    if (stringValue === undefined && stringDefaultValue === undefined) {
      state.input.value = undefined as unknown as string;
    }

    useInputStyles_unstable(state);
    return renderInput_unstable(state);
  },
);
Input.displayName = "Input";

export { Input };
