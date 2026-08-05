import apiClient from "./client";

export interface AvatarPersona {
  id: string;
  name: string;
  character: string;
  style: string;
  voice_map: Record<string, string>;
  greeting_map: Record<string, string>;
  prompt_fragment: string;
  enabled: boolean;
  is_default: boolean;
  // AI Foundry Agent sync fields (persona-hcp-foundry-alignment Increment A)
  agent_id: string;
  agent_version: string;
  agent_sync_status: "none" | "pending" | "synced" | "failed";
  agent_sync_error: string;
  // Interim response + proactive engagement (persona-hcp-foundry-alignment
  // Increment F)
  proactive_engagement: boolean;
  interim_response_enabled: boolean;
  interim_response_type: "llm" | "static";
  interim_response_threshold_ms: number;
  // Foundry Configuration panel parity (persona-hcp-foundry-alignment
  // Increment G): speech recognition (transcription) model, speech input
  // Advanced settings, speech output Advanced settings extensions, and
  // persona-only auto-detect-language (HCP reuses recognition_language's
  // "auto" sentinel; personas have no such field so get a real column).
  speech_recognition_model: string;
  eou_detection: boolean;
  noise_suppression: boolean;
  echo_cancellation: boolean;
  phrase_list: string;
  voice_temperature: number;
  playback_speed: number;
  custom_lexicon_url: string;
  auto_detect_language: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarPersonaCreate {
  name: string;
  character: string;
  style?: string;
  voice_map?: Record<string, string>;
  greeting_map?: Record<string, string>;
  prompt_fragment?: string;
  enabled?: boolean;
  is_default?: boolean;
  proactive_engagement?: boolean;
  interim_response_enabled?: boolean;
  interim_response_type?: "llm" | "static";
  interim_response_threshold_ms?: number;
  speech_recognition_model?: string;
  eou_detection?: boolean;
  noise_suppression?: boolean;
  echo_cancellation?: boolean;
  phrase_list?: string;
  voice_temperature?: number;
  playback_speed?: number;
  custom_lexicon_url?: string;
  auto_detect_language?: boolean;
}

export interface AvatarPersonaUpdate {
  name?: string;
  character?: string;
  style?: string;
  voice_map?: Record<string, string>;
  greeting_map?: Record<string, string>;
  prompt_fragment?: string;
  enabled?: boolean;
  is_default?: boolean;
  new_default_persona_id?: string;
  proactive_engagement?: boolean;
  interim_response_enabled?: boolean;
  interim_response_type?: "llm" | "static";
  interim_response_threshold_ms?: number;
  speech_recognition_model?: string;
  eou_detection?: boolean;
  noise_suppression?: boolean;
  echo_cancellation?: boolean;
  phrase_list?: string;
  voice_temperature?: number;
  playback_speed?: number;
  custom_lexicon_url?: string;
  auto_detect_language?: boolean;
}

export const avatarPersonasApi = {
  list: async (): Promise<AvatarPersona[]> => {
    const { data } = await apiClient.get<AvatarPersona[]>("/admin/avatar-personas");
    return data;
  },
  get: async (id: string): Promise<AvatarPersona> => {
    const { data } = await apiClient.get<AvatarPersona>(`/admin/avatar-personas/${id}`);
    return data;
  },
  create: async (data: AvatarPersonaCreate): Promise<AvatarPersona> => {
    const { data: result } = await apiClient.post<AvatarPersona>(
      "/admin/avatar-personas",
      data,
    );
    return result;
  },
  update: async (id: string, data: AvatarPersonaUpdate): Promise<AvatarPersona> => {
    const { data: result } = await apiClient.put<AvatarPersona>(
      `/admin/avatar-personas/${id}`,
      data,
    );
    return result;
  },
  remove: async (id: string, newDefaultPersonaId?: string): Promise<void> => {
    await apiClient.delete(`/admin/avatar-personas/${id}`, {
      params: newDefaultPersonaId ? { new_default_persona_id: newDefaultPersonaId } : undefined,
    });
  },
  setDefault: async (id: string): Promise<AvatarPersona> => {
    const { data } = await apiClient.post<AvatarPersona>(
      `/admin/avatar-personas/${id}/set-default`,
    );
    return data;
  },
  retrySync: async (id: string): Promise<AvatarPersona> => {
    const { data } = await apiClient.post<AvatarPersona>(
      `/admin/avatar-personas/${id}/retry-sync`,
    );
    return data;
  },
  getAgentPortalUrl: async (id: string): Promise<AgentPortalUrlResponse> => {
    const { data } = await apiClient.get<AgentPortalUrlResponse>(
      `/admin/avatar-personas/${id}/agent-portal-url`,
    );
    return data;
  },
};

// AI Foundry Agent sync fields (persona-hcp-foundry-alignment Increment A;
// mirrors hcp-profiles.ts's AgentPortalUrlResponse)
export interface AgentPortalUrlResponse {
  url: string;
  agent_name: string;
  agent_version: string;
}
