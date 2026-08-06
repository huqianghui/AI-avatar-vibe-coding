import { useMemo } from "react";
import { FluentProvider } from "@fluentui/react-components";
import { useThemeStore } from "@/stores/theme-store";
import { getFluentTheme } from "@/styles/fluent-theme";

/**
 * Read-only subscriber to the existing theme-store: translates {mode, accent}
 * into one of the 10 pre-generated Fluent Theme objects and renders a
 * transparent, layout-neutral FluentProvider around its children.
 *
 * This component never writes back to theme-store.ts -- the .dark / .theme-*
 * class-toggling mechanism there remains the single source of truth for
 * Tailwind-driven business UI.
 */
export function FluentThemeBridge({ children }: { children: React.ReactNode }) {
  const { mode, accent } = useThemeStore();
  const theme = useMemo(() => getFluentTheme(mode, accent), [mode, accent]);

  return (
    <FluentProvider
      theme={theme}
      className="contents"
      style={{ background: "transparent", color: "inherit" }}
    >
      {children}
    </FluentProvider>
  );
}
