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
