import * as React from "react";
import {
  Button as FluentButton,
  mergeClasses,
  type ButtonProps as FluentButtonProps,
} from "@fluentui/react-components";

import { useDestructiveStyles } from "./button.styles";

/**
 * shadcn-compatible `variant`/`size` union, preserved verbatim from the
 * pre-migration `cva()` definition so every existing call site keeps compiling
 * with the exact same prop values (LEAF-01).
 */
export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

/** variant -> Fluent `appearance` (FEATURES.md's verified mapping table). */
const APPEARANCE_MAP: Record<Exclude<ButtonVariant, "destructive">, FluentButtonProps["appearance"]> = {
  default: "primary",
  outline: "outline",
  secondary: "secondary",
  ghost: "subtle",
  link: "transparent",
};

/** size -> Fluent `size` (icon has no dedicated Fluent size token; see `shape` override below). */
const SIZE_MAP: Record<ButtonSize, FluentButtonProps["size"]> = {
  default: "medium",
  sm: "small",
  lg: "large",
  icon: "medium",
};

/**
 * `variant`/`size` retained for public prop-compat with pre-migration
 * `VariantProps<typeof buttonVariants>` (some call sites still pass these to
 * a plain `React.ComponentProps<typeof Button>`).
 */
export interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "color" | "size">,
    React.RefAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

function isSingleRefCapableElement(
  children: React.ReactNode,
): children is React.ReactElement<{ className?: string }> {
  if (!React.isValidElement(children)) {
    return false;
  }
  // A Fragment is itself a valid element but cannot accept a ref, and its
  // children are not addressable as a single cloneElement target -- reject it
  // explicitly (Pitfall 16: multi-child asChild, e.g. <>{<span/>}{<span/>}</>).
  if (children.type === React.Fragment) {
    return false;
  }
  return true;
}

/**
 * Fluent-backed adapter for the legacy shadcn `Button`. Establishes the
 * pattern (variant/size mapping tables, Griffel destructive override,
 * `asChild` cloneElement shim) that the remaining Phase 39 leaf components
 * follow (39-CONTEXT.md).
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const destructiveStyles = useDestructiveStyles();

    const isDestructive = variant === "destructive";
    const computedClassName = mergeClasses(
      isDestructive ? destructiveStyles.root : undefined,
      className,
    );

    if (asChild) {
      if (isSingleRefCapableElement(children)) {
        const child = children;
        return React.cloneElement(child, {
          ...props,
          ref,
          "data-slot": "button",
          className: mergeClasses(computedClassName, child.props.className),
        } as Partial<{ className?: string; "data-slot"?: string }> & React.RefAttributes<unknown>);
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          "Button: asChild requires a single ref-forwarding child element; falling back to default render",
        );
      }
    }

    return (
      <FluentButton
        ref={ref}
        data-slot="button"
        appearance={isDestructive ? undefined : APPEARANCE_MAP[variant]}
        size={SIZE_MAP[size]}
        shape={size === "icon" ? "square" : undefined}
        className={computedClassName}
        {...props}
      >
        {children}
      </FluentButton>
    );
  },
);
Button.displayName = "Button";

export { Button };
