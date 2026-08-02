/**
 * Persona switcher E2E -- main user story for PERSONA-03 (Phase 36-04).
 *
 * Proves the full self-service persona-switch flow end-to-end in a real
 * browser: a logged-in user opens the `PersonaSwitcher` in the avatar page
 * header, selects a non-default enabled persona, sees the "Switching to
 * {name}..." toast while the voice session rebuilds (disconnect + reconnect,
 * per Phase 34's convention -- never a mid-session hot-swap), and the trigger
 * updates to the new persona once the reconnect succeeds. A page reload then
 * proves the choice persisted (re-fetched via `GET
 * /api/v1/users/me/selected-persona`).
 *
 * Auth is established via the repo's existing `auth.setup.ts` "setup"
 * project (seeded `user1` / `user123`), reusing the same `storageState`
 * pattern as `personalized-avatar-qa.spec.ts`.
 *
 * Persona list / selection endpoints are intercepted via `page.route()` with
 * a deterministic two-persona fixture (Lisa default + Harry non-default)
 * rather than depending on the dev DB's seed data containing a second
 * enabled persona -- the same documented allowance
 * `personalized-avatar-qa.spec.ts` uses for chat/session endpoints. The
 * WebRTC transport is faked via the exact `installFakeWebrtcTransport` /
 * `installGrantedMic` pattern already established by
 * `anonymous-avatar-voice.spec.ts`, driving `useAnonymousVoiceLive` through
 * a real disconnect -> reconnect state-machine transition with no external
 * network dependency.
 */
import { test, expect, type Page } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const authDir = join(dirname(fileURLToPath(import.meta.url)), ".auth");

const ANON_SESSION_TOKEN = "e2e-anon-session-token-persona-switch";
const PERSONALIZED_SESSION_ID = "e2e-personalized-session-id-persona-switch";

const LISA = {
  id: "persona-lisa-e2e",
  name: "Lisa",
  character: "lisa",
  style: "casual",
  greeting: "Hi, I'm Lisa!",
  is_default: true,
};

const HARRY = {
  id: "persona-harry-e2e",
  name: "Harry",
  character: "harry",
  style: "professional",
  greeting: "Hello, I'm Harry.",
  is_default: false,
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

async function mockWebrtcSessionSuccess(page: Page): Promise<void> {
  await page.route("**/public/avatar/webrtc/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        signaling_url: "wss://fake-voicelive.example.com/signaling",
        auth_token: "fake-ephemeral-token",
        auth_type: "api-key",
        model: "fake-model",
        mode: "agent",
        session_config: {},
        agent_id: "test-agent",
        agent_version: "1",
        project_name: "test-project",
        avatar_warning: null,
        greeting: "Hello, I'm Harry.",
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

/** Overrides `navigator.mediaDevices.getUserMedia` to resolve with a fake
 * (trackless) `MediaStream` -- same pattern used by
 * `anonymous-avatar-voice.spec.ts`. */
async function installGrantedMic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const stream = new MediaStream();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
  });
}

/** Injects a fake RTCPeerConnection + WebSocket that satisfy the exact
 * offer/answer + signaling contract `use-anonymous-voice-live.ts` expects --
 * identical fixture to `anonymous-avatar-voice.spec.ts`, driving the hook
 * through a real disconnect -> reconnect transition deterministically. */
async function installFakeWebrtcTransport(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeRTCPeerConnection {
      iceGatheringState = "complete";
      connectionState = "new";
      localDescription: { type: string; sdp: string } | null = null;
      ontrack: ((event: unknown) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;

      addTrack(): void {
        /* no-op: no real media track needed for this UI-level proof */
      }

      createDataChannel() {
        return {
          onmessage: null,
          onopen: null,
          onclose: null,
          send: () => {},
        };
      }

      async createOffer() {
        return { type: "offer", sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n" };
      }

      async setLocalDescription(desc: { type: string; sdp: string }) {
        this.localDescription = desc;
      }

      async setRemoteDescription() {
        /* accept unconditionally */
      }

      addEventListener(): void {}
      removeEventListener(): void {}
      close(): void {}
    }

    class FakeWebSocket extends EventTarget {
      static readonly OPEN = 1;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: ((event: { code: number; reason: string }) => void) | null = null;

      constructor(_url: string) {
        super();
        setTimeout(() => this.onopen?.(), 0);
      }

      send(data: string): void {
        const msg = JSON.parse(data) as { type?: string };
        if (msg.type === "rtc.call.sdp.create") {
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                type: "rtc.call.sdp.created",
                sdp_answer: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n",
              }),
            });
          }, 0);
        }
      }

      close(): void {
        this.onclose?.({ code: 1000, reason: "" });
      }
    }

    // @ts-expect-error -- intentional test-only global override
    window.RTCPeerConnection = FakeRTCPeerConnection;
    // @ts-expect-error -- intentional test-only global override
    window.WebSocket = FakeWebSocket;
  });
}

/**
 * Mocks the persona-selection surface (`GET /api/v1/personas`, `GET`/`PUT
 * /api/v1/users/me/selected-persona`) with a mutable "currently selected"
 * pointer, so a `PUT` followed by a reload's `GET` reflects the switch --
 * proving persistence without depending on real DB state.
 */
async function mockPersonaSelection(page: Page): Promise<{ selected: () => string }> {
  let selectedId = LISA.id;

  await page.route("**/api/v1/personas", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([LISA, HARRY]),
    });
  });

  await page.route("**/api/v1/users/me/selected-persona", async (route) => {
    const req = route.request();
    const current = selectedId === LISA.id ? LISA : HARRY;

    if (req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: current.id,
          name: current.name,
          character: current.character,
          style: current.style,
          greeting: current.greeting,
        }),
      });
    }

    if (req.method() === "PUT") {
      const body = req.postDataJSON() as { persona_id: string };
      const next = body.persona_id === HARRY.id ? HARRY : LISA;
      selectedId = next.id;
      // Small artificial delay so the "Switching to {name}..." toast has
      // time to render before the mutation resolves and dismisses it --
      // without this the fake WebRTC transport can resolve fast enough
      // that the toast never becomes observable.
      await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: next.id,
          name: next.name,
          character: next.character,
          style: next.style,
          greeting: next.greeting,
        }),
      });
    }

    return route.continue();
  });

  return { selected: () => selectedId };
}

test.describe("Persona switcher (Phase 36-04, PERSONA-03)", () => {
  test.describe("logged in as a seeded user", () => {
    test.use({ storageState: join(authDir, "user.json") });

    test.beforeEach(async ({ page, context }) => {
      await context.grantPermissions(["microphone"]);
      await page.addInitScript(() => {
        window.localStorage.setItem("i18nextLng", "en-US");
      });
      await mockAnonymousSession(page);
      await mockWebrtcSessionSuccess(page);
      await mockPersonalizedSession(page);
      await installGrantedMic(page);
      await installFakeWebrtcTransport(page);
    });

    test("selecting a different persona rebuilds the session, speaks its greeting, and persists across reload", async ({
      page,
    }) => {
      await mockPersonaSelection(page);

      await page.goto("/");

      const trigger = page.getByTestId("persona-switcher-trigger");
      await expect(trigger).toBeVisible({ timeout: 10_000 });
      await expect(trigger).toContainText("Lisa");

      await trigger.click();
      await expect(page.getByTestId(`persona-switcher-option-${LISA.id}`)).toBeVisible();
      await expect(page.getByTestId(`persona-switcher-option-${HARRY.id}`)).toBeVisible();
      // Active row (Lisa) carries the Check icon; Harry's row does not.
      await expect(
        page
          .getByTestId(`persona-switcher-option-${LISA.id}`)
          .getByTestId("persona-switcher-check"),
      ).toBeVisible();

      await page.getByTestId(`persona-switcher-option-${HARRY.id}`).click();

      // Menu closes immediately on selection.
      await expect(page.getByTestId(`persona-switcher-option-${HARRY.id}`)).not.toBeVisible();

      // Switching toast appears while the PUT + session rebuild are in flight.
      await expect(page.getByText("Switching to Harry…")).toBeVisible();

      // Once the reconnect succeeds, the trigger updates to the new persona
      // and the switching toast is dismissed.
      await expect(trigger).toContainText("Harry", { timeout: 10_000 });
      await expect(page.getByText("Switching to Harry…")).not.toBeVisible();
      await expect(page.getByText("Couldn't switch persona")).not.toBeVisible();

      // Persistence: a fresh page load re-resolves the selection from the
      // backend (mutable `selectedId` fixture above) rather than falling back
      // to the default.
      await page.reload();
      await expect(page.getByTestId("persona-switcher-trigger")).toContainText("Harry", {
        timeout: 10_000,
      });
    });
  });

  test.describe("logged-out user regression guard", () => {
    test("hides the switcher entirely for anonymous visitors", async ({ page, context }) => {
      await context.grantPermissions(["microphone"]);
      await page.addInitScript(() => {
        window.localStorage.setItem("i18nextLng", "en-US");
      });
      await mockAnonymousSession(page);
      await mockWebrtcSessionSuccess(page);
      await mockPersonaSelection(page);
      await installGrantedMic(page);
      await installFakeWebrtcTransport(page);

      await page.goto("/");

      await expect(page.getByRole("button", { name: /login/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("persona-switcher-trigger")).not.toBeVisible();
    });
  });
});
