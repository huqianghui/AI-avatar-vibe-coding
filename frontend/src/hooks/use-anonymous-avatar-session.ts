/**
 * Anonymous avatar session hook (Phase 32, ANON-04).
 *
 * Deliberately keeps the session token/expiry in React state only -- never
 * localStorage / sessionStorage. Anonymous sessions are intentionally
 * non-persistent: a page refresh should start a brand new anonymous
 * identity rather than resuming a previous one (locked design decision,
 * see 32-03-SUMMARY.md / 32-04-PLAN.md).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createAnonymousSession } from "@/api/public-avatar";

export interface UseAnonymousAvatarSessionResult {
  sessionToken: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: Error | null;
  /** Creates a brand new anonymous session, replacing the current one. Returns the new token, or null on failure. */
  renewSession: () => Promise<string | null>;
}

export function useAnonymousAvatarSession(): UseAnonymousAvatarSessionResult {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const renewSession = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await createAnonymousSession();
      if (isMountedRef.current) {
        setSessionToken(res.session_token);
        setExpiresAt(res.expires_at);
      }
      return res.session_token;
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(normalized);
        setSessionToken(null);
        setExpiresAt(null);
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

  return { sessionToken, expiresAt, isLoading, error, renewSession };
}
