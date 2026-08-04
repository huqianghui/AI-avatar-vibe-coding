export interface SearchConnection {
  name: string;
  target: string;
  is_default: boolean;
}

export interface SearchIndex {
  name: string;
  version: string | null;
  type: string | null;
  description: string | null;
}

export interface KnowledgeConfig {
  id: string;
  hcp_profile_id: string;
  connection_name: string;
  connection_target: string;
  index_name: string;
  server_label: string;
  is_enabled: boolean;
  created_at: string;
}

export interface KnowledgeConfigCreate {
  connection_name: string;
  connection_target: string;
  index_name: string;
}

// AvatarPersona-scoped Knowledge Base config (persona-hcp-foundry-alignment
// Increment C). Sibling shape to KnowledgeConfig, keyed by avatar_persona_id
// instead of hcp_profile_id -- backed by a separate table/service, mirrors
// the HCP one field-for-field.
export interface PersonaKnowledgeConfig {
  id: string;
  avatar_persona_id: string;
  connection_name: string;
  connection_target: string;
  index_name: string;
  server_label: string;
  is_enabled: boolean;
  created_at: string;
}
