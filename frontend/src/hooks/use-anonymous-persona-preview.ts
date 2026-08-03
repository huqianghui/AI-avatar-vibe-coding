/**
 * Anonymous persona preview hook (Phase 37, PERSONA-05 fidelity gap
 * closure).
 *
 * Fetches the resolved persona's identity metadata (character/style/name) as
 * soon as an anonymous session token exists, independent of the WebRTC/mic
 * connect flow. This lets `AvatarPage` render the configured default
 * persona's static preview immediately on load -- a denied mic permission or
 * an absent/misconfigured Azure Voice Live setup must never regress the page
 * to the generic fallback orb instead of the resolved persona (e.g. Lisa).
 *
 * `enabled: !!sessionToken` mirrors the gating convention used by
 * `use-selected-persona.ts`'s `isAuthenticated`-gated queries -- the query
 * simply never fires until a session token is available.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchAnonymousPersona, type PublicPersonaResponse } from "@/api/public-avatar";

const QUERY_KEY = "anonymous-persona-preview";

export function useAnonymousPersonaPreview(sessionToken: string | null) {
  return useQuery<PublicPersonaResponse>({
    queryKey: [QUERY_KEY, sessionToken],
    queryFn: () => fetchAnonymousPersona(sessionToken as string),
    enabled: !!sessionToken,
    retry: false,
  });
}
