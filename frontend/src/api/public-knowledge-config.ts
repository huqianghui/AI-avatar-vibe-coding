import apiClient from "@/api/client";
import type { VoiceMapResponse, VoiceMapUpdate } from "@/types/public-knowledge-config";

const BASE = "/admin/public-knowledge-config/voice-map";

export async function getVoiceMap(): Promise<VoiceMapResponse> {
  const { data } = await apiClient.get<VoiceMapResponse>(BASE);
  return data;
}

export async function updateVoiceMap(body: VoiceMapUpdate): Promise<VoiceMapResponse> {
  const { data } = await apiClient.put<VoiceMapResponse>(BASE, body);
  return data;
}
