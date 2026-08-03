/**
 * Anonymous avatar voice-connect UI E2E for es-ES/es-MX/es-US (Phase 34-10,
 * Task 1 -- LANG-02 closing gate).
 *
 * Proves the mocked WebRTC voice-session negotiation path reaches the
 * connected state for each es-* locale variant, AND that the switched
 * locale is actually forwarded in the outgoing `WebrtcSessionRequest` body
 * (not just that the mock happens to return an es-* voice regardless of what
 * was requested). Mirrors `anonymous-avatar-voice.spec.ts`'s exact mock
 * pattern (fake `RTCPeerConnection` + signaling `WebSocket`, no real Azure
 * connection -- see that file's module docstring for the full rationale).
 *
 * Route/interaction deviation from the plan's literal wording ("navigate to
 * `/`, use the language switcher"): `AvatarPage` (the `/` route) does not
 * render `<LanguageSwitcher />` at all (confirmed by reading
 * `frontend/src/pages/avatar-page.tsx` in full, and already documented as a
 * deviation in `34-05-SUMMARY.md`/`language-switcher-es.spec.ts` for the
 * exact same reason). The switcher only lives on `/login` (and the
 * authenticated layouts). Since `AvatarPage` reads the active locale from
 * `i18n.language` (persisted to `localStorage.i18nextLng` by
 * `i18next-browser-languagedetector`), this spec switches the locale via the
 * real switcher on `/login` first, then navigates to `/` -- the persisted
 * locale is what `AvatarPage` picks up for both the WebRTC session request
 * and the mic-connect flow. This is Rule 3 (auto-fixed blocking issue):
 * there is no switcher on `/` to click directly.
 *
 * Helper duplication note: this plan's frontmatter `files_modified` lists
 * only this new spec file (`anonymous-avatar-voice.spec.ts` is not modified)
 * and the existing helpers are not exported from a shared module, so the
 * minimal subset needed (`mockSession`, `installGrantedMic`,
 * `installFakeWebrtcTransport`) is duplicated verbatim below rather than
 * extracting a shared helpers file that would require editing the existing
 * spec's imports too.
 */
import { test, expect, type Page } from "@playwright/test";

const SESSION_TOKEN = "e2e-anon-session-token-voice-es";

/** Locale-aware fixture data: switcher label (from `language-switcher.tsx`'s
 * `common:lang.*` keys, exact strings confirmed against
 * `language-switcher-es.spec.ts`) and the locale's built-in default neural
 * voice (`DEFAULT_PUBLIC_VOICE_BY_LOCALE` in
 * `backend/app/services/voice_live_webrtc.py`). */
const ES_LOCALES = [
  { code: "es-ES", label: "Español (España)", voice: "es-ES-ElviraNeural" },
  { code: "es-MX", label: "Español (México)", voice: "es-MX-DaliaNeural" },
  { code: "es-US", label: "Español (EE. UU.)", voice: "es-US-PalomaNeural" },
] as const;

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
 * closure) -- fetched independently of the WebRTC connect flow, verbatim
 * copy of `anonymous-avatar-voice.spec.ts`'s helper of the same name. */
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

/** Locale-aware variant of `anonymous-avatar-voice.spec.ts`'s
 * `mockWebrtcSessionSuccess` -- stubs `session_config.voice.name` with the
 * target locale's default neural voice (mirroring the real backend's
 * `create_public_webrtc_session_config` response shape) AND records the
 * `locale` field of the outgoing request body via `onRequestLocale`, so the
 * test can assert the frontend actually forwarded the switched locale. */
async function mockWebrtcSessionSuccessEs(
  page: Page,
  voiceName: string,
  onRequestLocale: (locale: string) => void,
): Promise<void> {
  await page.route("**/public/avatar/webrtc/session", (route) => {
    const requestBody = route.request().postDataJSON() as { locale?: string };
    onRequestLocale(requestBody.locale ?? "");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        signaling_url: "wss://fake-voicelive.example.com/signaling",
        auth_token: "fake-ephemeral-token",
        auth_type: "api-key",
        model: "fake-model",
        mode: "agent",
        session_config: {
          voice: { name: voiceName, type: "azure-standard" },
          turn_detection: { type: "server_vad" },
        },
        agent_id: "test-agent",
        agent_version: "1",
        project_name: "test-project",
        avatar_warning: null,
        character: "lisa",
        style: "casual-sitting",
      }),
    });
  });
}

/** Overrides `navigator.mediaDevices.getUserMedia` to resolve with a fake
 * (trackless) `MediaStream` -- verbatim copy of
 * `anonymous-avatar-voice.spec.ts`'s helper of the same name. */
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
 * verbatim copy of `anonymous-avatar-voice.spec.ts`'s helper of the same
 * name (see that file's module docstring for the full rationale). */
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

/** Verbatim copy of `language-switcher-es.spec.ts`'s `switchLanguage`
 * helper -- clicks the switcher trigger, then the dropdown item matching
 * the target locale's native-language label. */
async function switchLanguage(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: /switch language/i }).click();
  await page.getByRole("menuitem", { name: label }).click();
}

test.describe("Anonymous avatar voice connect — es-* locales", () => {
  for (const { code, label, voice } of ES_LOCALES) {
    test(`switching to ${code} and granting microphone permission negotiates the WebRTC session with the ${code} locale and default voice`, async ({
      page,
      context,
    }) => {
      let capturedLocale = "";

      await context.grantPermissions(["microphone"]);
      await mockSession(page);
      await mockPersonaPreview(page);
      await mockWebrtcSessionSuccessEs(page, voice, (locale) => {
        capturedLocale = locale;
      });
      await installGrantedMic(page);
      await installFakeWebrtcTransport(page);

      // Switch the active locale via the real switcher on `/login` (the
      // only route that renders it -- see module docstring), starting from
      // a known baseline so the switch is observable regardless of a prior
      // test run's leftover localStorage state.
      await page.goto("/login");
      await page.evaluate(() => localStorage.removeItem("i18nextLng"));
      await page.reload();
      await switchLanguage(page, label);

      const connectedLogSeen = page.waitForEvent("console", {
        predicate: (msg) => msg.text().includes("Remote description set successfully"),
        timeout: 10_000,
      });

      // `AvatarPage` reads the persisted `i18n.language` (now the switched
      // es-* locale) and auto-attempts the mic/WebRTC connect on mount.
      await page.goto("/");

      // Internal proof: the hook completed the SDP offer/answer handshake
      // against our fake transport and reached the "connected" branch of its
      // state machine (use-anonymous-voice-live.ts Step 15), using the
      // es-* session config our mock returned.
      await connectedLogSeen;

      // UI proof: the avatar view leaves its connecting state. With a known
      // persona identity (character="lisa" in the mock above),
      // `isDigitalHumanMode={true}` renders the static-preview identity
      // layer instead of the audio orb (Phase 37, PERSONA-05).
      await expect(page.getByTestId("avatar-static-preview")).toBeVisible();

      // Proof the switched locale was actually forwarded in the outgoing
      // WebrtcSessionRequest body, not just reflected coincidentally in the
      // mocked response.
      expect(capturedLocale).toBe(code);
    });
  }
});
