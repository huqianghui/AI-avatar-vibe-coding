import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/api/personalized-avatar", () => ({
  createPersonalizedSession: vi.fn(),
}));

import { createPersonalizedSession } from "@/api/personalized-avatar";
import { usePersonalizedAvatarSession } from "@/hooks/use-personalized-avatar-session";

describe("usePersonalizedAvatarSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("creates a session on mount exactly once and holds it in React state only", async () => {
    vi.mocked(createPersonalizedSession).mockResolvedValueOnce({
      session_id: "sess-1",
      expires_at: "2026-08-01T12:00:00Z",
    });

    const { result } = renderHook(() => usePersonalizedAvatarSession());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.session?.session_id).toBe("sess-1"));

    expect(createPersonalizedSession).toHaveBeenCalledTimes(1);
    expect(result.current.session?.expires_at).toBe("2026-08-01T12:00:00Z");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("never writes the session to localStorage", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(createPersonalizedSession).mockResolvedValueOnce({
      session_id: "sess-2",
      expires_at: "2026-08-01T12:00:00Z",
    });

    const { result } = renderHook(() => usePersonalizedAvatarSession());
    await waitFor(() => expect(result.current.session?.session_id).toBe("sess-2"));

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it("surfaces a session-creation failure via the error field without throwing", async () => {
    vi.mocked(createPersonalizedSession).mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => usePersonalizedAvatarSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.session).toBeNull();
  });
});
