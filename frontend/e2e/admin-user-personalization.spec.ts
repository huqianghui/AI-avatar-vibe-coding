import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

// NOTE: The plan suggested reusing "Alice Wang" from admin-users.spec.ts as the
// known seeded user, but that name only exists in frontend unit-test mocks --
// the real backend seed (backend/scripts/seed_data.py) only creates
// admin/user1(Zhang Wei)/user2(Li Ming)/user3(Wang Fang). This spec targets the
// real seeded backend, so it uses "Zhang Wei" (user1) instead. See 33-08-SUMMARY.md.
const SEEDED_USER_NAME = "Zhang Wei";

test.describe("Admin User Personalization Dialog", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/users");
  });

  async function openPersonalizationDialog(page: import("@playwright/test").Page) {
    const row = page.getByRole("row", { name: new RegExp(SEEDED_USER_NAME, "i") });
    await expect(row).toBeVisible();
    await row.getByRole("button").click();
    await page.getByRole("menuitem", { name: "Personalization" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("opens personalization dialog and shows CRM/preference sections", async ({ page }) => {
    const dialog = await openPersonalizationDialog(page);

    // CRM match status line (either matched or unmatched copy) must be visible
    await expect(
      dialog.getByText(/CRM data matched|No CRM data matched/i),
    ).toBeVisible();

    // Add-row: category select + value input + Add button
    await expect(dialog.getByRole("combobox")).toBeVisible();
    await expect(dialog.getByPlaceholder("Enter preference value")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add" })).toBeVisible();
  });

  test("adds a preference tag and sees it as a chip", async ({ page }) => {
    const dialog = await openPersonalizationDialog(page);

    const uniqueValue = `E2E-${Date.now()}`;
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Focus Area" }).click();
    await dialog.getByPlaceholder("Enter preference value").fill(uniqueValue);
    await dialog.getByRole("button", { name: "Add" }).click();

    await expect(dialog.getByText(`Focus Area: ${uniqueValue}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("deletes a preference tag and shows an Undo toast", async ({ page }) => {
    const dialog = await openPersonalizationDialog(page);

    const uniqueValue = `E2E-Delete-${Date.now()}`;
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Focus Area" }).click();
    await dialog.getByPlaceholder("Enter preference value").fill(uniqueValue);
    await dialog.getByRole("button", { name: "Add" }).click();

    const chip = dialog.getByText(`Focus Area: ${uniqueValue}`);
    await expect(chip).toBeVisible({ timeout: 10000 });

    await dialog.getByTitle("Delete tag").last().click();

    await expect(chip).not.toBeVisible();
    await expect(page.getByText(/Deleted tag/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

    // No second blocking modal should appear alongside the personalization dialog
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });
});
