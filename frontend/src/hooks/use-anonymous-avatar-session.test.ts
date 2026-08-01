import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/api/public-avatar", () => ({
  createAnonymousSession: vi.fn(),
}));

import { createAnonymousSession } from "@/api/public-avatar";
import { useAnonymousAvatarSession } from "@/hooks/use-anonymous-avatar-session";

describe("useAnonymousAvatarSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls createAnonymousSession on mount and stores the token/expiry in state", async () => {
    vi.mocked(createAnonymousSession).mockResolvedValueOnce({
      session_token: "tok-1",
      expires_at: "2026-08-01T12:00:00Z",
    });

    const { result } = renderHook(() => useAnonymousAvatarSession());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.sessionToken).toBe("tok-1"));

    expect(createAnonymousSession).toHaveBeenCalledTimes(1);
    expect(result.current.expiresAt).toBe("2026-08-01T12:00:00Z");
    expect(result.current.isLoading).toBe(false);
  });

  it("never writes the session token to localStorage", async () => {
    vi.mocked(createAnonymousSession).mockResolvedValueOnce({
      session_token: "tok-2",
      expires_at: "2026-08-01T12:00:00Z",
    });

    const { result } = renderHook(() => useAnonymousAvatarSession());
    await waitFor(() => expect(result.current.sessionToken).toBe("tok-2"));

    expect(localStorage.getItem("tok-2")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("renewSession() calls createAnonymousSession again and replaces the stored token", async () => {
    vi.mocked(createAnonymousSession)
      .mockResolvedValueOnce({ session_token: "tok-1", expires_at: "exp-1" })
      .mockResolvedValueOnce({ session_token: "tok-2", expires_at: "exp-2" });

    const { result } = renderHook(() => useAnonymousAvatarSession());
    await waitFor(() => expect(result.current.sessionToken).toBe("tok-1"));

    await act(async () => {
      await result.current.renewSession();
    });

    expect(createAnonymousSession).toHaveBeenCalledTimes(2);
    expect(result.current.sessionToken).toBe("tok-2");
    expect(result.current.expiresAt).toBe("exp-2");
  });

  it("surfaces a session-creation failure via the error field without throwing", async () => {
    vi.mocked(createAnonymousSession).mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useAnonymousAvatarSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.sessionToken).toBeNull();
  });
});
