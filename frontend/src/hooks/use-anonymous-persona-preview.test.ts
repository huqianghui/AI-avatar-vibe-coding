import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

vi.mock("@/api/public-avatar", () => ({
  fetchAnonymousPersona: vi.fn(),
}));

import { fetchAnonymousPersona } from "@/api/public-avatar";
import { useAnonymousPersonaPreview } from "@/hooks/use-anonymous-persona-preview";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAnonymousPersonaPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches persona metadata once a session token exists", async () => {
    vi.mocked(fetchAnonymousPersona).mockResolvedValueOnce({
      persona_id: "p-1",
      name: "Lisa",
      character: "lisa",
      style: "casual-sitting",
    });

    const { result } = renderHook(() => useAnonymousPersonaPreview("tok-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchAnonymousPersona).toHaveBeenCalledWith("tok-1");
    expect(result.current.data).toEqual({
      persona_id: "p-1",
      name: "Lisa",
      character: "lisa",
      style: "casual-sitting",
    });
  });

  it("does not fetch when sessionToken is null", () => {
    const { result } = renderHook(() => useAnonymousPersonaPreview(null), {
      wrapper: createWrapper(),
    });

    expect(fetchAnonymousPersona).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("surfaces an error without throwing when the fetch fails", async () => {
    vi.mocked(fetchAnonymousPersona).mockRejectedValueOnce(
      new Error("fetch anonymous persona failed: 401"),
    );

    const { result } = renderHook(() => useAnonymousPersonaPreview("tok-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
