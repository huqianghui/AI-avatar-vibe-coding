/**
 * Post-login landing E2E -- main user story for LAND-01 (Phase 36-05).
 *
 * Proves the redirect-target change end-to-end in a real browser: a seeded
 * regular user who logs in via the `/login` form lands on exactly `/` (the
 * avatar page) and sees the already-existing personalization header state
 * (the "Personalized" `Badge` + their email, from Phase 33/35), a seeded
 * admin still lands on exactly `/admin/dashboard` (unchanged), and
 * `/user/dashboard` remains directly reachable by URL for a regular user
 * (D-10 regression guard -- this plan changes only the post-login landing
 * target, never the legacy route's own reachability).
 *
 * Regular-user login is driven through the real `/login` form (real
 * backend, seeded `user1`/`user123` -- same credentials `auth.setup.ts` /
 * `login.spec.ts` already use) rather than a pre-seeded `storageState`,
 * since the whole point of this spec is proving the *redirect itself*
 * fires correctly, which a pre-authenticated storageState would skip. The
 * anonymous session/WebRTC/personalized-session/persona-selection
 * endpoints are mocked with deterministic fixtures -- the same documented
 * allowance `anonymous-avatar-qa.spec.ts` / `personalized-avatar-qa.spec.ts`
 * / `persona-switch.spec.ts` use -- so this spec stays isolated from the
 * real dev DB's CRM-Excel-mapping and persona-catalog seed state.
 */
import { test, expect, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

const ANON_SESSION_TOKEN = "e2e-anon-session-token-post-login-landing";
const PERSONALIZED_SESSION_ID = "e2e-personalized-session-id-post-login-landing";
const USER1_EMAIL = "user1@aicoach.com";

const DEFAULT_PERSONA = {
  id: "persona-default-e2e",
  name: "Lisa",
  character: "lisa",
  style: "casual",
  greeting: "Hi, I'm Lisa!",
  is_default: true,
};

async function mockAnonymousSession(page: Page): Promise<void> {
  await page.route("**/public/avatar/session", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        session_token: ANON_SESSION_TOKEN,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    }),
  );
}

/** Fails the always-fires WebRTC/mic connect attempt fast (no getUserMedia
 * mock either) rather than leaving a real 30s connection-timeout pending --
 * same pattern as `anonymous-avatar-qa.spec.ts` / `personalized-avatar-qa.spec.ts`. */
async function mockWebrtcSessionFailure(page: Page): Promise<void> {
  await page.route("**/public/avatar/webrtc/session", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
}

async function mockPersonalizedSession(page: Page): Promise<void> {
  await page.route("**/api/v1/avatar/session", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: PERSONALIZED_SESSION_ID,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    }),
  );
}

/** Deterministic single-default-persona fixture for `GET /api/v1/personas`
 * and `GET /api/v1/users/me/selected-persona` -- mirrors `persona-switch.spec.ts`'s
 * mocking convention rather than depending on the real dev DB's seeded
 * persona catalog. */
async function mockPersonaSelection(page: Page): Promise<void> {
  await page.route("**/api/v1/personas", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([DEFAULT_PERSONA]),
    });
  });

  await page.route("**/api/v1/users/me/selected-persona", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: DEFAULT_PERSONA.id,
        name: DEFAULT_PERSONA.name,
        character: DEFAULT_PERSONA.character,
        style: DEFAULT_PERSONA.style,
        greeting: DEFAULT_PERSONA.greeting,
      }),
    });
  });
}

/**
 * The always-connected avatar auto-attempts a WebRTC/mic connection on
 * mount. `mockWebrtcSessionFailure` makes that attempt fail fast, but a
 * failed attempt also opens the modal `MicPermissionDialog` -- which Radix
 * marks the rest of the page `aria-hidden` while open. Dismiss it via the
 * app's own "Use Text Instead" escape hatch (English copy -- these tests
 * run under the default `en-US` locale). No-ops if the dialog never opens.
 */
async function dismissMicDialogIfOpen(page: Page): Promise<void> {
  const useTextButton = page.getByRole("button", { name: "Use Text Instead" });
  try {
    await useTextButton.waitFor({ state: "visible", timeout: 3_000 });
    await useTextButton.click();
  } catch {
    // Dialog never opened -- nothing to dismiss.
  }
}

test.describe("Post-login landing (Phase 36-05, LAND-01)", () => {
  test.use({ locale: "en-US" });

  test("a regular user who logs in lands on exactly / with the personalized header active", async ({
    page,
  }) => {
    await mockAnonymousSession(page);
    await mockWebrtcSessionFailure(page);
    await mockPersonalizedSession(page);
    await mockPersonaSelection(page);

    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("access_token"));
    await page.reload();

    await page.locator("#username").fill("user1");
    await page.locator("#password").fill("user123");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("http://localhost:5173/");
    await expect(page).toHaveURL("/");

    await dismissMicDialogIfOpen(page);

    await expect(page.getByText("Personalized")).toBeVisible();
    await expect(page.getByText(USER1_EMAIL)).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).not.toBeVisible();
  });

  test("/user/dashboard remains directly reachable by URL for the same regular user (D-10)", async ({
    browser,
  }) => {
    // Uses the pre-authenticated storageState (same seeded user1) rather
    // than repeating the login-form flow -- this test's only concern is
    // that the legacy route is still reachable, mirroring
    // `routing.spec.ts`'s existing direct-nav proof as an explicit
    // acceptance check dedicated to this requirement.
    const context = await browser.newContext({ storageState: join(authDir, "user.json") });
    const page = await context.newPage();

    await page.goto("/user/dashboard");
    await expect(page).toHaveURL(/\/user\/dashboard/);

    await context.close();
  });

  test("an admin who logs in still lands on exactly /admin/dashboard, unchanged", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("access_token"));
    await page.reload();

    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("admin123");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
