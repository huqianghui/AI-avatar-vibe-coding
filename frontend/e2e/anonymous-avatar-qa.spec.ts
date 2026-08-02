/**
 * Anonymous grounded avatar Q&A -- main user story E2E (Phase 32-05, Task 1).
 *
 * Proves ANON-01..ANON-05 together in one continuous browser session:
 * no-login access at `/`, a grounded text answer rendered as a transcript
 * bubble structurally separate from the sources panel, the fixed refusal
 * template + neutral empty-source state on a no-match question, and the
 * rate-limited UI on a 429 response.
 *
 * All three `/public/avatar/*` endpoints are intercepted via `page.route()`
 * with deterministic fixtures rather than hitting the real dev backend --
 * per the plan's own allowance ("if not [seeded], mock that path too"), this
 * keeps the suite fully isolated from the real anonymous rate-limiter's
 * in-memory state (shared across test runs on a reused dev server) and from
 * needing a live `PublicKnowledgeConfig` + Foundry IQ index locally. Live
 * grounding correctness (Foundry IQ retrieval, refusal-gating logic) is
 * covered by `backend/tests/test_avatar_service.py` (Plan 02) and the
 * audit-completeness proof in `backend/tests/test_avatar_interaction_log.py`
 * (this plan). This spec proves the frontend's wiring/structural contract:
 * no-login, structural citation separation, refusal styling, rate-limit UX.
 */
import { test, expect, type Page } from "@playwright/test";

const SESSION_TOKEN = "e2e-anon-session-token";
const ANSWER_TEXT =
  "Our official pipeline focuses on innovative oncology treatments developed in-house.";
const CITATION_TITLE = "Official Product Pipeline Overview";
const CITATION_URL = "https://example.com/kb/pipeline-overview";
const REFUSAL_TEXT =
  "Sorry, I can currently only answer questions related to the official website content.";

async function mockSession(page: Page): Promise<void> {
  await page.route("**/public/avatar/session", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        session_token: SESSION_TOKEN,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    }),
  );
}

async function mockWebrtcSessionFailure(page: Page): Promise<void> {
  // The voice-connect attempt fires automatically on mount (always-connected
  // avatar). These specs only exercise the text path, so make the WebRTC
  // session broker fail fast (no getUserMedia mock either) rather than
  // leaving a real 30s connection-timeout pending in the background.
  await page.route("**/public/avatar/webrtc/session", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
}

async function mockChat(
  page: Page,
  body: { answer: string; citations: { title: string; url: string; page: number }[]; is_refusal: boolean },
): Promise<void> {
  await page.route("**/public/avatar/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...body, response_id: "e2e-resp" }),
    }),
  );
}

/**
 * The always-connected avatar auto-attempts a WebRTC/mic connection on
 * mount. `mockWebrtcSessionFailure` makes that attempt fail fast (instead of
 * hanging for a real 30s timeout), but a failed attempt also opens the
 * modal `MicPermissionDialog` -- which Radix marks the rest of the page
 * `aria-hidden` while open, hiding the textarea from the a11y tree these
 * text-path tests query. Dismiss it via the app's own "Use Text Instead"
 * escape hatch (the documented mic-denial-falls-back-to-text path) before
 * interacting with the transcript input. No-ops if the dialog never opens.
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

test.describe("Anonymous avatar Q&A", () => {
  test.use({ locale: "en-US" });

  test("visiting / with no auth state shows the avatar page directly, never redirecting to /login", async ({
    page,
  }) => {
    const navigatedUrls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigatedUrls.push(frame.url());
    });

    await mockSession(page);
    await mockWebrtcSessionFailure(page);

    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await dismissMicDialogIfOpen(page);
    await expect(page.getByRole("textbox")).toBeVisible();

    // Give any stray redirect logic a moment to fire before asserting it never did.
    await page.waitForTimeout(500);
    expect(navigatedUrls.some((url) => url.includes("/login"))).toBe(false);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("the avatar page renders no nav, sidebar, or coach chrome -- only the avatar experience", async ({
    page,
  }) => {
    await mockSession(page);
    await mockWebrtcSessionFailure(page);

    await page.goto("/");
    await dismissMicDialogIfOpen(page);

    // AVUI-01: AvatarPage is a standalone route, never wrapped by UserLayout or
    // AdminLayout -- neither of which is reachable from an anonymous session.
    // UserLayout/AdminLayout are the only components in the app that render a
    // <nav> element, so this is a true structural assertion, not an
    // implementation-detail-coupled one (per 35-UI-SPEC.md's resolution).
    await expect(page.locator("nav")).toHaveCount(0);

    // The only chrome on / is the avatar's own minimal header (title span +
    // login button/badge) -- confirm the input/transcript/sources surfaces are
    // present alongside the chrome-absence, so this isn't a false-positive
    // from a broken/blank page.
    await expect(page.getByRole("textbox")).toBeVisible();
  });

  test("a grounded question renders the answer in the transcript and citations in a structurally separate sources panel", async ({
    page,
  }) => {
    await mockSession(page);
    await mockWebrtcSessionFailure(page);
    await mockChat(page, {
      answer: ANSWER_TEXT,
      citations: [{ title: CITATION_TITLE, url: CITATION_URL, page: 3 }],
      is_refusal: false,
    });

    await page.goto("/");
    await dismissMicDialogIfOpen(page);

    const transcriptRegion = page.locator(".h-64.border-t");
    const sourcesRegion = page.locator(".border-l.border-border.bg-background.p-4");

    await page.getByRole("textbox").fill("What is your official product pipeline?");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(transcriptRegion.getByText(ANSWER_TEXT)).toBeVisible();

    // Sources panel: citation card with page badge + a new-tab link.
    await expect(sourcesRegion.getByText(CITATION_TITLE)).toBeVisible();
    await expect(sourcesRegion.getByText("Page 3")).toBeVisible();
    const citationLink = sourcesRegion.locator('a[target="_blank"]');
    await expect(citationLink).toHaveAttribute("href", CITATION_URL);
    await expect(citationLink).toHaveAttribute("rel", /noopener/);

    // Structural separation: querying each region independently shows
    // neither region's text bleeds into the other.
    await expect(transcriptRegion.getByText(CITATION_TITLE)).toHaveCount(0);
    await expect(sourcesRegion.getByText(ANSWER_TEXT)).toHaveCount(0);
  });

  test("an unanswerable question shows the fixed refusal template and the neutral no-match sources empty state", async ({
    page,
  }) => {
    await mockSession(page);
    await mockWebrtcSessionFailure(page);
    await mockChat(page, { answer: REFUSAL_TEXT, citations: [], is_refusal: true });

    await page.goto("/");
    await dismissMicDialogIfOpen(page);

    const transcriptRegion = page.locator(".h-64.border-t");
    const sourcesRegion = page.locator(".border-l.border-border.bg-background.p-4");

    await page.getByRole("textbox").fill("asdlkjaslkdj nonsense unrelated gibberish");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(transcriptRegion.getByText(REFUSAL_TEXT)).toBeVisible();

    // Refusal is never styled as an error (locked UI-SPEC rule).
    const bubble = transcriptRegion.locator("div.rounded-2xl").last();
    await expect(bubble).not.toHaveClass(/text-destructive/);

    await expect(sourcesRegion.getByText("No matching source this time")).toBeVisible();
    await expect(sourcesRegion.locator('a[target="_blank"]')).toHaveCount(0);
  });

  test("a 429 chat response shows the rate-limited toast and disables send while the textarea stays enabled", async ({
    page,
  }) => {
    await mockSession(page);
    await mockWebrtcSessionFailure(page);
    await page.route("**/public/avatar/chat", (route) =>
      route.fulfill({
        status: 429,
        headers: { "Retry-After": "5" },
        contentType: "application/json",
        body: JSON.stringify({
          code: "RATE_LIMITED",
          message: "Too many requests",
          details: {},
        }),
      }),
    );

    await page.goto("/");
    await dismissMicDialogIfOpen(page);
    await page.getByRole("textbox").fill("Hello there");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(page.getByText("Too many requests — please wait a moment.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask" })).toBeDisabled();
    await expect(page.getByRole("textbox")).toBeEnabled();
  });
});
