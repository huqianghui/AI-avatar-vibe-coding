/**
 * Self-service selected-persona API client (Phase 36, PERSONA-03).
 *
 * Uses the shared JWT-bearing `apiClient` (unlike `public-avatar.ts`'s
 * dedicated anonymous `fetch` client) -- every call here requires a real
 * logged-in user; the backend never accepts a client-supplied `user_id`
 * (T-36-21), it always reads `current_user.id` from the JWT dependency.
 */
import apiClient from "./client";

/** Mirrors the backend `SelectedPersonaOut` schema exactly. */
export interface SelectedPersona {
  id: string;
  name: string;
  character: string;
  style: string;
  greeting: string;
}

/** Mirrors the backend `AvatarPersonaOut` schema's fields the switcher needs. */
export interface EnabledPersona {
  id: string;
  name: string;
  character: string;
  style: string;
  greeting: string;
  is_default: boolean;
}

export const userPersonaSelectionApi = {
  /** GET /api/v1/users/me/selected-persona -- always 200, resolves to at
   * least the catalog default. */
  getSelectedPersona: async (): Promise<SelectedPersona> => {
    const { data } = await apiClient.get<SelectedPersona>("/users/me/selected-persona");
    return data;
  },

  /** PUT /api/v1/users/me/selected-persona -- 404 if `personaId` is
   * disabled/unknown, no partial state written. */
  setSelectedPersona: async (personaId: string): Promise<SelectedPersona> => {
    const { data } = await apiClient.put<SelectedPersona>("/users/me/selected-persona", {
      persona_id: personaId,
    });
    return data;
  },

  /** GET /api/v1/personas -- no-auth-required list of enabled personas
   * (Phase 36, PERSONA-01/02); reused here (via the JWT-bearing client, which
   * happily sends the request with or without a token) so the switcher's
   * menu content shares one source of truth with the anonymous persona list. */
  listEnabledPersonas: async (): Promise<EnabledPersona[]> => {
    const { data } = await apiClient.get<EnabledPersona[]>("/personas");
    return data;
  },
};
