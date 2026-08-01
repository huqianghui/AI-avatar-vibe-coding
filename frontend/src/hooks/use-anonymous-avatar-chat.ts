/**
 * Anonymous avatar chat hook (Phase 32, ANON-04).
 *
 * Deviation note: the plan's literal template detected an expired/invalid
 * session via `err instanceof Response && err.status === 401`. The real
 * `sendAnonymousChat` (frontend/src/api/public-avatar.ts, `parseOrThrow`)
 * throws a plain `Error` whose message is `` `${action} failed: ${status}` ``
 * -- never a `Response` object. `isUnauthorized()` below matches that real
 * shape instead.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { sendAnonymousChat, type ChatResponse } from "@/api/public-avatar";

function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && /\b401\b/.test(err.message);
}

export function useAnonymousAvatarChat(
  sessionToken: string | null,
  onUnauthorized?: () => void,
): UseMutationResult<ChatResponse, Error, string> {
  return useMutation<ChatResponse, Error, string>({
    mutationFn: async (message: string) => {
      if (!sessionToken) {
        throw new Error("No active anonymous session");
      }
      try {
        return await sendAnonymousChat(sessionToken, message);
      } catch (err) {
        if (isUnauthorized(err)) {
          onUnauthorized?.();
        }
        throw err;
      }
    },
  });
}
