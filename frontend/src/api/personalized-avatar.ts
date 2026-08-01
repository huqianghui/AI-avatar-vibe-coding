/**
 * Personalized avatar API client (Phase 33, PERS-02).
 *
 * Unlike `public-avatar.ts` (which deliberately avoids the shared
 * `apiClient` singleton so the anonymous surface never carries a JWT), this
 * module wraps the JWT-authenticated `/api/v1/avatar/session` and
 * `/api/v1/avatar/chat` endpoints (33-04/33-05) via the shared `apiClient`
 * axios instance (`@/api/client.ts`) -- its request interceptor already
 * attaches the Bearer token from `localStorage`, and its response
 * interceptor already handles 401 by clearing auth. No manual auth header
 * or 401 handling is duplicated here.
 *
 * `apiClient`'s `baseURL` is `/api/v1`, so only the `/avatar/session` and
 * `/avatar/chat` path suffixes are passed below -- matching
 * `backend/app/api/personalized_avatar.py`'s `router = APIRouter(prefix="/avatar", ...)`
 * mounted under the versioned `/api/v1` prefix (unlike `public_avatar.py`,
 * which is mounted unprefixed).
 *
 * `CitationOut` is re-exported from `@/api/public-avatar` rather than
 * redefined here: the backend's `PersonalizedChatResponse.citations` field
 * (`backend/app/schemas/personalized_avatar.py`) reuses
 * `public_avatar.py`'s `CitationOut` schema verbatim (title/url/page), so
 * the frontend type must match that real shape exactly.
 */
import apiClient from "@/api/client";
import type { CitationOut } from "@/api/public-avatar";

export type { CitationOut };

export interface PersonalizedSessionResponse {
  session_id: string;
  expires_at: string;
}

export interface PersonalizedChatResponse {
  answer: string;
  citations: CitationOut[];
  is_refusal: boolean;
}

/** POST /avatar/session (JWT required, no body). */
export async function createPersonalizedSession(): Promise<PersonalizedSessionResponse> {
  const { data } = await apiClient.post<PersonalizedSessionResponse>("/avatar/session");
  return data;
}

/** POST /avatar/chat (JWT required). */
export async function sendPersonalizedChat(
  sessionId: string,
  message: string,
  locale: string,
): Promise<PersonalizedChatResponse> {
  const { data } = await apiClient.post<PersonalizedChatResponse>("/avatar/chat", {
    session_id: sessionId,
    message,
    locale,
  });
  return data;
}
