import apiClient from "./client";
import type {
  SearchConnection,
  SearchIndex,
  KnowledgeConfig,
  KnowledgeConfigCreate,
  PersonaKnowledgeConfig,
} from "@/types/knowledge-base";

export const knowledgeBaseApi = {
  listConnections: () =>
    apiClient
      .get<SearchConnection[]>("/knowledge-base/connections")
      .then((r) => r.data),

  listIndexes: () =>
    apiClient
      .get<SearchIndex[]>("/knowledge-base/indexes")
      .then((r) => r.data),

  getHcpConfigs: (hcpId: string) =>
    apiClient
      .get<KnowledgeConfig[]>(`/knowledge-base/hcp/${hcpId}/configs`)
      .then((r) => r.data),

  addHcpConfig: (hcpId: string, data: KnowledgeConfigCreate) =>
    apiClient
      .post<KnowledgeConfig>(`/knowledge-base/hcp/${hcpId}/configs`, data)
      .then((r) => r.data),

  removeConfig: (configId: string) =>
    apiClient.delete(`/knowledge-base/configs/${configId}`),

  // AvatarPersona-scoped equivalents (persona-hcp-foundry-alignment
  // Increment C). `removeConfig` above is reused as-is -- both routes
  // delete by config id, DELETE /knowledge-base/configs/{id} (HCP) vs
  // DELETE /admin/avatar-personas/knowledge-configs/{id} (persona) --
  // so a persona-specific remove call is added for correctness of path.
  getPersonaConfigs: (personaId: string) =>
    apiClient
      .get<PersonaKnowledgeConfig[]>(
        `/admin/avatar-personas/${personaId}/knowledge-configs`,
      )
      .then((r) => r.data),

  addPersonaConfig: (personaId: string, data: KnowledgeConfigCreate) =>
    apiClient
      .post<PersonaKnowledgeConfig>(
        `/admin/avatar-personas/${personaId}/knowledge-configs`,
        data,
      )
      .then((r) => r.data),

  removePersonaConfig: (configId: string) =>
    apiClient.delete(
      `/admin/avatar-personas/knowledge-configs/${configId}`,
    ),
};
