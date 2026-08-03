import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored auth state
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("access_token"));
  });

  test("renders without infinite refresh loop", async ({ page }) => {
    await page.goto("/login");
    // Record the initial URL
    const initialUrl = page.url();
    // Wait 3 seconds — if the page is stuck in a refresh loop, the form will not be stable
    await page.waitForTimeout(3000);
    // Page should still be on /login with the form visible
    expect(page.url()).toBe(initialUrl);
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("stale token in localStorage does not block access to /login and user can still log in", async ({
    page,
  }) => {
    await page.goto("/login");
    // A garbage JWT the real backend's /auth/me will reject with 401 (see
    // backend/app/dependencies.py::get_current_user's JWTError -> 401 INVALID_TOKEN path),
    // simulating an expired/stale token without needing to mock the network.
    await page.evaluate(() =>
      localStorage.setItem("access_token", "stale-invalid-token-e2e"),
    );
    // Force the auth store to rehydrate `token` from localStorage on load,
    // reproducing the exact bug scenario.
    await page.reload();
    // Login form must still be reachable and not bounced away.
    await expect(page.locator("#username")).toBeVisible({ timeout: 10000 });
    // Prove login still works end-to-end from this state.
    await page.locator("#username").fill("user1");
    await page.locator("#password").fill("user123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("http://localhost:5173/");
    await expect(page).toHaveURL("/");
  });

  test("login form has all required fields", async ({ page }) => {
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#remember")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test("successful login as regular user redirects to the avatar page", async ({
    page,
  }) => {
    // LAND-01 (Phase 36): regular-user post-login now lands on `/` (the
    // avatar page), not the legacy `/user/dashboard` -- see login.tsx.
    await page.locator("#username").fill("user1");
    await page.locator("#password").fill("user123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("http://localhost:5173/");
    await expect(page).toHaveURL("/");
  });

  test("successful login as admin redirects to admin dashboard", async ({
    page,
  }) => {
    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("failed login shows error message", async ({ page }) => {
    await page.locator("#username").fill("wronguser");
    await page.locator("#password").fill("wrongpass");
    await page.locator('button[type="submit"]').click();
    // Error message should appear
    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 10000,
    });
  });

  test("password visibility toggle works", async ({ page }) => {
    const passwordInput = page.locator("#password");
    // Initially type is "password" (hidden)
    await expect(passwordInput).toHaveAttribute("type", "password");
    // Click the eye toggle button (inside the password field's parent)
    await page.locator("#password ~ button").click();
    // Now type should be "text" (visible)
    await expect(passwordInput).toHaveAttribute("type", "text");
    // Click again to hide
    await page.locator("#password ~ button").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
