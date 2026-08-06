import * as React from "react";
import {
  mergeClasses,
  renderTextarea_unstable,
  useTextarea_unstable,
  useTextareaStyles_unstable,
} from "@fluentui/react-components";

/**
 * Fluent-backed adapter for the legacy plain `<textarea>` shadcn `Textarea`
 * (LEAF-03). Fluent's `Textarea` wraps the native `<textarea>` in a root
 * `<span>` slot (FEATURES.md row 10, Pitfall 20) -- per its own
 * `TextareaSlots` typing, only `className`/`style` go to the wrapper `root`
 * slot; every other top-level native prop (including `ref`) routes to the
 * inner `textarea` slot automatically. This is verified explicitly by a
 * unit test (not assumed), since real consumers depend on
 * `ref.current.focus()` resolving to the actual `<textarea>` element:
 * `avatar-page.tsx`'s `handleUseTextInstead` (via `avatar-input-bar.tsx`'s
 * `<Textarea ref={textareaRef}>`) and `chat-input.tsx`.
 *
 * Uses the same low-level-hooks fix as `input.tsx` (see that file's
 * detailed comment): the high-level `<FluentTextarea>` component
 * unconditionally re-asserts its own internally-controlled `value` state on
 * every render, which fights react-hook-form's uncontrolled
 * `register()`-via-ref pattern (a confirmed real call site:
 * `rubric-editor.tsx`'s `<Textarea rows={2} {...form.register("description")} />`).
 * Dropping to `useTextarea_unstable`/`useTextareaStyles_unstable`/
 * `renderTextarea_unstable` and erasing `state.textarea.value` when neither
 * `value` nor `defaultValue` is supplied keeps that pattern working.
 */
export type TextareaProps = Omit<
  React.ComponentPropsWithoutRef<"textarea">,
  "defaultValue" | "value"
> & {
  defaultValue?: string | number;
  value?: string | number;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, children: _children, value, defaultValue, ...props }, ref) => {
    // Native `<textarea>`'s `value`/`defaultValue` accept `string | number`
    // (coerced to string); Fluent's `TextareaProps` narrows both to `string`
    // only -- stringify here, mirroring input.tsx's identical fix.
    const stringValue = value === undefined ? undefined : String(value);
    const stringDefaultValue = defaultValue === undefined ? undefined : String(defaultValue);

    const state = useTextarea_unstable(
      {
        ...props,
        value: stringValue,
        defaultValue: stringDefaultValue,
        textarea: { className: mergeClasses(className) },
      },
      ref,
    );

    // `data-slot` set directly on the resolved slot state, mirroring
    // input.tsx's approach (TextareaProps's narrow slot typing rejects
    // arbitrary `data-*` keys on a plain object literal).
    (state.textarea as unknown as Record<string, unknown>)["data-slot"] = "textarea";

    // Genuine-uncontrolled case (no `value`, no `defaultValue`): erase
    // Fluent's own internally-computed controlled value so react-hook-form's
    // (and any other) direct ref-based DOM mutation is not overwritten on the
    // next render. See file-level comment above.
    if (stringValue === undefined && stringDefaultValue === undefined) {
      state.textarea.value = undefined as unknown as string;
    }

    useTextareaStyles_unstable(state);
    return renderTextarea_unstable(state);
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
