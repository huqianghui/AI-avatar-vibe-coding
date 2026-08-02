/**
 * TanStack Query hooks for the self-service selected-persona feature
 * (Phase 36, PERSONA-03). Pattern mirrors `use-avatar-personas.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userPersonaSelectionApi } from "@/api/user-persona-selection";

const SELECTED_PERSONA_KEY = "selected-persona";
const ENABLED_PERSONAS_KEY = "enabled-personas";

/** The caller's currently-resolved active persona. Only meaningful once
 * logged in -- pass `enabled: isAuthenticated` from the caller. */
export function useSelectedPersona(enabled: boolean) {
  return useQuery({
    queryKey: [SELECTED_PERSONA_KEY],
    queryFn: () => userPersonaSelectionApi.getSelectedPersona(),
    enabled,
  });
}

/** All enabled personas -- the switcher's menu content. */
export function useEnabledPersonas(enabled: boolean) {
  return useQuery({
    queryKey: [ENABLED_PERSONAS_KEY],
    queryFn: () => userPersonaSelectionApi.listEnabledPersonas(),
    enabled,
  });
}

export function useSetSelectedPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => userPersonaSelectionApi.setSelectedPersona(personaId),
    onSuccess: (data) => {
      queryClient.setQueryData([SELECTED_PERSONA_KEY], data);
    },
  });
}
