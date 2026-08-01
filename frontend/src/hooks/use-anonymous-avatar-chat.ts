/**
 * Anonymous avatar chat hook (Phase 32, ANON-04).
 *
 * Deviation note: the plan's literal template detected an expired/invalid
 * session via `err instanceof Response && err.status === 401`. The real
 * `sendAnonymousChat` (frontend/src/api/public-avatar.ts, `parseOrThrow`)
 * throws a plain `Error` whose message is `` `${action} failed: ${status}` ``
 * -- never a `Response` object. `isUnauthorized()` below matches that real
 * shape instead.
 *
 * Locale (Phase 34-07, LANG-02): resolved internally from `i18n.language`
 * via `useTranslation()`, mirroring the exact established pattern in
 * `use-personalized-avatar-chat.ts` -- NOT threaded through `mutate()`'s
 * variable type. This keeps `mutate(message: string)` unchanged so
 * `avatar-page.tsx`'s `chatMutation` union
 * (`personalizedChatMutation | anonymousChatMutation`) stays a single
 * `UseMutationResult<_, Error, string>` shape and the shared
 * `chatMutation.mutate(message, {...})` call site compiles without
 * branching on which mutation is active.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sendAnonymousChat, type ChatResponse } from "@/api/public-avatar";

function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && /\b401\b/.test(err.message);
}

export function useAnonymousAvatarChat(
  sessionToken: string | null,
  onUnauthorized?: () => void,
): UseMutationResult<ChatResponse, Error, string> {
  const { i18n } = useTranslation();

  return useMutation<ChatResponse, Error, string>({
    mutationFn: async (message: string) => {
      if (!sessionToken) {
        throw new Error("No active anonymous session");
      }
      try {
        return await sendAnonymousChat(sessionToken, message, i18n.language);
      } catch (err) {
        if (isUnauthorized(err)) {
          onUnauthorized?.();
        }
        throw err;
      }
    },
  });
}
