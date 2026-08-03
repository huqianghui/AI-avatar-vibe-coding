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
  /** The resolved persona's spoken greeting (Phase 36, PERSONA-04). Added to
   * the backend base `WebRTCSessionResponse` schema by 36-03; this TS
   * interface catches up here (Phase 36, PERSONA-03). */
  greeting?: string | null;
  /** Mirrors the backend's `character`/`style` fields added to
   * `WebRTCSessionResponse` by 37-02 (Phase 37, PERSONA-05). */
  character?: string | null;
  /** Mirrors the backend's `character`/`style` fields added to
   * `WebRTCSessionResponse` by 37-02 (Phase 37, PERSONA-05). */
  style?: string | null;
}

/**
 * Response for GET /public/avatar/persona (Phase 37, PERSONA-05 fidelity gap
 * closure). Persona IDENTITY metadata only -- no prompt_fragment, greeting,
 * or voice_map (those remain session-time-only concerns resolved by
 * `fetchAnonymousWebrtcSession`).
 */
export interface PublicPersonaResponse {
  persona_id: string;
  name: string;
  character: string;
  style: string;
}

/**
 * Thrown by `parseOrThrow` on a non-2xx response. Preserves the HTTP status
 * and, when present, the `Retry-After` header (seconds) so callers can drive
 * a rate-limit countdown UI without re-parsing `err.message` (Phase 32-05).
 * Still a plain `Error` subclass -- existing `instanceof Error` /
 * `err.message` regex checks (e.g. `use-anonymous-avatar-chat.ts`'s 401
 * detection) continue to work unchanged.
 */
export class AnonymousApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "AnonymousApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function parseOrThrow<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    throw new AnonymousApiError(
      `${action} failed: ${res.status}`,
      res.status,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    );
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

/**
 * POST /public/avatar/chat — X-Anon-Session header only, no JWT bearer
 * header. `locale` (Phase 34-07, LANG-02) is forwarded so the backend's
 * grounded/refusal response tracks the active UI language instead of always
 * defaulting to zh-CN.
 */
export async function sendAnonymousChat(
  sessionToken: string,
  message: string,
  locale: string,
): Promise<ChatResponse> {
  const res = await fetch("/public/avatar/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Anon-Session": sessionToken,
    },
    body: JSON.stringify({ message, locale }),
  });
  return parseOrThrow<ChatResponse>(res, "send anonymous chat message");
}

/**
 * GET /public/avatar/persona — X-Anon-Session header only, no JWT bearer
 * header (an `Authorization` header, if present on the caller's own request
 * pipeline, is honored server-side, but this client never attaches one --
 * mirrors every other function in this module). Lets the anonymous avatar
 * page render the resolved persona's identity (character/style) before any
 * WebRTC connect attempt (Phase 37, PERSONA-05 fidelity gap closure).
 */
export async function fetchAnonymousPersona(sessionToken: string): Promise<PublicPersonaResponse> {
  const res = await fetch("/public/avatar/persona", {
    method: "GET",
    headers: { "X-Anon-Session": sessionToken },
  });
  return parseOrThrow<PublicPersonaResponse>(res, "fetch anonymous persona");
}

/**
 * POST /public/avatar/webrtc/session — X-Anon-Session header only, no JWT
 * bearer header. `personaId` (Phase 36, PERSONA-03/D-13) is optional and,
 * when present, is serialized as `persona_id` — this is still the anonymous
 * endpoint; a logged-in user's persona choice reaches it via this parameter,
 * never via a JWT, matching the WebRTC/voice flow's D-13 unconditional-reuse
 * convention.
 */
export async function fetchAnonymousWebrtcSession(
  sessionToken: string,
  locale: string,
  personaId?: string,
): Promise<WebrtcSessionResponse> {
  const res = await fetch("/public/avatar/webrtc/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Anon-Session": sessionToken,
    },
    body: JSON.stringify(personaId ? { locale, persona_id: personaId } : { locale }),
  });
  return parseOrThrow<WebrtcSessionResponse>(res, "fetch anonymous webrtc session");
}
