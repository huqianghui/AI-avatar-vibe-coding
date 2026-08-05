import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  avatarPersonasApi,
  type AvatarPersonaCreate,
  type AvatarPersonaUpdate,
} from "@/api/avatar-personas";

const QUERY_KEY = "avatar-personas";

export function useAvatarPersonas() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => avatarPersonasApi.list(),
  });
}

export function useAvatarPersona(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => avatarPersonasApi.get(id!),
    enabled: !!id,
    // Foundry agent sync now runs as a background task (perf follow-up to
    // persona-hcp-foundry-alignment) -- poll while a sync is in flight so
    // the PersonaAgentStatusSection card picks up the pending -> synced /
    // failed transition without a manual refresh. Mirrors use-voice-score.ts.
    refetchInterval: (query) => {
      const status = query.state.data?.agent_sync_status;
      return status === "pending" ? 2000 : false;
    },
  });
}

export function useCreateAvatarPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AvatarPersonaCreate) => avatarPersonasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateAvatarPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AvatarPersonaUpdate }) =>
      avatarPersonasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteAvatarPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newDefaultPersonaId }: { id: string; newDefaultPersonaId?: string }) =>
      avatarPersonasApi.remove(id, newDefaultPersonaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useSetDefaultAvatarPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => avatarPersonasApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useRetrySyncAvatarPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => avatarPersonasApi.retrySync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// Pull the latest voice-live configuration from the persona's synced AI
// Foundry Agent (persona-hcp-foundry-alignment Increment H). Invalidates the
// same query key as update/retry-sync so useAvatarPersona refetches; the
// editor page itself also re-seeds its form directly from the mutation's
// returned data (its "populate once" effect otherwise ignores query updates).
export function usePullVoiceConfigAvatarPersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => avatarPersonasApi.pullVoiceConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
