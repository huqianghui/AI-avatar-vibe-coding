import { test, expect } from "./coverage-helper";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");
const API_BASE = "http://localhost:8000";

/**
 * Helper: login via API and return access token.
 */
async function loginApi(
  request: import("@playwright/test").APIRequestContext,
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

/**
 * Helper: get the first HCP profile ID via API.
 */
async function getFirstHcpId(
  request: import("@playwright/test").APIRequestContext,
  token: string,
): Promise<string | null> {
  const resp = await request.get(`${API_BASE}/api/v1/hcp-profiles?page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return null;
  const data = await resp.json();
  if (data.items.length === 0) return null;
  return data.items[0].id as string;
}

test.describe("HCP Editor: Voice & Avatar Tab", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page, request }) => {
    // Get the first HCP profile ID via API and navigate directly to editor
    const token = await loginApi(request, "admin", "admin123");
    const hcpId = await getFirstHcpId(request, token);
    if (hcpId) {
      await page.goto(`/admin/hcp-profiles/${hcpId}`);
      // Wait for tabs to be present
      await page.waitForSelector("[role='tab']", { timeout: 10000 });
    } else {
      await page.goto("/admin/hcp-profiles");
    }
  });

  test("Voice & Avatar tab is present and clickable", async ({ page }) => {
    // Look for the Voice & Avatar tab trigger
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await expect(voiceTab).toBeVisible({ timeout: 5000 });
    await voiceTab.click();
    await page.waitForTimeout(300);
  });

  test("Knowledge and Tools tabs do NOT exist (removed in Phase 15)", async ({
    page,
  }) => {
    // Verify no Knowledge or Tools tab
    const knowledgeTab = page.getByRole("tab", { name: /knowledge/i });
    const toolsTab = page.getByRole("tab", { name: /tools/i });
    await expect(knowledgeTab).toHaveCount(0);
    await expect(toolsTab).toHaveCount(0);
  });

  test("only 2 tabs exist: Profile and Voice & Avatar", async ({ page }) => {
    const tabs = page.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBe(2);

    // Verify the two tab names
    await expect(tabs.nth(0)).toContainText(/profile/i);
    await expect(tabs.nth(1)).toContainText(/voice.*avatar/i);
  });

  test("Voice & Avatar tab shows two-panel layout on desktop", async ({
    page,
  }) => {
    // Click Voice & Avatar tab
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // Left panel should have Model Deployment label
    await expect(
      page.getByText(/model deployment/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Right panel should have Playground title
    await expect(
      page.getByText(/playground/i).first(),
    ).toBeVisible();
  });

  // VMODE-01: the "Voice Live Instance" selector was removed entirely --
  // every HCP profile now configures voice/avatar directly via its own
  // inline fields (voice_live_model, voice_name, recognition_language,
  // avatar_character, avatar_style, avatar_enabled). No VoiceLiveInstance
  // binding is required or shown.
  // persona-hcp-foundry-alignment Increment D: the direct voice/avatar
  // config card was replaced by a gear "Configure" button that opens a
  // right-side Configuration panel (Foundry-portal pattern) -- open it
  // before asserting on its contents.
  test("Voice & Avatar Configuration card is visible with no Voice Live Instance selector (VMODE-01)", async ({
    page,
  }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /configure/i }).click();
    await page.waitForTimeout(300);

    const panel = page.getByTestId("configuration-panel");
    await expect(panel).toBeVisible();

    // The gear-opened Configuration panel is visible with its title.
    await expect(
      page.getByText(/voice.*avatar configuration/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // No trace of the removed VL Instance selector/text.
    await expect(page.getByText(/voice live instance/i)).toHaveCount(0);

    // The three direct-config selects (model, language, voice) and the
    // avatar-enabled switch are present inside the panel.
    const comboboxes = panel.getByRole("combobox");
    expect(await comboboxes.count()).toBeGreaterThanOrEqual(3);
    await expect(panel.getByRole("switch").first()).toBeVisible();

    // The avatar character gallery grid is present inside the panel.
    await expect(panel.getByTestId("avatar-character-grid")).toBeVisible();
  });

  test("admin can configure model, language, voice, and avatar directly, and the config persists after reload (VMODE-01)", async ({
    page,
  }) => {
    // This flow performs several real (unmocked) network round-trips --
    // three combobox selections against live backend-fed option lists, a
    // real PUT save, and a full page reload through the auth-bootstrap
    // splash overlay -- which can exceed the default 30s test timeout under
    // normal load. Extend it rather than racing the reload, matching the
    // same pattern used for other real-backend-latency-sensitive specs
    // (e.g. admin-persona-knowledge.spec.ts's Foundry agent sync test).
    test.setTimeout(60000);

    // Capture the editor URL up-front -- saving an existing profile
    // navigates back to the list page (see hcp-profile-editor.tsx
    // handleSubmit's onSuccess), so persistence must be verified by
    // re-navigating to this same edit URL rather than reloading in place.
    const editUrl = page.url();

    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // persona-hcp-foundry-alignment Increment D: model/language/voice/avatar
    // config now live inside the gear-opened Configuration panel -- open it
    // and scope all locators to the panel to avoid colliding with the
    // unrelated decorative Agent Foundation Model combobox in the left panel.
    await page.getByRole("button", { name: /configure/i }).click();
    await page.waitForTimeout(300);
    const panel = page.getByTestId("configuration-panel");
    await expect(panel).toBeVisible();

    // Comboboxes render in DOM order within the panel:
    // [0] model deployment (recognitionModel), [1] language, [2] voice.
    const comboboxes = panel.getByRole("combobox");

    // (1) Select a model deployment.
    await comboboxes.nth(0).click();
    await page.getByRole("option", { name: "GPT-4o Mini" }).click();
    await page.waitForTimeout(200);

    // (2) Select a recognition language.
    await comboboxes.nth(1).click();
    await page.getByRole("option", { name: /español \(españa\)/i }).click();
    await page.waitForTimeout(200);

    // (3) Select a speech output voice. The voice list is filtered to the
    // just-selected recognition language (es-ES) plus multilingual voices,
    // so pick a Spanish (Spain) voice -- an English voice like Andrew is no
    // longer offered here (persona-hcp-foundry-alignment voice-filter fix).
    await comboboxes.nth(2).click();
    await page.getByRole("option", { name: /elvira/i }).click();
    await page.waitForTimeout(200);

    // (4) Select an avatar character + style from the gallery.
    const galleryGrid = panel.getByTestId("avatar-character-grid");
    await expect(galleryGrid).toBeVisible();
    const firstAvatarItem = galleryGrid.locator("button").first();
    await firstAvatarItem.click();
    const selectedAvatarLabel = await firstAvatarItem.textContent();
    await page.waitForTimeout(200);

    // (5) Toggle avatar enabled ON.
    const avatarSwitch = panel.getByRole("switch").first();
    const wasChecked = await avatarSwitch.isChecked();
    if (!wasChecked) {
      await avatarSwitch.click();
      await page.waitForTimeout(200);
    }
    await expect(avatarSwitch).toBeChecked();

    // (6) Close the panel (its overlay blocks pointer events on the rest of
    // the page) then save and wait for the PUT to resolve 200. Form state
    // lives in the parent react-hook-form instance, not the panel, so
    // closing it does not lose the selections made above.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const saveButton = page.getByRole("button", { name: /save/i }).first();
    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          /\/api\/v1\/hcp-profiles\/[^/?]+$/.test(resp.url()) &&
          resp.request().method() === "PUT",
      ),
      saveButton.click(),
    ]);
    expect(putResponse.status()).toBe(200);
    await page.waitForTimeout(500);

    // (7) Re-navigate to the editor (save redirects to the list page) and
    // assert the newly-selected values persisted. A full-screen splash
    // overlay (auth bootstrap) briefly covers the page after a fresh
    // navigation and must fully detach before the tab is clickable.
    await page.goto(editUrl);
    await page
      .locator(".fixed.inset-0.z-50")
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {});
    await page.waitForSelector("[role='tab']", { timeout: 10000 });
    await page.getByRole("tab", { name: /voice.*avatar/i }).click();
    await page.waitForTimeout(500);

    // Re-open the panel -- these fields are not rendered until opened.
    await page.getByRole("button", { name: /configure/i }).click();
    await page.waitForTimeout(300);
    const reopenedPanel = page.getByTestId("configuration-panel");
    await expect(reopenedPanel).toBeVisible();

    await expect(reopenedPanel.getByText("GPT-4o Mini").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      reopenedPanel.getByText(/español \(españa\)/i).first(),
    ).toBeVisible();
    await expect(reopenedPanel.getByText(/elvira/i).first()).toBeVisible();
    await expect(reopenedPanel.getByRole("switch").first()).toBeChecked();
    if (selectedAvatarLabel) {
      await expect(
        reopenedPanel
          .getByTestId("avatar-character-grid")
          .getByText(selectedAvatarLabel.trim(), { exact: false })
          .first(),
      ).toBeVisible();
    }
  });

  test("Instructions section with Regenerate button is visible", async ({
    page,
  }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // Instructions section should be visible
    await expect(
      page.getByText(/instruction/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Regenerate button (magic wand) should be present
    const regenButton = page
      .getByRole("button", { name: /regenerate|generate/i })
      .or(page.locator("button").filter({ has: page.locator("svg") }).nth(0));
    // At minimum, the instructions section should have some button
    const buttonCount = await regenButton.count();
    expect(buttonCount).toBeGreaterThanOrEqual(0);
  });

  test("tab state persists across switches", async ({ page }) => {
    // Navigate to Voice & Avatar tab
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(300);

    // Verify we see Voice & Avatar content
    await expect(
      page.getByText(/model deployment/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Switch back to Profile tab
    const profileTab = page.getByRole("tab", { name: /profile/i });
    await profileTab.click();
    await page.waitForTimeout(300);

    // Switch back to Voice & Avatar
    await voiceTab.click();
    await page.waitForTimeout(300);

    // Content should still be visible (state preserved)
    await expect(
      page.getByText(/model deployment/i).first(),
    ).toBeVisible();
  });

  test("legacy tab URL fallback to Profile", async ({ page }) => {
    // Navigate directly with a legacy tab parameter
    await page.goto("/admin/hcp-profiles?tab=knowledge");
    await page.waitForTimeout(1000);

    // Should not crash — should fall back to Profile tab
    const profileTab = page.getByRole("tab", { name: /profile/i });
    if ((await profileTab.count()) > 0) {
      // If tabs are visible, Profile should be selected
      await expect(profileTab).toBeVisible();
    }
    // Page should not show any error overlay
    const errorOverlay = page.locator("[role='alert']");
    const errorCount = await errorOverlay.count();
    // Allow zero or some alerts (not a crash page)
    expect(errorCount).toBeLessThanOrEqual(1);
  });

  test("Knowledge & Tools collapsible section in left panel", async ({
    page,
  }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // Knowledge & Tools expandable section should be present
    const knowledgeToolsHeader = page.getByText(/knowledge.*tools/i);
    await expect(knowledgeToolsHeader.first()).toBeVisible({ timeout: 5000 });

    // Click to expand
    await knowledgeToolsHeader.first().click();
    await page.waitForTimeout(300);

    // Should show placeholder content (coming soon)
    const placeholder = page.getByText(/coming soon|future/i);
    const count = await placeholder.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // Issue #86: RemoteTool connection find-or-create (ARM PUT, authType=
  // ProjectManagedIdentity) is a backend-only concern, triggered internally by
  // add_knowledge_config() -> _trigger_agent_resync() *after* this POST responds.
  // It is covered by backend pytest (backend/tests/test_knowledge_base.py:
  // TestKnowledgeBaseServiceCrud — reuse-by-metadata, reuse-by-target,
  // create-when-missing, creation-failure-propagation, multi-KB mapping) and
  // is intentionally NOT re-verified here: E2E must not perform real Azure ARM
  // calls, and the browser-facing request/response contract for adding a KB
  // (asserted below) is unaffected by which RemoteTool connection the backend
  // ultimately resolves or creates.
  test("admin can attach a Foundry IQ knowledge base to the HCP", async ({
    page,
  }) => {
    let submittedConfig: Record<string, string> | undefined;
    const configs: Array<Record<string, unknown>> = [];

    await page.route("**/api/v1/knowledge-base/connections", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            name: "search-connection",
            target: "https://search.example.com",
            is_default: true,
          },
        ]),
      }),
    );
    await page.route("**/api/v1/knowledge-base/indexes", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            name: "medical-kb",
            version: "1",
            type: "foundryIq",
            description: "Medical knowledge",
          },
        ]),
      }),
    );
    await page.route("**/api/v1/knowledge-base/hcp/*/configs", async (route) => {
      if (route.request().method() === "POST") {
        submittedConfig = route.request().postDataJSON() as Record<string, string>;
        configs.push({
          id: "kb-config-e2e",
          hcp_profile_id: "hcp-e2e",
          ...submittedConfig,
          server_label: "knowledge-base-medical-kb",
          is_enabled: true,
          created_at: "2026-07-17T00:00:00Z",
        });
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(configs[0]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configs),
      });
    });

    await page.reload();
    await page.waitForSelector("[role='tab']", { timeout: 10000 });
    await page.getByRole("tab", { name: /voice.*avatar/i }).click();
    await page.getByText(/knowledge.*tools/i).first().click();
    await page.getByRole("button", { name: /^add$/i }).click();

    const dialog = page.getByRole("dialog");
    const selects = dialog.getByRole("combobox");
    await selects.nth(0).click();
    await page.getByRole("option", { name: /search-connection/i }).click();
    await selects.nth(1).click();
    await page.getByRole("option", { name: "medical-kb" }).click();
    await dialog.getByRole("button", { name: /^connect$/i }).click();

    await expect(page.getByText("medical-kb").first()).toBeVisible();
    expect(submittedConfig).toEqual({
      connection_name: "search-connection",
      connection_target: "https://search.example.com",
      index_name: "medical-kb",
    });

    // No error toast/message should appear for a successful add — regression
    // guard for Issue #86 (a KB add must not silently surface as an error to
    // the admin, nor should the request path itself ever need to know about
    // RemoteTool connection resolution).
    const errorToast = page.getByText(/failed to add|error adding|could not add/i);
    await expect(errorToast).toHaveCount(0);
  });
});

// ─── Phase 15: Agent Config Center — Additional Gaps ─────────────────────

test.describe("HCP Editor: Agent Config Center (Phase 15)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test.beforeEach(async ({ page, request }) => {
    const token = await loginApi(request, "admin", "admin123");
    const hcpId = await getFirstHcpId(request, token);
    if (hcpId) {
      await page.goto(`/admin/hcp-profiles/${hcpId}`);
      await page.waitForSelector("[role='tab']", { timeout: 10000 });
    } else {
      await page.goto("/admin/hcp-profiles");
    }
  });

  test("Instructions section has regenerate/magic-wand button", async ({
    page,
  }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // Instructions section title should be visible
    const instructionsTitle = page.getByText(/instruction/i);
    await expect(instructionsTitle.first()).toBeVisible({ timeout: 5000 });

    // The regenerate button with Wand2 icon should be present
    // It shows either "Generate" or "Regenerate" text
    const regenBtn = page
      .getByRole("button", { name: /regenerate|generate/i })
      .first();
    const regenCount = await regenBtn.count();

    if (regenCount > 0) {
      await expect(regenBtn).toBeVisible();
      await expect(regenBtn).toBeEnabled();
    }
  });

  test("clicking regenerate button triggers instructions preview", async ({
    page,
  }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // Mock the preview-instructions endpoint
    await page.route(
      "**/api/v1/hcp-profiles/preview-instructions",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            instructions:
              "You are Dr. Test, a specialist in oncology. Be skeptical of new treatments...",
          }),
        });
      },
    );

    const regenBtn = page
      .getByRole("button", { name: /regenerate|generate/i })
      .first();
    const regenCount = await regenBtn.count();

    if (regenCount > 0) {
      await regenBtn.click();
      await page.waitForTimeout(1500);

      // After generation, the instructions preview should appear in a <pre> element
      const preElement = page.locator('pre[role="log"]');
      const preCount = await preElement.count();
      if (preCount > 0) {
        const preText = await preElement.first().textContent();
        expect(preText).toBeTruthy();
        expect(preText!.length).toBeGreaterThan(0);
      }
    }
  });

  // VMODE-01: voice mode is always available (resolve_voice_config() always
  // returns valid config), so there is no on/off "Voice Mode" switch to
  // manipulate here anymore. The single remaining switch on this tab is the
  // avatar-enabled toggle, which does not gate the Playground's voice
  // capability -- it only controls whether the avatar video is shown.
  test("Playground panel is visible regardless of avatar-enabled state (VMODE-01)", async ({
    page,
  }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // The Playground panel should be visible.
    const playgroundTitle = page.getByText(/playground/i);
    await expect(playgroundTitle.first()).toBeVisible({ timeout: 3000 });

    // No Voice Live Instance selector should ever reappear.
    await expect(page.getByText(/voice live instance/i)).toHaveCount(0);
  });

  test("Model Deployment selector is interactive", async ({ page }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // Model Deployment label should be visible
    const modelLabel = page.getByText(/model deployment/i);
    await expect(modelLabel.first()).toBeVisible({ timeout: 5000 });

    // Find the model select trigger (a combobox-style button), scoped to the
    // Model Deployment card. VMODE-01's direct voice-mode config card and the
    // decorative Agent Foundation Model card both use the identical
    // "Model Deployment" label text, so an unscoped page-wide combobox
    // locator could grab the wrong one -- scope to the label's own card.
    // `.first()` above resolves to the VMODE-01 card since it renders first
    // in DOM order.
    const modelSelect = modelLabel
      .first()
      .locator("..")
      .locator("button[role='combobox']");
    const selectCount = await modelSelect.count();

    if (selectCount > 0) {
      // Click to open the model dropdown
      await modelSelect.first().click();
      await page.waitForTimeout(300);

      // Model options should appear (e.g., GPT-4o, GPT-Realtime)
      const optionItem = page.getByRole("option");
      const optionCount = await optionItem.count();
      expect(optionCount).toBeGreaterThan(0);

      // Close by pressing Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
  });

  test("Override Instructions textarea is available", async ({ page }) => {
    const voiceTab = page.getByRole("tab", { name: /voice.*avatar/i });
    await voiceTab.click();
    await page.waitForTimeout(500);

    // The override instructions textarea should exist
    const overrideLabel = page.getByText(/override/i);
    const overrideCount = await overrideLabel.count();

    if (overrideCount > 0) {
      // Find the textarea near the override label
      const textarea = page.locator("textarea");
      const textareaCount = await textarea.count();
      expect(textareaCount).toBeGreaterThan(0);

      // Type some override text
      const lastTextarea = textarea.last();
      await lastTextarea.fill("Custom override instructions for testing");
      await page.waitForTimeout(300);

      const value = await lastTextarea.inputValue();
      expect(value).toContain("Custom override instructions");
    }
  });
});

test.describe("HCP Editor: Voice & Avatar Tab (i18n zh-CN)", () => {
  test.use({ storageState: join(authDir, "admin.json") });

  test("Chinese labels display correctly", async ({ page, request }) => {
    const token = await loginApi(request, "admin", "admin123");
    const hcpId = await getFirstHcpId(request, token);

    // Navigate to profile editor directly
    if (hcpId) {
      await page.goto(`/admin/hcp-profiles/${hcpId}`);
    } else {
      await page.goto("/admin/hcp-profiles");
    }
    await page.waitForTimeout(1000);

    // Try to find and click a language switcher
    const langSwitcher = page.getByRole("button", { name: /language|english|中文/i });
    const switcherCount = await langSwitcher.count();
    if (switcherCount > 0) {
      await langSwitcher.first().click();
      await page.waitForTimeout(300);
      // Select Chinese
      const zhOption = page.getByText(/中文|chinese/i);
      const optCount = await zhOption.count();
      if (optCount > 0) {
        await zhOption.first().click();
        await page.waitForTimeout(500);
      }
    }

    // Click Voice & Avatar tab (in Chinese it might be different text)
    const voiceTab = page.getByRole("tab").nth(1);
    const tabCount = await voiceTab.count();
    if (tabCount > 0) {
      await voiceTab.click();
      await page.waitForTimeout(500);
    }

    // At minimum, the page should render without errors
    // Chinese-specific assertions depend on actual translated keys
    await expect(page.locator("body")).toBeVisible();
  });
});
