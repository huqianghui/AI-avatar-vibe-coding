import apiClient from "./client";

export type PreferenceCategory = "communication_style" | "focus_area" | "language_preference";

export interface UserPreference {
  id: string;
  user_id: string;
  category: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface PersonalizationSummary {
  crm_matched: boolean;
  customer_name: string | null;
  company: string | null;
  preferences: UserPreference[];
}

export interface UserPreferenceCreate {
  category: PreferenceCategory;
  value: string;
}

export interface UserPreferenceUpdate {
  value: string;
}

export const userPreferencesApi = {
  getSummary: async (userId: string): Promise<PersonalizationSummary> => {
    const { data } = await apiClient.get<PersonalizationSummary>(`/users/${userId}/personalization`);
    return data;
  },
  create: async (userId: string, data: UserPreferenceCreate): Promise<UserPreference> => {
    const { data: result } = await apiClient.post<UserPreference>(
      `/users/${userId}/preferences`,
      data,
    );
    return result;
  },
  update: async (
    userId: string,
    preferenceId: string,
    data: UserPreferenceUpdate,
  ): Promise<UserPreference> => {
    const { data: result } = await apiClient.put<UserPreference>(
      `/users/${userId}/preferences/${preferenceId}`,
      data,
    );
    return result;
  },
  remove: async (userId: string, preferenceId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}/preferences/${preferenceId}`);
  },
};
