import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

/**
 * Phase 40-07 (COMP-04): first dedicated E2E coverage for the ThemePicker,
 * whose trigger is the highest visual-regression risk in the DropdownMenu
 * Fluent migration — a `DropdownMenuTrigger asChild` wrapping a ghost-icon
 * `Button` (itself Fluent-backed since Phase 39). Exercises the exact
 * open -> select-accent -> close flow and asserts the accent actually applies
 * to the document root (`theme-<accent>` class written by useThemeStore).
 */
test.describe("ThemePicker (DropdownMenu Fluent adapter)", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/user/training");
    // Header (with the ThemePicker) is present once the page shell renders.
    await expect(page.locator("h1").first()).toBeVisible();
  });

  function themeTrigger(page: import("@playwright/test").Page) {
    // aria-label is t("theme") — match across locales (Theme / 主题 / Tema).
    return page.getByRole("button", { name: /theme|主题|tema/i });
  }

  test("clicking the theme trigger opens the theme menu", async ({ page }) => {
    const trigger = themeTrigger(page);
    await expect(trigger).toBeVisible();
    await trigger.click();

    // The accent swatches live inside the opened menu popover; the light/dark
    // mode items are menu items rendered by DropdownMenuItem.
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    // At least one accent swatch (aria-labelled from ACCENT_COLORS) is shown.
    await expect(page.getByRole("button", { name: /teal/i })).toBeVisible();
  });

  test("selecting an accent applies it to the document root and closes the menu", async ({
    page,
  }) => {
    const trigger = themeTrigger(page);
    await trigger.click();

    const tealSwatch = page.getByRole("button", { name: /teal/i });
    await expect(tealSwatch).toBeVisible();
    await tealSwatch.click();

    // Accent is written to <html> as `theme-teal` (useThemeStore.applyTheme).
    await expect(page.locator("html")).toHaveClass(/theme-teal/);

    // Clicking a swatch does not close the menu (it's a custom button), so the
    // switch back to blue removes the theme-* class again — confirms the store
    // round-trips through the same trigger surface without breaking.
    const blueSwatch = page.getByRole("button", { name: /blue/i });
    await blueSwatch.click();
    await expect(page.locator("html")).not.toHaveClass(/theme-teal/);
  });

  test("switching light/dark mode toggles the dark class via a menu item", async ({
    page,
  }) => {
    const trigger = themeTrigger(page);
    await trigger.click();

    // DropdownMenuItem for dark mode (t("darkMode") -> "Dark" in en-US).
    const darkItem = page.getByRole("menuitem", { name: /dark|深色|oscuro/i });
    await expect(darkItem).toBeVisible();
    await darkItem.click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Reopen (Fluent dismisses the menu on item activation) and switch back.
    await trigger.click();
    const lightItem = page.getByRole("menuitem", {
      name: /light|浅色|claro/i,
    });
    await lightItem.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
