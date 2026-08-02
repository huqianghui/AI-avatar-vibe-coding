import { test, expect } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

test.describe("Route Guards — Unauthenticated", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    // Ensure no token is stored
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("access_token"));
    // Try accessing a protected route
    await page.goto("/user/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown route shows 404 page", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz");
    await expect(page.locator("text=404")).toBeVisible();
  });
});

test.describe("Route Guards — Authenticated User", () => {
  test.use({ storageState: join(authDir, "user.json") });

  test("authenticated user on /login is redirected to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });

  test("regular user cannot access admin routes", async ({ page }) => {
    await page.goto("/admin/dashboard");
    // Should be redirected away from admin dashboard
    await expect(page).toHaveURL(/\/user\/dashboard/);
  });

  test("logout redirects back to login", async ({ page }) => {
    await page.goto("/user/dashboard");
    await expect(page).toHaveURL(/\/user\/dashboard/);
    // Clear auth via localStorage and reload to simulate logout
    await page.evaluate(() => localStorage.removeItem("access_token"));
    await page.goto("/user/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Route Guards — Authenticated Admin", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("admin can access admin dashboard", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("admin on /login is redirected to dashboard", async ({ page }) => {
    await page.goto("/login");
    // Admin should be redirected (GuestRoute guard)
    await expect(page).not.toHaveURL(/\/login/);
  });
});
