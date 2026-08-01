/**
 * Personalized avatar session hook (Phase 33, PERS-02).
 *
 * Mirrors `use-anonymous-avatar-session.ts`'s useEffect-on-mount pattern,
 * but calls `createPersonalizedSession()` (JWT-authenticated) instead of
 * `createAnonymousSession()`. Like its anonymous counterpart, the session
 * is held in React state only -- never `localStorage`/`sessionStorage` --
 * so a page refresh always issues a brand new personalized session for the
 * currently logged-in user rather than resuming a stale one.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPersonalizedSession,
  type PersonalizedSessionResponse,
} from "@/api/personalized-avatar";

export interface UsePersonalizedAvatarSessionResult {
  session: PersonalizedSessionResponse | null;
  isLoading: boolean;
  error: Error | null;
  /** Creates a brand new personalized session, replacing the current one. */
  renewSession: () => Promise<PersonalizedSessionResponse | null>;
}

export function usePersonalizedAvatarSession(): UsePersonalizedAvatarSessionResult {
  const [session, setSession] = useState<PersonalizedSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const renewSession = useCallback(async (): Promise<PersonalizedSessionResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await createPersonalizedSession();
      if (isMountedRef.current) {
        setSession(res);
      }
      return res;
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(normalized);
        setSession(null);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void renewSession();
    return () => {
      isMountedRef.current = false;
    };
    // renewSession is stable (useCallback, no deps) -- only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, isLoading, error, renewSession };
}
