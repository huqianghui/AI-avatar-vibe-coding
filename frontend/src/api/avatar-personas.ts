import apiClient from "./client";

export interface AvatarPersona {
  id: string;
  name: string;
  character: string;
  style: string;
  voice_map: Record<string, string>;
  greeting: string;
  prompt_fragment: string;
  enabled: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarPersonaCreate {
  name: string;
  character: string;
  style?: string;
  voice_map?: Record<string, string>;
  greeting?: string;
  prompt_fragment?: string;
  enabled?: boolean;
  is_default?: boolean;
}

export interface AvatarPersonaUpdate {
  name?: string;
  character?: string;
  style?: string;
  voice_map?: Record<string, string>;
  greeting?: string;
  prompt_fragment?: string;
  enabled?: boolean;
  is_default?: boolean;
  new_default_persona_id?: string;
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
};
