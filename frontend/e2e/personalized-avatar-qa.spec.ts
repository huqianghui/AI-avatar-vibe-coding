/**
 * Personalized (logged-in) avatar Q&A -- main user story E2E (Phase 33-06,
 * Task 3).
 *
 * Proves PERS-02 end-to-end in a real browser: a logged-in user sees the
 * "专属模式" personalization badge + their email instead of the "登录"
 * button, their chat turns route through the personalized (JWT-authenticated)
 * pipeline and render a reply, and -- as a regression guard -- a logged-out
 * visitor's experience is completely unaffected (Phase 32 behavior intact).
 *
 * Auth is established via the repo's existing `auth.setup.ts` "setup"
 * project (seeded `user1` / `user123`, see `backend/scripts/seed_data.py`),
 * reusing the same `storageState` pattern as `dashboard.spec.ts` /
 * `session-history.spec.ts` rather than re-implementing a login helper here
 * (per the plan's own preference for an existing helper over a bespoke one).
 *
 * All `/api/v1/{public/}avatar/*` endpoints are intercepted via
 * `page.route()` with deterministic fixtures rather than hitting the real
 * dev backend's Excel-based CRM mapping -- the same documented allowance
 * `anonymous-avatar-qa.spec.ts` uses ("if not [seeded], mock that path
 * too"). This keeps the suite isolated from needing a live CRM-mapping
 * fixture locally, and -- since `PersonalizedChatResponse` only ever
 * carries `{answer, citations, is_refusal}` (see
 * `backend/app/schemas/personalized_avatar.py`) -- proves the same
 * structural no-CRM-leak contract the frontend enforces regardless of which
 * CRM-notes/preference-tag values a real seed fixture happens to contain.
 * Live CRM-grounding correctness (Excel mapping lookup, silent D-08
 * fallback) is covered by the backend's own service-layer tests.
 *
 * The anonymous session/voice hooks are still mounted unconditionally on
 * this page even for a logged-in user (D-13 -- zero new voice code), so
 * every scenario below also mocks the anonymous session + WebRTC endpoints
 * to keep the always-fires mount effect deterministic, exactly as
 * `anonymous-avatar-qa.spec.ts` does.
 */
import { test, expect, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

const ANON_SESSION_TOKEN = "e2e-anon-session-token";
const PERSONALIZED_SESSION_ID = "e2e-personalized-session-id";
const USER1_EMAIL = "user1@aicoach.com";

const PERSONALIZED_ANSWER_TEXT =
  "Based on your account, here is the answer to your question.";
const CITATION_TITLE = "Personalized Knowledge Source";
const CITATION_URL = "https://example.com/kb/personalized-source";

const ANONYMOUS_ANSWER_TEXT = "This is the anonymous grounded answer.";

// Structural no-CRM-leak proof: `PersonalizedChatResponse` never carries raw
// CRM fields (see `backend/app/schemas/personalized_avatar.py` -- only
// `answer`, `citations`, `is_refusal`), so these terms can never legitimately
// appear in the rendered DOM regardless of which real CRM fixture is seeded.
const FORBIDDEN_CRM_TERMS = [
  "crm_notes",
  "contact_person",
  "customer_name",
  "已匹配",
  "未匹配",
  "偏好标签",
];

async function mockAnonymousSession(page: Page): Promise<void> {
  // Anonymous public-avatar routes are mounted bare (no /api/v1 prefix) --
  // see `@/api/public-avatar.ts`'s module docstring and the matching
  // dev-server proxy entry in `vite.config.ts`.
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

/** Mocks GET /public/avatar/persona (Phase 37, PERSONA-05 fidelity gap
 * closure) -- fetched independently of the (here, deliberately failing)
 * WebRTC connect flow, so it must be stubbed too or every scenario below
 * would otherwise hit the real dev backend with a fake anon-session token
 * and 401. */
async function mockPersonaPreview(page: Page): Promise<void> {
  await page.route("**/public/avatar/persona", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        persona_id: "e2e-persona-lisa",
        name: "Lisa",
        character: "lisa",
        style: "casual-sitting",
      }),
    }),
  );
}

async function mockWebrtcSessionFailure(page: Page): Promise<void> {
  // The always-connected avatar auto-attempts a WebRTC/mic connection on
  // mount regardless of auth state (D-13). Fail it fast (no getUserMedia
  // mock either) rather than leaving a real 30s connection-timeout pending.
  await page.route("**/public/avatar/webrtc/session", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
}

async function mockAnonymousChat(page: Page): Promise<void> {
  await page.route("**/public/avatar/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: ANONYMOUS_ANSWER_TEXT,
        citations: [],
        is_refusal: false,
        response_id: "e2e-anon-resp",
      }),
    }),
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

async function mockPersonalizedChat(page: Page): Promise<void> {
  await page.route("**/api/v1/avatar/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: PERSONALIZED_ANSWER_TEXT,
        citations: [{ title: CITATION_TITLE, url: CITATION_URL, page: 1 }],
        is_refusal: false,
      }),
    }),
  );
}

/**
 * The always-connected avatar auto-attempts a WebRTC/mic connection on
 * mount. `mockWebrtcSessionFailure` makes that attempt fail fast, but a
 * failed attempt also opens the modal `MicPermissionDialog` -- which Radix
 * marks the rest of the page `aria-hidden` while open, hiding the textarea
 * these text-path tests query. Dismiss it via the app's own "Use Text
 * Instead" escape hatch before interacting with the transcript input.
 * No-ops if the dialog never opens.
 */
async function dismissMicDialogIfOpen(page: Page): Promise<void> {
  // Both describe blocks below force zh-CN (see `beforeEach`/`addInitScript`
  // calls), so this button renders its Chinese copy (`micDialog.useTextInstead`).
  const useTextButton = page.getByRole("button", { name: "改用文字输入" });
  try {
    await useTextButton.waitFor({ state: "visible", timeout: 3_000 });
    await useTextButton.click();
  } catch {
    // Dialog never opened -- nothing to dismiss.
  }
}

test.describe("Personalized avatar Q&A (Phase 33-06, PERS-02)", () => {
  test.describe("logged in as a seeded user", () => {
    test.use({ storageState: join(authDir, "user.json") });

    // Force zh-CN so the personalization badge renders its Chinese copy
    // deterministically, regardless of the test runner's OS/browser locale.
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("i18nextLng", "zh-CN");
      });
    });

    test("sees the personalization badge and gets a personalized reply", async ({
      page,
    }) => {
      await mockAnonymousSession(page);
      await mockPersonaPreview(page);
      await mockWebrtcSessionFailure(page);
      await mockPersonalizedSession(page);
      await mockPersonalizedChat(page);

      await page.goto("/");
      await dismissMicDialogIfOpen(page);

      await expect(page.getByText("专属模式")).toBeVisible();
      await expect(page.getByText(USER1_EMAIL)).toBeVisible();
      await expect(page.getByRole("button", { name: "登录" })).not.toBeVisible();

      const transcriptRegion = page.locator(".h-64.border-t");
      await page.getByRole("textbox").fill("What is my order status?");
      await page.getByRole("button", { name: "发送提问" }).click();

      await expect(transcriptRegion.getByText(PERSONALIZED_ANSWER_TEXT)).toBeVisible();
    });

    test("renders no CRM field, preference tag, or match-status content anywhere on the page", async ({
      page,
    }) => {
      await mockAnonymousSession(page);
      await mockPersonaPreview(page);
      await mockWebrtcSessionFailure(page);
      await mockPersonalizedSession(page);
      await mockPersonalizedChat(page);

      await page.goto("/");
      await dismissMicDialogIfOpen(page);

      await page.getByRole("textbox").fill("What is my order status?");
      await page.getByRole("button", { name: "发送提问" }).click();
      await expect(page.getByText(PERSONALIZED_ANSWER_TEXT)).toBeVisible();

      const bodyText = (await page.locator("body").innerText()).toLowerCase();
      for (const term of FORBIDDEN_CRM_TERMS) {
        expect(bodyText).not.toContain(term.toLowerCase());
      }
    });
  });

  test.describe("logged-out user regression guard", () => {
    test("flow is unaffected: no badge, 登录 button visible, anonymous chat still works", async ({
      page,
    }) => {
      await mockAnonymousSession(page);
      await mockPersonaPreview(page);
      await mockWebrtcSessionFailure(page);
      await mockAnonymousChat(page);
      // The personalized session hook still fires unconditionally (rules of
      // hooks) even when logged out; it 401s harmlessly since there's no
      // JWT. Mock it explicitly for a deterministic, console-clean run
      // rather than relying on the real backend's auth rejection.
      await page.route("**/api/v1/avatar/session", (route) =>
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ code: "UNAUTHORIZED", message: "Not authenticated", details: {} }),
        }),
      );

      await page.addInitScript(() => {
        window.localStorage.setItem("i18nextLng", "zh-CN");
      });

      await page.goto("/");
      await dismissMicDialogIfOpen(page);

      await expect(page.getByText("专属模式")).not.toBeVisible();
      await expect(page.getByRole("button", { name: "登录" })).toBeVisible();

      const transcriptRegion = page.locator(".h-64.border-t");
      await page.getByRole("textbox").fill("Hello there");
      await page.getByRole("button", { name: "发送提问" }).click();

      await expect(transcriptRegion.getByText(ANONYMOUS_ANSWER_TEXT)).toBeVisible();
    });
  });
});
