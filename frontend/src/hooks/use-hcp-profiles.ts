import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getHcpProfiles,
  getHcpProfile,
  createHcpProfile,
  updateHcpProfile,
  deleteHcpProfile,
  retrySyncHcpProfile,
  batchSyncAgents,
  previewInstructions,
  pullVoiceConfig,
} from "@/api/hcp-profiles";
import type { InstructionsPreviewRequest } from "@/api/hcp-profiles";
import type { HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

export function useHcpProfiles(params?: {
  page?: number;
  search?: string;
  is_active?: boolean;
}) {
  return useQuery({
    queryKey: ["hcp-profiles", params],
    queryFn: () => getHcpProfiles(params),
  });
}

export function useHcpProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["hcp-profiles", id],
    queryFn: () => getHcpProfile(id!),
    enabled: !!id,
  });
}

export function useCreateHcpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HcpProfileCreate) => createHcpProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function useUpdateHcpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: HcpProfileUpdate }) =>
      updateHcpProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function useDeleteHcpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHcpProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function useRetrySyncHcpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retrySyncHcpProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function useBatchSyncAgents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => batchSyncAgents(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}

export function usePreviewInstructions() {
  return useMutation({
    mutationFn: (data: InstructionsPreviewRequest) => previewInstructions(data),
  });
}

// Pull the latest voice-live configuration from the profile's synced AI
// Foundry Agent (persona-hcp-foundry-alignment Increment H). Invalidates the
// same "hcp-profiles" query key as update/retry-sync so useHcpProfile
// refetches and the editor's form.reset() effect picks up the pulled values.
export function usePullVoiceConfigHcpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pullVoiceConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-profiles"] });
    },
  });
}
