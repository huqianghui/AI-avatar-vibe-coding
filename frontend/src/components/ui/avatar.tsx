import * as React from "react";
import {
  Avatar as FluentAvatar,
  mergeClasses,
  type AvatarProps as FluentAvatarProps,
} from "@fluentui/react-components";

/**
 * shadcn/Radix-compatible sub-component prop shapes, preserved verbatim so
 * every existing call site (`<Avatar><AvatarImage .../><AvatarFallback>
 * ...</AvatarFallback></Avatar>`) keeps compiling and rendering unchanged
 * (LEAF-06).
 */
export interface AvatarImageProps extends React.ComponentPropsWithoutRef<"img"> {}
export interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<"span"> {
  delayMs?: number;
}
export interface AvatarProps extends Omit<React.ComponentPropsWithoutRef<"span">, "color"> {}

/**
 * Marker component (LEAF-06's children-composition adapter). Never rendered
 * directly -- grepped across the codebase (`grep -rn "<AvatarImage" src`),
 * every current call site nests it inside `<Avatar>`, so it only needs to
 * carry `src`/`alt` for the parent `Avatar` to read via
 * `React.Children.forEach`. Returns `null` defensively in case any future
 * consumer renders it standalone.
 */
function AvatarImage(_props: AvatarImageProps) {
  return null;
}
AvatarImage.displayName = "AvatarImage";

/**
 * Marker component -- see `AvatarImage` above. Carries its `children`
 * (the fallback initials/content) for the parent `Avatar` to read.
 * `delayMs` (Radix's fallback-render-delay prop) is accepted for call-site
 * compatibility but has no Fluent equivalent -- Fluent's fallback
 * (initials/icon) renders synchronously whenever there's no image, so a
 * delay isn't meaningful here (no consumer currently passes it).
 */
function AvatarFallback(_props: AvatarFallbackProps) {
  return null;
}
AvatarFallback.displayName = "AvatarFallback";

/**
 * Fluent-backed adapter for the legacy Radix `Avatar` (LEAF-06, the final
 * and highest-complexity leaf component in Phase 39). Unlike every other
 * leaf component migrated so far, Avatar's *public API shape* itself
 * differs from Fluent's: the existing API is children-composition
 * (`<Avatar><AvatarImage/><AvatarFallback/></Avatar>`, mirroring Radix's
 * sub-component pattern) while Fluent's `Avatar` takes flat props (`name`,
 * `image`, `initials`). This wrapper parses `children` via
 * `React.Children.forEach` to extract the `AvatarImage`'s `src`/`alt` and
 * the `AvatarFallback`'s content, then feeds Fluent's flat props --
 * `AvatarImage`/`AvatarFallback` themselves are inert markers (see above),
 * never rendered.
 *
 * Radix auto-swaps to the fallback when the image fails to load; Fluent's
 * `Avatar` does NOT do this automatically for a manually-wired `image.src`
 * in the same way our adapter needs (Fluent's own internal `imageHidden`
 * state only reacts to the `onError` we forward it) -- so broken-image
 * detection is re-implemented explicitly here via `useState` + an
 * `onError` handler that flips `image` to `undefined`, guaranteeing the
 * initials/fallback render instead of the broken image (Pitfall 21).
 */
const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, children, ...props }, ref) => {
    const [imageFailed, setImageFailed] = React.useState(false);

    let imageSrc: string | undefined;
    let imageAlt: string | undefined;
    let fallbackContent: React.ReactNode;

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === AvatarImage) {
        const imageProps = child.props as AvatarImageProps;
        imageSrc = imageProps.src;
        imageAlt = imageProps.alt;
      } else if (child.type === AvatarFallback) {
        const fallbackProps = child.props as AvatarFallbackProps;
        fallbackContent = fallbackProps.children;
      }
    });

    const initials = typeof fallbackContent === "string" ? fallbackContent : undefined;
    const icon = fallbackContent && typeof fallbackContent !== "string" ? fallbackContent : undefined;

    const image: FluentAvatarProps["image"] =
      imageSrc && !imageFailed
        ? {
            src: imageSrc,
            alt: imageAlt,
            onError: () => setImageFailed(true),
          }
        : undefined;

    return (
      <FluentAvatar
        ref={ref}
        data-slot="avatar"
        name={imageAlt}
        image={image}
        initials={initials}
        icon={icon as React.ReactElement | undefined}
        className={mergeClasses(className)}
        {...props}
      />
    );
  },
);
Avatar.displayName = "Avatar";

export { Avatar, AvatarImage, AvatarFallback };
