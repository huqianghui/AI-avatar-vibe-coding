import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export function SplashScreen() {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeOutTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1500);

    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 1800);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
      style={{
        animation: fadeOut
          ? "splash-fade-out 300ms ease forwards"
          : "splash-fade-in 300ms ease",
      }}
    >
      {/* Lightbulb icon */}
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary-foreground/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-foreground"
        >
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      </div>

      {/* Decorative loading overlay — must not be an h1: unscoped page.locator("h1")
          E2E assertions collide with it under Playwright strict mode */}
      <p className="text-2xl font-medium text-primary-foreground">
        {t("appName")}
      </p>

      {/* Powered by */}
      <p className="mt-2 text-sm text-primary-foreground/70">
        {t("poweredBy")}
      </p>
    </div>
  );
}
