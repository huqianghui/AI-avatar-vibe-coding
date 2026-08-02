/**
 * E2E tests for the admin Avatar Personas management page (Phase 36-02).
 *
 * Covers the primary admin CRUD user story end-to-end against the running
 * dev server + backend, seeded with at least one enabled, default persona
 * (see `backend/scripts/seed_data.py::seed_default_avatar_persona`):
 *   1. Admin navigates via the sidebar "Avatar Personas" link.
 *   2. Table shows the currently-default persona with the Default badge.
 *   3. Admin creates a new persona (name + character/style + greeting +
 *      prompt fragment) and the new row appears.
 *   4. Admin sets the new persona as default and the badge moves.
 *   5. Admin attempts to delete the current default (now the new persona)
 *      and sees the disabled Delete button + guard tooltip; deleting the
 *      previously-default persona (no longer default) succeeds instead.
 *
 * Rows are identified via the `data-persona-id` attribute set on each
 * `<tr>` (see `persona-table.tsx`) rather than by name/character text --
 * both the seeded persona and any persona created with the same character
 * (as in step 3, which clones the seeded character/style) can share
 * visible text such as a character's display name or thumbnail `alt`,
 * making plain text-based row matching ambiguous.
 */
import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Admin Avatar Personas — CRUD workflow", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("admin sidebar shows Avatar Personas link", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForTimeout(1500);

    const link = page.getByRole("link", { name: /avatar personas/i }).first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test("full create -> set-default -> delete-guard -> delete workflow", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    await page.waitForTimeout(1000);

    // 1. Navigate via sidebar link
    await page.getByRole("link", { name: /avatar personas/i }).first().click();
    await page.waitForURL(/\/admin\/avatar-personas/, { timeout: 10000 });

    // Page title renders (h1 — the admin-layout Breadcrumb also renders an
    // h2 with the same label, so scope to level 1 to avoid a strict-mode
    // violation matching both headings).
    await expect(
      page.getByRole("heading", { name: /avatar personas/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 });

    // 2. Table shows the currently-default persona with a "Default" badge
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator('[data-testid="persona-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const initialDefaultRow = rows.filter({
      has: page.getByText("Default", { exact: true }),
    });
    await expect(initialDefaultRow).toHaveCount(1, { timeout: 10000 });
    const initialDefaultId = await initialDefaultRow.getAttribute(
      "data-persona-id",
    );
    expect(initialDefaultId).toBeTruthy();

    // 3. Create a new persona
    const personaName = `E2E Persona ${Date.now()}`;
    await page.getByRole("button", { name: /create persona/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByLabel(/^name$/i).fill(personaName);

    // Character & Style grid: pick the first available option (Lisa's first style)
    await dialog.locator("button", { hasText: /lisa/i }).first().click();

    // Greeting + prompt fragment
    await dialog.locator("#persona-greeting").fill("Hello from the E2E persona!");
    await dialog
      .locator("#persona-prompt-fragment")
      .fill("Speak concisely and warmly.");

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/avatar-personas") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /save persona/i }).click();
    const createBody = await (await createResponse).json();
    const newPersonaId = createBody.id as string;
    expect(newPersonaId).toBeTruthy();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    const newRow = table.locator(`[data-persona-id="${newPersonaId}"]`);
    await expect(newRow).toBeVisible({ timeout: 10000 });
    await expect(newRow).toContainText(personaName);

    // 4. Set the new persona as default
    const setDefaultResponse = page.waitForResponse(
      (response) =>
        /\/api\/v1\/admin\/avatar-personas\/.+\/set-default$/.test(
          response.url(),
        ) && response.request().method() === "POST",
    );
    await newRow.getByRole("button", { name: /set as default/i }).click();
    expect((await setDefaultResponse).status()).toBe(200);

    // Badge should now render on the new row instead of a "Set as default" link
    await expect(newRow.getByText("Default", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // 5a. Delete action on the (now) default row is disabled with a guard tooltip
    const newRowDeleteButton = newRow.getByRole("button", {
      name: /delete persona/i,
    });
    await expect(newRowDeleteButton).toBeDisabled();

    // 5b. The previously-default persona (no longer default) can now be deleted
    const previousDefaultRow = table.locator(
      `[data-persona-id="${initialDefaultId}"]`,
    );
    await previousDefaultRow
      .getByRole("button", { name: /delete persona/i })
      .click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/avatar-personas/") &&
        response.request().method() === "DELETE",
    );
    await confirmDialog.getByRole("button", { name: /^delete$/i }).click();
    expect((await deleteResponse).status()).toBe(204);

    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await expect(previousDefaultRow).not.toBeVisible({ timeout: 10000 });
  });
});
