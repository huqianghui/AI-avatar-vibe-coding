import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getVoiceMap, updateVoiceMap } from "@/api/public-knowledge-config";
import type { VoiceMapUpdate } from "@/types/public-knowledge-config";

const VOICE_MAP_KEY = ["voice-map"] as const;

export function useVoiceMap() {
  return useQuery({
    queryKey: [...VOICE_MAP_KEY],
    queryFn: getVoiceMap,
  });
}

export function useUpdateVoiceMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: VoiceMapUpdate) => updateVoiceMap(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...VOICE_MAP_KEY] });
    },
  });
}
