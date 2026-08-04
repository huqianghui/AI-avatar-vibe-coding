/**
 * E2E tests for the persona editor's Knowledge / Foundry IQ section
 * (persona-hcp-foundry-alignment Increment C).
 *
 * Mirrors the HCP editor's knowledge-base UX (there is no existing HCP
 * knowledge-base E2E spec to reuse verbatim -- confirmed via a repo-wide
 * search for `*knowledge*.spec.ts`, none found), applied to the persona
 * editor instead:
 *   1. Knowledge card is absent while creating a brand-new persona (no
 *      `id` yet -- the section is gated on `isEdit && id`).
 *   2. After saving, the persona's edit page shows the Knowledge card with
 *      the empty-state copy.
 *   3. "Add" -> "Connect to Foundry IQ" opens the connect dialog with its
 *      title/description and Cancel/Connect actions.
 *   4. Cancel closes the dialog without attempting a connection (no
 *      dependency on a real Azure AI Search connection existing in this
 *      environment).
 *
 * Cleanup deletes the throwaway persona via API in `afterAll`, following
 * the same non-fatal try/catch pattern as `admin-avatar-personas.spec.ts`.
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

test.describe("Admin Persona Editor — Knowledge / Foundry IQ section", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  let token: string;
  let personaId: string | undefined;

  test.beforeAll(async ({ request }) => {
    token = await loginApi(request, "admin", "admin123");
  });

  test.afterAll(async ({ request }) => {
    if (!token || !personaId) return;
    await deletePersonaApi(request, token, personaId);
  });

  test("knowledge card is hidden while creating, then shown with empty state after save, and the connect dialog opens/cancels", async ({
    page,
  }) => {
    // Persona creation synchronously provisions a real AI Foundry agent
    // (agent_sync_service), which can take well over the default 30s test
    // timeout -- extend it rather than racing the sync.
    test.setTimeout(60000);

    await page.goto("/admin/avatar-personas");
    await expect(
      page.getByRole("heading", { name: /avatar personas/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /create persona/i }).click();
    await page.waitForURL(/\/admin\/avatar-personas\/new$/, { timeout: 10000 });

    // 1. No Knowledge card yet -- brand-new persona has no id.
    await expect(page.getByText("Knowledge Bases")).not.toBeVisible();

    const personaName = `E2E Persona Knowledge ${Date.now()}`;
    await page.getByPlaceholder(/e\.g\., lisa - casual/i).fill(personaName);
    await page.locator("button", { hasText: /lisa/i }).first().click();
    await page.locator("#persona-editor-greeting").fill(`Hello from ${personaName}!`);
    await page
      .locator("#persona-editor-prompt-fragment")
      .fill("Speak concisely and warmly.");

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/avatar-personas") &&
        response.request().method() === "POST",
      { timeout: 45000 },
    );
    await page.getByRole("button", { name: /save persona/i }).click();
    const createBody = await (await createResponse).json();
    personaId = createBody.id as string;
    expect(personaId).toBeTruthy();

    await page.waitForURL(new RegExp(`/admin/avatar-personas/${personaId}/edit$`), {
      timeout: 10000,
    });

    // 2. Edit mode now shows the Knowledge card with the empty state.
    await expect(page.getByText("Knowledge Bases", { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(
        "No knowledge bases connected. Click Add to connect a Foundry IQ knowledge base.",
      ),
    ).toBeVisible();

    // 3. Open the "Add" dropdown -> "Connect to Foundry IQ" -> dialog opens.
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("menuitem", { name: /connect to foundry iq/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(
      dialog.getByText("Connect to Foundry IQ", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^connect$/i }),
    ).toBeDisabled();

    // 4. Cancel closes the dialog without side effects.
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Empty state is unchanged -- no connection was made.
    await expect(
      page.getByText(
        "No knowledge bases connected. Click Add to connect a Foundry IQ knowledge base.",
      ),
    ).toBeVisible();
  });
});
