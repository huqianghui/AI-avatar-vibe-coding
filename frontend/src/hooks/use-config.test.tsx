import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from "@/api/client";
import { useFeatureFlags } from "@/hooks/use-config";
import type { AppConfig } from "@/types/config";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockConfig: AppConfig = {
  features: {
    avatar_enabled: true,
    voice_enabled: true,
    realtime_voice_enabled: false,
    conference_enabled: false,
    voice_live_enabled: false,
    legacy_coach_nav_enabled: false,
    default_voice_mode: "text_only",
    region: "china",
  },
  available_adapters: { openai: ["gpt-4"] },
};

describe("useFeatureFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not fetch when isAuthenticated is false (default)", async () => {
    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    // Query should not be enabled
    expect(result.current.isFetching).toBe(false);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("should not fetch when isAuthenticated is explicitly false", async () => {
    const { result } = renderHook(() => useFeatureFlags(false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("should fetch config when isAuthenticated is true", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockConfig });

    const { result } = renderHook(() => useFeatureFlags(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith("/config/features");
    expect(result.current.data).toEqual(mockConfig);
  });

  it("should handle fetch error", async () => {
    // The hook specifies retry: 1, so we need to reject twice (initial + 1 retry)
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => useFeatureFlags(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 5000,
    });
  });
});
