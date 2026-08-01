/**
 * Personalized avatar chat hook (Phase 33, PERS-02).
 *
 * Mirrors `use-anonymous-avatar-chat.ts`'s `useMutation` shape -- `mutate`
 * accepts just the message string, so `avatar-page.tsx` can select between
 * this hook and the anonymous one interchangeably via
 * `isAuthenticated ? personalizedChat : anonymousChat` without branching on
 * a different call signature.
 *
 * Locale is resolved internally from `i18n.language` (matching how
 * `avatar-page.tsx` already threads `i18n.language` into the anonymous
 * voice-live hook), so callers never need to pass it explicitly.
 *
 * Unlike the anonymous hook, no local 401 detection/`onUnauthorized`
 * callback is implemented here: the shared `apiClient` singleton's response
 * interceptor already clears auth and lets the router guards redirect on a
 * real 401 -- `sendPersonalizedChat`'s underlying axios error is exposed to
 * the caller unmodified.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sendPersonalizedChat, type PersonalizedChatResponse } from "@/api/personalized-avatar";

export function usePersonalizedAvatarChat(
  sessionId: string | null,
): UseMutationResult<PersonalizedChatResponse, Error, string> {
  const { i18n } = useTranslation();

  return useMutation<PersonalizedChatResponse, Error, string>({
    mutationFn: async (message: string) => {
      if (!sessionId) {
        throw new Error("No active personalized session");
      }
      return sendPersonalizedChat(sessionId, message, i18n.language);
    },
  });
}
