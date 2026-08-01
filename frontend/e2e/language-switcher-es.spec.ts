/**
 * LANG-01 closing-gate E2E (Phase 34-05, Task 3).
 *
 * Proves, against the real running app (real i18next-http-backend fetches of
 * `/locales/{{lng}}/{{ns}}.json`, no network mock needed), that switching to
 * each es-* locale variant persists the choice and renders genuinely
 * translated UI text with zero i18next missing-key fallback.
 *
 * Route choice deviation from the plan's literal wording ("navigate to `/`"):
 * `AvatarPage` (the `/` route) does not render `<LanguageSwitcher />` at all
 * (confirmed by reading `frontend/src/pages/avatar-page.tsx` in full -- it has
 * no `LanguageSwitcher` import/usage). The switcher only lives in
 * `auth-layout.tsx` (/login), `user-layout.tsx`, and `admin-layout.tsx`. Of
 * those, `/login` is the only route that needs zero auth/session mocking,
 * matching this plan's "no avatar-session mocking needed" interface note --
 * so this spec uses `/login` as its base route (Rule 3: auto-fixed blocking
 * issue, the literal `/` target has no switcher to click).
 */
import { test, expect, type Page } from "@playwright/test";

const ES_LOCALES = [
  { code: "es-ES", label: "Español (España)" },
  { code: "es-MX", label: "Español (México)" },
  { code: "es-US", label: "Español (EE. UU.)" },
] as const;

/** auth.json `email` label: "Correo Electrónico" in all 3 es-* variants,
 * genuinely different from the en-US source ("Email") -- proves real
 * translated UI chrome text rendered, not just localStorage persistence. */
const ES_EMAIL_LABEL = "Correo Electrónico";

async function switchLanguage(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: /switch language/i }).click();
  // The dropdown item's accessible name is "{flag} {label}" (flag rendered
  // in a sibling <span>, label as a raw text node) -- match by substring,
  // not exact, since no single element's full text equals the bare label.
  await page.getByRole("menuitem", { name: label }).click();
}

for (const { code, label } of ES_LOCALES) {
  test.describe(`Language switcher — ${code}`, () => {
    test(`switching to ${code} persists locale and renders translated UI with no missing-key warning`, async ({
      page,
    }) => {
      const missingKeyWarnings: string[] = [];
      page.on("console", (msg) => {
        if (/missingKey/i.test(msg.text())) {
          missingKeyWarnings.push(msg.text());
        }
      });

      await page.goto("/login");
      // Start from a known baseline so the switch is observable regardless
      // of a prior test run's leftover localStorage state.
      await page.evaluate(() => localStorage.removeItem("i18nextLng"));
      await page.reload();

      await switchLanguage(page, label);

      await expect(
        page.getByRole("button", { name: /switch language/i }),
      ).toContainText("ES");

      const storedLang = await page.evaluate(() =>
        localStorage.getItem("i18nextLng"),
      );
      expect(storedLang).toBe(code);

      await expect(page.getByText(ES_EMAIL_LABEL)).toBeVisible();

      expect(missingKeyWarnings).toEqual([]);
    });
  });
}
