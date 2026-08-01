import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userPreferencesApi } from "@/api/user-preferences";
import type {
  PreferenceCategory,
  UserPreferenceCreate,
  UserPreferenceUpdate,
} from "@/api/user-preferences";

export const CATEGORY_OPTIONS: { value: PreferenceCategory; labelKey: string }[] = [
  { value: "communication_style", labelKey: "personalization.category.communicationStyle" },
  { value: "focus_area", labelKey: "personalization.category.focusArea" },
  { value: "language_preference", labelKey: "personalization.category.languagePreference" },
];

export function usePersonalizationSummary(userId: string) {
  return useQuery({
    queryKey: ["personalization", userId],
    queryFn: () => userPreferencesApi.getSummary(userId),
    enabled: !!userId,
  });
}

export function useCreatePreference(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserPreferenceCreate) => userPreferencesApi.create(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalization", userId] });
    },
  });
}

export function useUpdatePreference(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      preferenceId,
      data,
    }: {
      preferenceId: string;
      data: UserPreferenceUpdate;
    }) => userPreferencesApi.update(userId, preferenceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalization", userId] });
    },
  });
}

export function useDeletePreference(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferenceId: string) => userPreferencesApi.remove(userId, preferenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalization", userId] });
    },
  });
}
