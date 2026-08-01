import { test, expect } from "@playwright/test";

test.describe("Health Checks", () => {
  test("backend health endpoint responds", async ({ request }) => {
    const response = await request.get("http://localhost:8000/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  test("frontend loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AI Avatar Platform/);
  });
});
