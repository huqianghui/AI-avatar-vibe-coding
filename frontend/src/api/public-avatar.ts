/**
 * Anonymous public avatar API client (Phase 32, ANON-04).
 *
 * Deliberately does NOT use the shared `apiClient` axios singleton
 * (`@/api/client.ts`): that instance auto-attaches a JWT bearer header from
 * localStorage on every request. The anonymous surface must never carry
 * that header — it authenticates purely via the `X-Anon-Session` header
 * issued by `POST /public/avatar/session`. Using a dedicated `fetch`-based
 * client here makes that guarantee structural rather than incidental.
 *
 * Also note: these routes are mounted with NO `/api/v1` prefix on the
 * backend (see `backend/app/api/public_avatar.py`'s module docstring) — the
 * paths below are intentionally bare `/public/avatar/...`, matching that
 * routing decision.
 *
 * Wire format: snake_case verbatim, matching the actual backend Pydantic
 * schemas (`backend/app/schemas/public_avatar.py`) exactly — no camelCase
 * transformation layer, consistent with `@/types/voice-live.ts`'s existing
 * convention for the authenticated WebRTC session shape.
 */

export interface AnonymousSessionResponse {
  session_token: string;
  expires_at: string;
}

export interface CitationOut {
  title: string;
  url: string;
  page: number;
}

export interface ChatResponse {
  answer: string;
  citations: CitationOut[];
  is_refusal: boolean;
}

/** Mirrors the backend `WebrtcSessionResponse` (== `WebRTCSessionResponse`) field set verbatim. */
export interface WebrtcSessionResponse {
  signaling_url: string;
  auth_token: string;
  auth_type: string;
  model: string;
  mode: "agent" | "model";
  session_config: Record<string, unknown>;
  agent_id?: string | null;
  agent_version?: string | null;
  project_name?: string | null;
  avatar_warning?: string | null;
}

async function parseOrThrow<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`${action} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/** POST /public/avatar/session — no login, no request body, no headers. */
export async function createAnonymousSession(): Promise<AnonymousSessionResponse> {
  const res = await fetch("/public/avatar/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return parseOrThrow<AnonymousSessionResponse>(res, "create anonymous session");
}

/** POST /public/avatar/chat — X-Anon-Session header only, no JWT bearer header. */
export async function sendAnonymousChat(
  sessionToken: string,
  message: string,
): Promise<ChatResponse> {
  const res = await fetch("/public/avatar/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Anon-Session": sessionToken,
    },
    body: JSON.stringify({ message }),
  });
  return parseOrThrow<ChatResponse>(res, "send anonymous chat message");
}

/** POST /public/avatar/webrtc/session — X-Anon-Session header only, no JWT bearer header. */
export async function fetchAnonymousWebrtcSession(
  sessionToken: string,
  locale: string,
): Promise<WebrtcSessionResponse> {
  const res = await fetch("/public/avatar/webrtc/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Anon-Session": sessionToken,
    },
    body: JSON.stringify({ locale }),
  });
  return parseOrThrow<WebrtcSessionResponse>(res, "fetch anonymous webrtc session");
}
