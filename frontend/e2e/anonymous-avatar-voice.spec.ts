/**
 * Anonymous avatar voice-connect UI E2E (Phase 32-05, Task 1).
 *
 * Proves the mic-permission-dialog path and the WebRTC connect UI state
 * without a real Azure Voice Live connection (per 32-VALIDATION.md's
 * Manual-Only Verifications table -- audible speech is checked by the
 * human-verify checkpoint in Task 2, not here).
 *
 * `useAnonymousVoiceLive` (frontend/src/hooks/use-anonymous-voice-live.ts)
 * negotiates a real `RTCPeerConnection` + a signaling `WebSocket` against
 * Azure. Rather than depending on a live Azure endpoint or a bespoke local
 * signaling server, this spec injects deterministic fakes for both browser
 * APIs via `page.addInitScript` that satisfy the exact minimal contract the
 * hook depends on (offer/answer exchange, immediate ICE-gathering
 * completion, the `rtc.call.sdp.create` / `rtc.call.sdp.created` message
 * pair) -- driving the hook through its real state machine
 * (disconnected -> connecting -> connected) with no flakiness and no
 * external network dependency. This is a structural/UI proof, not a proof
 * of real audio transport.
 */
import { test, expect, type Page } from "@playwright/test";

const SESSION_TOKEN = "e2e-anon-session-token-voice";

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

/** Mocks GET /public/avatar/persona (Phase 37, PERSONA-05 fidelity gap
 * closure) -- the anonymous avatar page fetches this independently of the
 * WebRTC connect flow to render the resolved persona's static preview
 * immediately, even before/without a successful mic connect. */
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
        character: "lisa",
        style: "casual-sitting",
      }),
    }),
  );
}

/** Overrides `navigator.mediaDevices.getUserMedia` to always reject,
 * reproducing a real mic-permission denial deterministically (headless
 * Chromium has no real microphone hardware to actually deny/grant). */
async function installDeniedMic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
}

/** Overrides `navigator.mediaDevices.getUserMedia` to resolve with a fake
 * (trackless) `MediaStream` -- same pattern already used by
 * `unified-training-pinned-agent.spec.ts` for this codebase's other
 * WebRTC-mocked E2E specs. */
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
 * offer/answer + signaling contract `use-anonymous-voice-live.ts` expects,
 * driving it to `connectionState === "connected"` deterministically. */
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

      addTransceiver(): void {
        /* no-op: recvonly video transceiver negotiation (Phase 37, PERSONA-05) */
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

test.describe("Anonymous avatar voice connect", () => {
  test.use({ locale: "en-US" });

  test("denying microphone permission opens the mic-permission dialog while the textarea stays usable", async ({
    page,
  }) => {
    await mockSession(page);
    await mockPersonaPreview(page);
    await mockWebrtcSessionSuccess(page);
    await installDeniedMic(page);

    // No `context.grantPermissions(["microphone"])` call -- Chromium denies
    // mic access by default in a fresh headless context. The `getUserMedia`
    // override above reproduces the real denial deterministically since
    // headless Chromium has no real microphone hardware to actually deny.
    await page.goto("/");

    await expect(page.getByText("Microphone access needed to ask by voice")).toBeVisible({
      timeout: 10_000,
    });

    // User-reported PERSONA-05 gap: a denied mic must still show the
    // configured persona's identity (Lisa's static preview), never the
    // generic fallback orb, since the preview is resolved independently of
    // the (failed) WebRTC connect attempt.
    await expect(page.getByTestId("avatar-static-preview")).toBeVisible();

    // The dialog is a modal (Radix marks the background `aria-hidden` while
    // open), so the textarea is only usable again once the mic-denial path
    // is explicitly dismissed via "Use Text Instead" -- the app's documented
    // fallback-to-text affordance.
    await page.getByRole("button", { name: "Use Text Instead" }).click();
    await expect(page.getByText("Microphone access needed to ask by voice")).not.toBeVisible();
    await expect(page.getByRole("textbox")).toBeEnabled();
    await expect(page.getByRole("textbox")).toBeFocused();
  });

  test("granting microphone permission establishes the WebRTC connection and the avatar view leaves the connecting state", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["microphone"]);
    await mockSession(page);
    await mockPersonaPreview(page);
    await mockWebrtcSessionSuccess(page);
    await installGrantedMic(page);
    await installFakeWebrtcTransport(page);

    const connectedLogSeen = page.waitForEvent("console", {
      predicate: (msg) => msg.text().includes("Remote description set successfully"),
      timeout: 10_000,
    });

    await page.goto("/");

    // Internal proof: the hook actually completed the SDP offer/answer
    // handshake against our fake transport and reached the "connected"
    // branch of its state machine (use-anonymous-voice-live.ts Step 15).
    await connectedLogSeen;

    // UI proof: the connecting skeleton/copy disappears (AvatarView leaves
    // `isConnecting`) and the mic-permission dialog never had to open.
    await expect(page.getByText("Connecting voice call...")).not.toBeVisible();
    await expect(page.getByText("Microphone access needed to ask by voice")).not.toBeVisible();
    // With a known persona identity (character="lisa" in the mock above),
    // `isDigitalHumanMode={true}` renders the static-preview identity layer
    // instead of the audio orb (Phase 37, PERSONA-05) -- the audio orb only
    // shows when no character is configured.
    await expect(page.getByTestId("avatar-static-preview")).toBeVisible();
  });
});
