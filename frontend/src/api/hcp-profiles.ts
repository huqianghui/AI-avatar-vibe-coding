import apiClient from "./client";
import type { HcpProfile, HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

export async function getHcpProfiles(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
}) {
  const { data } = await apiClient.get<{
    items: HcpProfile[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>("/hcp-profiles", { params });
  return data;
}

export async function getHcpProfile(id: string) {
  const { data } = await apiClient.get<HcpProfile>(`/hcp-profiles/${id}`);
  return data;
}

export async function createHcpProfile(profile: HcpProfileCreate) {
  const { data } = await apiClient.post<HcpProfile>("/hcp-profiles", profile);
  return data;
}

export async function updateHcpProfile(id: string, profile: HcpProfileUpdate) {
  const { data } = await apiClient.put<HcpProfile>(
    `/hcp-profiles/${id}`,
    profile,
  );
  return data;
}

export async function deleteHcpProfile(id: string) {
  await apiClient.delete(`/hcp-profiles/${id}`);
}

export async function retrySyncHcpProfile(id: string) {
  const { data } = await apiClient.post<HcpProfile>(
    `/hcp-profiles/${id}/retry-sync`,
  );
  return data;
}

export async function batchSyncAgents() {
  const { data } = await apiClient.post<{
    synced: number;
    failed: number;
    total: number;
    error?: string;
  }>("/hcp-profiles/batch-sync");
  return data;
}

export interface TestChatRequest {
  message: string;
  previous_response_id?: string;
}

export interface TestChatResponse {
  response_text: string;
  response_id: string;
  agent_name: string;
  agent_version: string;
}

export async function testChatWithAgent(
  profileId: string,
  body: TestChatRequest,
) {
  const { data } = await apiClient.post<TestChatResponse>(
    `/hcp-profiles/${profileId}/test-chat`,
    body,
  );
  return data;
}

export interface AgentPortalUrlResponse {
  url: string;
  agent_name: string;
  agent_version: string;
}

export async function getAgentPortalUrl(profileId: string) {
  const { data } = await apiClient.get<AgentPortalUrlResponse>(
    `/hcp-profiles/${profileId}/portal-url`,
  );
  return data;
}

/**
 * Pull the latest voice-live configuration from the profile's synced AI
 * Foundry Agent and apply it onto the profile's local voice/avatar columns
 * (persona-hcp-foundry-alignment Increment H). Returns the full updated
 * HcpProfile so the caller can re-seed its form immediately.
 */
export async function pullVoiceConfig(profileId: string) {
  const { data } = await apiClient.post<HcpProfile>(
    `/hcp-profiles/${profileId}/agent/pull-voice-config`,
  );
  return data;
}

export interface InstructionsPreviewRequest {
  name?: string;
  specialty?: string;
  hospital?: string;
  title?: string;
  personality_type?: string;
  emotional_state?: number;
  communication_style?: number;
  expertise_areas?: string[];
  prescribing_habits?: string;
  concerns?: string;
  objections?: string[];
  probe_topics?: string[];
  difficulty?: string;
  agent_instructions_override?: string;
}

export interface InstructionsPreviewResponse {
  instructions: string;
  is_override: boolean;
}

export async function previewInstructions(
  body: InstructionsPreviewRequest,
  signal?: AbortSignal,
) {
  const { data } = await apiClient.post<InstructionsPreviewResponse>(
    "/hcp-profiles/preview-instructions",
    body,
    { signal },
  );
  return data;
}
