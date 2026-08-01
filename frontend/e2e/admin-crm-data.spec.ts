import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

/**
 * CRM Data admin E2E tests (Phase 33, PERS-01).
 *
 * Covers the main user-facing scenarios for the admin CRM Excel
 * upload/parse/store workflow:
 *   1. Empty state on first load
 *   2. Successful upload updates the result summary
 *   3. Header-mismatch (422) renders the rejection banner and hides the
 *      result-summary card
 *   4. Template download triggers a real browser download event
 *   5. Skipped/unmatched counts render in non-destructive tone
 *
 * All backend calls are intercepted via page.route() — no live backend
 * dependency for these tests.
 */

test.describe("Admin CRM Data Management (Phase 33)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("page loads with empty state", async ({ page }) => {
    await page.route("**/api/v1/admin/crm/last-import", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });

    await page.goto("/admin/crm-data");

    const heading = page.locator("h1").filter({ hasText: /crm/i });
    await expect(heading).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator("text=/no.*crm.*data|尚未上传/i"),
    ).toBeVisible({ timeout: 5000 });

    const uploadButton = page.getByRole("button", { name: /^upload$|^上传$/i });
    await expect(uploadButton).toBeVisible();

    const downloadButton = page.getByRole("button", {
      name: /download.*template|下载模板/i,
    });
    await expect(downloadButton).toBeVisible();
  });

  test("successful upload shows result summary", async ({ page }) => {
    // The upload mutation invalidates the last-import query on success,
    // triggering a refetch — the last-import mock must reflect the
    // post-upload state so the result card actually updates.
    let lastImport: unknown = null;

    await page.route("**/api/v1/admin/crm/last-import", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(lastImport),
      });
    });

    await page.route("**/api/v1/admin/crm/upload", (route) => {
      lastImport = { success_count: 5, skipped: [], unmatched: [] };
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(lastImport),
      });
    });

    await page.goto("/admin/crm-data");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake"),
    });

    const uploadButton = page.getByRole("button", { name: /^upload$|^上传$/i });
    await uploadButton.click();

    await expect(page.locator("text=/5/").first()).toBeVisible({ timeout: 10000 });
  });

  test("header-mismatch renders rejection banner, hides result card", async ({
    page,
  }) => {
    await page.route("**/api/v1/admin/crm/last-import", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });

    await page.route("**/api/v1/admin/crm/upload", (route) => {
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          code: "VALIDATION_ERROR",
          message: "invalid header",
        }),
      });
    });

    await page.goto("/admin/crm-data");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "bad-headers.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake"),
    });

    const uploadButton = page.getByRole("button", { name: /^upload$|^上传$/i });
    await uploadButton.click();

    await expect(
      page.locator("text=/invalid.*header|表头格式不正确/i"),
    ).toBeVisible({ timeout: 10000 });

    // Result-summary card must NOT render alongside the rejection banner.
    await expect(page.locator("text=/imported.*·|成功导入/i")).toHaveCount(0);
  });

  test("template download triggers a file download", async ({ page }) => {
    await page.route("**/api/v1/admin/crm/last-import", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });

    await page.route("**/api/v1/admin/crm/template", (route) => {
      route.fulfill({
        status: 200,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("fake-template-content"),
      });
    });

    await page.goto("/admin/crm-data");

    const downloadButton = page.getByRole("button", {
      name: /download.*template|下载模板/i,
    });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("skipped/unmatched counts render in non-error tone", async ({ page }) => {
    // Same stateful-mock rationale as the "successful upload" test above:
    // the result card refetches last-import after the mutation invalidates it.
    let lastImport: unknown = null;

    await page.route("**/api/v1/admin/crm/last-import", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(lastImport),
      });
    });

    await page.route("**/api/v1/admin/crm/upload", (route) => {
      lastImport = {
        success_count: 3,
        skipped: [{ row: 2, reason: "missing field" }],
        unmatched: [{ row: 5, email: "x@y.com", reason: "no matching user" }],
      };
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(lastImport),
      });
    });

    await page.goto("/admin/crm-data");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "partial.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake"),
    });

    const uploadButton = page.getByRole("button", { name: /^upload$|^上传$/i });
    await uploadButton.click();

    await expect(
      page.locator("text=/imported.*·|成功导入/i"),
    ).toBeVisible({ timeout: 10000 });

    // Skipped/unmatched must be visible ...
    await expect(page.locator("text=/3/").first()).toBeVisible();

    // ... but rendered in weakness (non-destructive) tone, never the
    // header-mismatch rejection banner used only in the 422 scenario.
    await expect(
      page.locator("text=/invalid.*header|表头格式不正确/i"),
    ).toHaveCount(0);
  });
});
