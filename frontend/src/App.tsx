import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RendererProvider, createDOMRenderer } from "@fluentui/react-components";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { Toaster } from "@/components/ui/sonner";
import { ConfigProvider } from "@/contexts/config-context";
import { FluentThemeBridge } from "@/components/providers/fluent-theme-bridge";
import { SplashScreen } from "@/components/shared/splash-screen";
import { useThemeStore } from "@/stores/theme-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

// Module-scope Griffel renderer, constructed once (not per-render) and anchored
// to index.html's #griffel-insertion-point so Griffel's <style> tags land before
// Tailwind's injected stylesheet in both dev and production builds.
const insertionPoint = document.getElementById("griffel-insertion-point") ?? undefined;
const renderer = createDOMRenderer(document, insertionPoint ? { insertionPoint } : undefined);

function AppContent() {
  const { mode } = useThemeStore();

  return (
    <QueryClientProvider client={queryClient}>
      <RendererProvider renderer={renderer}>
        <FluentThemeBridge>
          <ConfigProvider>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  Loading...
                </div>
              }
            >
              <RouterProvider router={router} />
            </Suspense>
          </ConfigProvider>
          <Toaster
            position="top-right"
            theme={mode === "dark" ? "dark" : "light"}
            toastOptions={{
              style: {
                "--normal-bg": "var(--popover)",
                "--normal-text": "var(--popover-foreground)",
                "--normal-border": "var(--border)",
              } as React.CSSProperties,
            }}
          />
        </FluentThemeBridge>
      </RendererProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <>
      <SplashScreen />
      <AppContent />
    </>
  );
}
