import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAnonymousSession,
  sendAnonymousChat,
  fetchAnonymousWebrtcSession,
  AnonymousApiError,
} from "@/api/public-avatar";

function mockFetchResponse(options: {
  ok: boolean;
  status?: number;
  json?: unknown;
  retryAfter?: string;
}) {
  const headers = new Headers();
  if (options.retryAfter !== undefined) {
    headers.set("Retry-After", options.retryAfter);
  }
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    headers,
    json: vi.fn().mockResolvedValue(options.json ?? {}),
  } as unknown as Response;
}

describe("public-avatar API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("createAnonymousSession", () => {
    it("POSTs to /public/avatar/session with no auth header and returns parsed JSON", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          json: { session_token: "tok-1", expires_at: "2026-08-01T12:00:00Z" },
        }),
      );

      const result = await createAnonymousSession();

      expect(fetch).toHaveBeenCalledWith("/public/avatar/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual({ session_token: "tok-1", expires_at: "2026-08-01T12:00:00Z" });
    });

    it("throws AnonymousApiError on non-2xx response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({ ok: false, status: 500 }));

      await expect(createAnonymousSession()).rejects.toThrow(AnonymousApiError);
    });
  });

  describe("sendAnonymousChat", () => {
    it("POSTs to /public/avatar/chat with X-Anon-Session header and message body", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          json: { answer: "hi", citations: [], is_refusal: false },
        }),
      );

      const result = await sendAnonymousChat("tok-1", "hello");

      expect(fetch).toHaveBeenCalledWith("/public/avatar/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Anon-Session": "tok-1",
        },
        body: JSON.stringify({ message: "hello" }),
      });
      expect(result).toEqual({ answer: "hi", citations: [], is_refusal: false });
    });

    it("throws AnonymousApiError with retryAfterSeconds parsed from Retry-After header on 429", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({ ok: false, status: 429, retryAfter: "30" }),
      );

      try {
        await sendAnonymousChat("tok-1", "hello");
        throw new Error("expected rejection");
      } catch (err) {
        expect(err).toBeInstanceOf(AnonymousApiError);
        const apiErr = err as AnonymousApiError;
        expect(apiErr.status).toBe(429);
        expect(apiErr.retryAfterSeconds).toBe(30);
        expect(apiErr.message).toContain("send anonymous chat message failed: 429");
      }
    });

    it("leaves retryAfterSeconds undefined when Retry-After header is absent", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({ ok: false, status: 401 }));

      try {
        await sendAnonymousChat("tok-1", "hello");
        throw new Error("expected rejection");
      } catch (err) {
        expect(err).toBeInstanceOf(AnonymousApiError);
        expect((err as AnonymousApiError).retryAfterSeconds).toBeUndefined();
      }
    });

    it("leaves retryAfterSeconds undefined when Retry-After header is not a finite number", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({ ok: false, status: 429, retryAfter: "not-a-number" }),
      );

      try {
        await sendAnonymousChat("tok-1", "hello");
        throw new Error("expected rejection");
      } catch (err) {
        expect(err).toBeInstanceOf(AnonymousApiError);
        expect((err as AnonymousApiError).retryAfterSeconds).toBeUndefined();
      }
    });
  });

  describe("fetchAnonymousWebrtcSession", () => {
    it("POSTs to /public/avatar/webrtc/session with X-Anon-Session header and locale body", async () => {
      const webrtcPayload = {
        signaling_url: "wss://example",
        auth_token: "auth-1",
        auth_type: "bearer",
        model: "gpt-4o",
        mode: "agent" as const,
        session_config: {},
        agent_id: "agent-1",
        agent_version: "1",
        project_name: "proj",
        avatar_warning: null,
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({ ok: true, json: webrtcPayload }),
      );

      const result = await fetchAnonymousWebrtcSession("tok-1", "en-US");

      expect(fetch).toHaveBeenCalledWith("/public/avatar/webrtc/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Anon-Session": "tok-1",
        },
        body: JSON.stringify({ locale: "en-US" }),
      });
      expect(result).toEqual(webrtcPayload);
    });

    it("throws AnonymousApiError on non-2xx response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({ ok: false, status: 403 }));

      await expect(fetchAnonymousWebrtcSession("tok-1", "en-US")).rejects.toThrow(
        AnonymousApiError,
      );
    });
  });
});
