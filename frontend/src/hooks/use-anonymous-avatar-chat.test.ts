import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

vi.mock("@/api/public-avatar", () => ({
  sendAnonymousChat: vi.fn(),
}));

import { sendAnonymousChat } from "@/api/public-avatar";
import { useAnonymousAvatarChat } from "@/hooks/use-anonymous-avatar-chat";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAnonymousAvatarChat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a useMutation-backed hook that returns {answer, citations, is_refusal} on success", async () => {
    vi.mocked(sendAnonymousChat).mockResolvedValueOnce({
      answer: "Paris is the capital of France.",
      citations: [{ title: "France", url: "https://example.com/france", page: 1 }],
      is_refusal: false,
    });

    const { result } = renderHook(() => useAnonymousAvatarChat("tok-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("What is the capital of France?");
    });

    expect(sendAnonymousChat).toHaveBeenCalledWith("tok-1", "What is the capital of France?");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      answer: "Paris is the capital of France.",
      citations: [{ title: "France", url: "https://example.com/france", page: 1 }],
      is_refusal: false,
    });
  });

  it("triggers the onUnauthorized callback on a 401 failure instead of only surfacing a raw error", async () => {
    vi.mocked(sendAnonymousChat).mockRejectedValueOnce(
      new Error("send anonymous chat message failed: 401"),
    );
    const onUnauthorized = vi.fn();

    const { result } = renderHook(() => useAnonymousAvatarChat("tok-1", onUnauthorized), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("hello");
      } catch {
        // expected: mutation still rejects so the caller can decide how to react
      }
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not call onUnauthorized for a non-401 error", async () => {
    vi.mocked(sendAnonymousChat).mockRejectedValueOnce(
      new Error("send anonymous chat message failed: 429"),
    );
    const onUnauthorized = vi.fn();

    const { result } = renderHook(() => useAnonymousAvatarChat("tok-1", onUnauthorized), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("hello");
      } catch {
        // expected
      }
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("rejects immediately with no network call when sessionToken is null", async () => {
    const { result } = renderHook(() => useAnonymousAvatarChat(null), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("hello");
      } catch {
        // expected
      }
    });

    expect(sendAnonymousChat).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
