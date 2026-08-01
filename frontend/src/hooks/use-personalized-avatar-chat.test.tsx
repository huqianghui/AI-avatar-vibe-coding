import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/api/personalized-avatar", () => ({
  sendPersonalizedChat: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "zh-CN" } }),
}));

import { sendPersonalizedChat } from "@/api/personalized-avatar";
import { usePersonalizedAvatarChat } from "@/hooks/use-personalized-avatar-chat";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("usePersonalizedAvatarChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mutationFn calls sendPersonalizedChat(sessionId, message, locale) and resolves with the response", async () => {
    vi.mocked(sendPersonalizedChat).mockResolvedValueOnce({
      answer: "Personalized reply",
      citations: [{ title: "Doc", url: "https://example.com/doc", page: 1 }],
      is_refusal: false,
    });

    const { result } = renderHook(() => usePersonalizedAvatarChat("sess-1"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("Hello");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sendPersonalizedChat).toHaveBeenCalledWith("sess-1", "Hello", "zh-CN");
    expect(result.current.data).toEqual({
      answer: "Personalized reply",
      citations: [{ title: "Doc", url: "https://example.com/doc", page: 1 }],
      is_refusal: false,
    });
  });

  it("exposes the raw axios error on failure (no local 401 detection)", async () => {
    const axiosError = Object.assign(new Error("Request failed with status code 401"), {
      response: { status: 401 },
    });
    vi.mocked(sendPersonalizedChat).mockRejectedValueOnce(axiosError);

    const { result } = renderHook(() => usePersonalizedAvatarChat("sess-1"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("Hello");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(axiosError);
  });

  it("throws (via useMutation's error state) if no sessionId is set when mutate is called", async () => {
    const { result } = renderHook(() => usePersonalizedAvatarChat(null), {
      wrapper: createWrapper(),
    });

    result.current.mutate("Hello");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(sendPersonalizedChat).not.toHaveBeenCalled();
  });
});
