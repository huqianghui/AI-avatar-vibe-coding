/**
 * E2E tests for the admin Avatar Personas management page (Phase 36-02).
 *
 * Covers the primary admin CRUD user story end-to-end against the running
 * dev server + backend, seeded with at least one enabled, default persona
 * (see `backend/scripts/seed_data.py::seed_default_avatar_persona`):
 *   1. Admin navigates via the sidebar "Avatar Personas" link.
 *   2. Table shows the currently-default persona with the Default badge.
 *   3. Admin creates two throwaway personas ("E2E Persona A" / "E2E Persona
 *      B") — never the seeded default — via the dialog (name + character/
 *      style + per-locale greeting + prompt fragment).
 *   4. Admin promotes A to default (proves the promote flow), sees B's
 *      delete-guard verified against A being default.
 *   5. Admin promotes B to default; A is no longer default so its delete
 *      button is enabled and the delete flow succeeds on A.
 *
 * HARD-01 fix: the seeded default persona (e.g. "Lisa") must never be
 * permanently deleted by this spec. `originalDefaultId` is recorded via API
 * in `beforeAll` and restored as default in `afterAll` BEFORE any cleanup
 * deletion is attempted -- the promoted-then-deleted persona in the test
 * body is always one of the two throwaways (A/B), never `originalDefaultId`.
 * This is verified by running the spec twice consecutively and confirming
 * the dev DB's default persona identity is unchanged after both runs.
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
import type { APIRequestContext } from "@playwright/test";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");
const API_BASE = "http://localhost:8000";

async function loginApi(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { username, password },
  });
  expect(resp.ok()).toBe(true);
  const data = await resp.json();
  return data.access_token as string;
}

/** Finds the persona currently flagged `is_default` -- never hardcode a
 * name (e.g. "Lisa"), since a prior failed run could have left a
 * different persona as default. */
async function getDefaultPersonaIdApi(
  request: APIRequestContext,
  token: string,
): Promise<string> {
  const resp = await request.get(`${API_BASE}/api/v1/admin/avatar-personas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok()).toBe(true);
  const personas = (await resp.json()) as Array<{ id: string; is_default: boolean }>;
  const defaultPersona = personas.find((p) => p.is_default);
  expect(defaultPersona).toBeTruthy();
  return defaultPersona!.id;
}

/** Restores `id` as the sole default persona. This is the single most
 * important teardown step -- HARD-01 exists because a prior version of
 * this spec permanently deleted the seeded default persona with no
 * restoration. Failure here is logged loudly (but non-fatal to the test
 * run) so it is never silently swallowed. */
async function restoreDefaultPersonaApi(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  try {
    const resp = await request.post(
      `${API_BASE}/api/v1/admin/avatar-personas/${id}/set-default`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok()) {
      // eslint-disable-next-line no-console
      console.error(
        `[admin-avatar-personas.spec] CRITICAL: failed to restore original default persona ${id}: ${resp.status()} ${await resp.text()}`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[admin-avatar-personas.spec] CRITICAL: failed to restore original default persona ${id}:`,
      err,
    );
  }
}

/** Deletes a throwaway persona created by this spec. Wrapped in try/catch,
 * independent per-persona, so one failure never skips cleanup of the
 * other throwaway. */
async function deletePersonaApi(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  try {
    await request.delete(`${API_BASE}/api/v1/admin/avatar-personas/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Cleanup errors are non-fatal
  }
}

test.describe("Admin Avatar Personas — CRUD workflow", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  let token: string;
  let originalDefaultId: string;
  // Cleared to `undefined` once the test body itself deletes/restores a
  // persona, so `afterAll` never attempts a redundant (harmless, but
  // noisy) second delete on an id that no longer exists.
  let personaAId: string | undefined;
  let personaBId: string | undefined;

  test.beforeAll(async ({ request }) => {
    token = await loginApi(request, "admin", "admin123");
    originalDefaultId = await getDefaultPersonaIdApi(request, token);
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    // Restore the original default FIRST -- this also clears the D-02
    // unique-default guard off of whichever throwaway (A or B) is still
    // default at the end of the test body, so the deletes below succeed.
    if (originalDefaultId) {
      await restoreDefaultPersonaApi(request, token, originalDefaultId);
    }
    if (personaAId) {
      await deletePersonaApi(request, token, personaAId);
    }
    if (personaBId) {
      await deletePersonaApi(request, token, personaBId);
    }
  });

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

    // 2. Table shows the currently-default persona (originalDefaultId,
    // recorded via API in beforeAll) with a "Default" badge
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator('[data-testid="persona-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const originalDefaultRow = table.locator(
      `[data-persona-id="${originalDefaultId}"]`,
    );
    await expect(
      originalDefaultRow.getByText("Default", { exact: true }),
    ).toBeVisible({ timeout: 10000 });

    // Helper: create a throwaway persona via the UI dialog, mirroring the
    // original single-persona creation flow exactly (name + character grid
    // + per-locale greeting + prompt fragment), just parameterized by name.
    async function createPersonaViaUi(name: string): Promise<string> {
      await page.getByRole("button", { name: /create persona/i }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await dialog.getByLabel(/^name$/i).fill(name);

      // Character & Style grid: pick the first available option (Lisa's first style)
      await dialog.locator("button", { hasText: /lisa/i }).first().click();

      // Greeting (per-locale — Section 4 was reworked in 37-03 Task 1) + prompt fragment
      await dialog.locator("#persona-greeting-en-US").fill(`Hello from ${name}!`);
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
      const id = createBody.id as string;
      expect(id).toBeTruthy();

      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      return id;
    }

    // Helper: promote a row to default via its UI "Set as default" link,
    // waiting on the network response exactly like the original test did.
    async function setDefaultViaUi(row: ReturnType<typeof table.locator>) {
      const setDefaultResponse = page.waitForResponse(
        (response) =>
          /\/api\/v1\/admin\/avatar-personas\/.+\/set-default$/.test(
            response.url(),
          ) && response.request().method() === "POST",
      );
      await row.getByRole("button", { name: /set as default/i }).click();
      expect((await setDefaultResponse).status()).toBe(200);
    }

    // 3. Create two throwaway personas -- A and B. Neither is
    // `originalDefaultId`, so the promote/delete flow below can never
    // touch the seeded default.
    const personaAName = `E2E Persona A ${Date.now()}`;
    personaAId = await createPersonaViaUi(personaAName);
    const rowA = table.locator(`[data-persona-id="${personaAId}"]`);
    await expect(rowA).toBeVisible({ timeout: 10000 });
    await expect(rowA).toContainText(personaAName);

    const personaBName = `E2E Persona B ${Date.now()}`;
    personaBId = await createPersonaViaUi(personaBName);
    const rowB = table.locator(`[data-persona-id="${personaBId}"]`);
    await expect(rowB).toBeVisible({ timeout: 10000 });
    await expect(rowB).toContainText(personaBName);

    // 4. Promote A to default (proves the promote flow)
    await setDefaultViaUi(rowA);
    await expect(rowA.getByText("Default", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // 5a. Delete action on A (now default) is disabled with a guard tooltip
    const rowADeleteButton = rowA.getByRole("button", { name: /delete persona/i });
    await expect(rowADeleteButton).toBeDisabled();

    // 5b. Promote B to default -- A stops being default (originalDefaultId
    // is still untouched throughout this entire sequence)
    await setDefaultViaUi(rowB);
    await expect(rowB.getByText("Default", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // A is no longer default -> its delete button re-enables and the
    // delete flow succeeds, mirroring the original delete-success
    // assertion but performed on a throwaway persona instead of the
    // seeded default.
    await expect(rowADeleteButton).toBeEnabled();
    await rowADeleteButton.click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/admin/avatar-personas/${personaAId}`) &&
        response.request().method() === "DELETE",
    );
    await confirmDialog.getByRole("button", { name: /^delete$/i }).click();
    expect((await deleteResponse).status()).toBe(204);
    // Deleted by the test itself -- afterAll must not attempt it again.
    personaAId = undefined;

    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await expect(rowA).not.toBeVisible({ timeout: 10000 });

    // B remains default at the end of the test body. `afterAll` restores
    // `originalDefaultId` as default (which also clears B's delete guard)
    // and then deletes B.
  });
});
