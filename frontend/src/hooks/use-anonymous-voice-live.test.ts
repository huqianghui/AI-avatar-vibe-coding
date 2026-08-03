/**
 * Tests for the anonymous WebRTC voice-live hook + API client (Phase 32,
 * Plan 03, ANON-04).
 *
 * Covers the plan's 3 required behaviors:
 *   1. `fetchAnonymousWebrtcSession` sends the `X-Anon-Session` header and
 *      `{ locale }` body to `POST /public/avatar/webrtc/session`, and
 *      returns the parsed credential response.
 *   2. `useAnonymousVoiceLive` exposes the same return-shape key set as the
 *      authenticated `useVoiceLiveWebRTC` hook.
 *   3. `useAnonymousVoiceLive` never attaches an `Authorization` header
 *      anywhere in its request path -- only `X-Anon-Session`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RefObject } from "react";
import { renderHook, act } from "@testing-library/react";
import { fetchAnonymousWebrtcSession } from "@/api/public-avatar";
import { useAnonymousVoiceLive } from "./use-anonymous-voice-live";

// ---- Mock RTCPeerConnection (mirrors the minimal bootstrap the hook drives) ----

class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = [];

  iceGatheringState = "complete";
  connectionState = "new";
  localDescription: { type: string; sdp: string } | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTrack = vi.fn();
  addTransceiver = vi.fn();
  createDataChannel = vi.fn(() => ({
    onmessage: null,
    onopen: null,
    onclose: null,
    close: vi.fn(),
  }));
  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp-offer" });
  setLocalDescription = vi.fn().mockImplementation(async (desc: { type: string; sdp: string }) => {
    this.localDescription = desc;
  });
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();

  constructor() {
    MockRTCPeerConnection.instances.push(this);
  }
}

// ---- Mock signaling WebSocket ----

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  sentMessages: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: "", wasClean: true } as CloseEvent);
  }
}

const mockWebrtcSessionResponse = {
  signaling_url:
    "wss://test.cognitiveservices.azure.com/voice-live/realtime/calls?api-version=2025-05-01-preview&agent_id=public-agent-1&project_id=proj",
  auth_token: "bearer-token-abc",
  auth_type: "bearer",
  model: "",
  mode: "agent" as const,
  session_config: {
    voice: { name: "zh-CN-XiaoxiaoMultilingualNeural", type: "azure-standard" },
    turn_detection: { type: "server_vad" },
    input_audio_noise_reduction: false,
    input_audio_echo_cancellation: false,
  },
  agent_id: "public-agent-1",
  agent_version: null,
  project_name: "proj",
  avatar_warning: "Avatar (digital human) is not supported with WebRTC audio transport in preview.",
};

/** Variant of `mockWebrtcSessionResponse` carrying a resolved persona's
 * character/style (Phase 37, PERSONA-05) -- used by the video-negotiation
 * and identity-surfacing test cases below. */
const mockWebrtcSessionResponseWithAvatar = {
  ...mockWebrtcSessionResponse,
  character: "lisa",
  style: "casual-sitting",
};

const OriginalRTCPeerConnection = globalThis.RTCPeerConnection;
const OriginalWebSocket = globalThis.WebSocket;
const OriginalFetch = globalThis.fetch;
const OriginalMediaDevices = navigator.mediaDevices;

describe("public-avatar API client — fetchAnonymousWebrtcSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockWebrtcSessionResponse,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = OriginalFetch;
  });

  it("sends X-Anon-Session header and {locale} body, returns parsed response", async () => {
    const result = await fetchAnonymousWebrtcSession("anon-token-123", "en-US");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/public/avatar/webrtc/session");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "X-Anon-Session": "anon-token-123" });
    expect(init.body).toBe(JSON.stringify({ locale: "en-US" }));
    expect(result).toEqual(mockWebrtcSessionResponse);
  });

  it("never includes an Authorization header", async () => {
    await fetchAnonymousWebrtcSession("anon-token-123", "zh-CN");

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Authorization");
    expect(Object.keys(headers)).not.toContain("Authorization");
  });
});

describe("useAnonymousVoiceLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockRTCPeerConnection.instances = [];
    MockWebSocket.instances = [];

    vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection);
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockWebrtcSessionResponse,
    }) as unknown as typeof fetch;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.RTCPeerConnection = OriginalRTCPeerConnection;
    globalThis.WebSocket = OriginalWebSocket;
    globalThis.fetch = OriginalFetch;
    Object.defineProperty(navigator, "mediaDevices", {
      value: OriginalMediaDevices,
      writable: true,
      configurable: true,
    });
  });

  it("exposes the same return-shape key set as useVoiceLiveWebRTC", () => {
    const { result } = renderHook(() => useAnonymousVoiceLive("anon-token-123"));

    const expectedKeys = [
      "connect",
      "disconnect",
      "toggleMute",
      "sendTextMessage",
      "sendAudio",
      "send",
      "isMuted",
      "connectionState",
      "audioState",
      "avatarSdpCallbackRef",
      "avatarCharacter",
      "avatarStyle",
      "isAvatarConnected",
    ].sort();

    expect(Object.keys(result.current).sort()).toEqual(expectedKeys);
  });

  it("never attaches an Authorization header anywhere in its request path", async () => {
    const { result } = renderHook(() => useAnonymousVoiceLive("anon-token-123"));

    await act(async () => {
      // Fire-and-forget: full SDP handshake resolution isn't needed to verify
      // the request path never carries a JWT Authorization header -- only
      // the session-issuance fetch call and the signaling WebSocket
      // constructor call are relevant here.
      result.current.connect("zh-CN").catch(() => {
        // Intentionally unresolved (no simulated SDP-answer message) --
        // swallow the eventual connection-timeout rejection.
      });
    });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Authorization");
    expect(headers).toMatchObject({ "X-Anon-Session": "anon-token-123" });

    await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).not.toContain("Authorization");
  });

  it("negotiates a receive-only video transceiver on connect()", async () => {
    const { result } = renderHook(() => useAnonymousVoiceLive("anon-token-123"));

    await act(async () => {
      result.current.connect("zh-CN").catch(() => {
        // Intentionally unresolved -- see comment in the Authorization test above.
      });
    });

    await vi.waitFor(() => expect(MockRTCPeerConnection.instances.length).toBe(1));
    const pc = MockRTCPeerConnection.instances[0]!;
    expect(pc.addTransceiver).toHaveBeenCalledWith("video", { direction: "recvonly" });
  });

  it("attaches a real video track to the caller's videoRef and sets isAvatarConnected", async () => {
    const videoRef = { current: { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } };
    const { result } = renderHook(() =>
      useAnonymousVoiceLive("anon-token-123", {
        videoRef: videoRef as unknown as RefObject<HTMLVideoElement | null>,
      }),
    );

    await act(async () => {
      result.current.connect("zh-CN").catch(() => {
        // Intentionally unresolved -- SDP handshake not needed for this assertion.
      });
    });

    await vi.waitFor(() => expect(MockRTCPeerConnection.instances.length).toBe(1));
    const pc = MockRTCPeerConnection.instances[0]!;
    const fakeStream = {} as MediaStream;

    act(() => {
      pc.ontrack?.({ track: { kind: "video" }, streams: [fakeStream] });
    });

    expect(videoRef.current.srcObject).toBe(fakeStream);
    await vi.waitFor(() => expect(result.current.isAvatarConnected).toBe(true));
  });

  it("does not throw when a video track arrives with no videoRef option, and still sets isAvatarConnected", async () => {
    const { result } = renderHook(() => useAnonymousVoiceLive("anon-token-123"));

    await act(async () => {
      result.current.connect("zh-CN").catch(() => {
        // Intentionally unresolved.
      });
    });

    await vi.waitFor(() => expect(MockRTCPeerConnection.instances.length).toBe(1));
    const pc = MockRTCPeerConnection.instances[0]!;
    const fakeStream = {} as MediaStream;

    expect(() => {
      act(() => {
        pc.ontrack?.({ track: { kind: "video" }, streams: [fakeStream] });
      });
    }).not.toThrow();

    await vi.waitFor(() => expect(result.current.isAvatarConnected).toBe(true));
  });

  it("surfaces the resolved persona's character/style after connect() resolves the session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockWebrtcSessionResponseWithAvatar,
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAnonymousVoiceLive("anon-token-123"));

    await act(async () => {
      result.current.connect("zh-CN").catch(() => {
        // Intentionally unresolved.
      });
    });

    await vi.waitFor(() => expect(result.current.avatarCharacter).toBe("lisa"));
    expect(result.current.avatarStyle).toBe("casual-sitting");
  });

  it("resets isAvatarConnected back to false on disconnect()", async () => {
    const { result } = renderHook(() => useAnonymousVoiceLive("anon-token-123"));

    await act(async () => {
      result.current.connect("zh-CN").catch(() => {
        // Intentionally unresolved.
      });
    });

    await vi.waitFor(() => expect(MockRTCPeerConnection.instances.length).toBe(1));
    const pc = MockRTCPeerConnection.instances[0]!;
    const fakeStream = {} as MediaStream;

    act(() => {
      pc.ontrack?.({ track: { kind: "video" }, streams: [fakeStream] });
    });
    await vi.waitFor(() => expect(result.current.isAvatarConnected).toBe(true));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.isAvatarConnected).toBe(false);
  });
});
