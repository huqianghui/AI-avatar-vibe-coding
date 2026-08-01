import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/user-preferences", () => ({
  userPreferencesApi: {
    getSummary: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { userPreferencesApi } from "@/api/user-preferences";
import type { PersonalizationSummary, UserPreference } from "@/api/user-preferences";
import {
  usePersonalizationSummary,
  useCreatePreference,
  useUpdatePreference,
  useDeletePreference,
  CATEGORY_OPTIONS,
} from "./use-user-preferences";

const mockedGetSummary = vi.mocked(userPreferencesApi.getSummary);
const mockedCreate = vi.mocked(userPreferencesApi.create);
const mockedUpdate = vi.mocked(userPreferencesApi.update);
const mockedRemove = vi.mocked(userPreferencesApi.remove);

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

const mockSummary: PersonalizationSummary = {
  crm_matched: false,
  customer_name: null,
  company: null,
  preferences: [],
};

const mockPreference: UserPreference = {
  id: "p1",
  user_id: "u1",
  category: "focus_area",
  value: "oncology",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("CATEGORY_OPTIONS", () => {
  it("matches backend PREFERENCE_CATEGORIES exactly", () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual([
      "communication_style",
      "focus_area",
      "language_preference",
    ]);
  });
});

describe("usePersonalizationSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches with queryKey ['personalization', userId] and is enabled when userId is truthy", async () => {
    mockedGetSummary.mockResolvedValueOnce(mockSummary);

    const { result } = renderHook(() => usePersonalizationSummary("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetSummary).toHaveBeenCalledWith("u1");
    expect(result.current.data).toEqual(mockSummary);
  });

  it("does not fetch when userId is empty string", () => {
    const { result } = renderHook(() => usePersonalizationSummary(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedGetSummary).not.toHaveBeenCalled();
  });
});

describe("useCreatePreference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls userPreferencesApi.create with userId and data", async () => {
    mockedCreate.mockResolvedValueOnce(mockPreference);

    const { result } = renderHook(() => useCreatePreference("u1"), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ category: "focus_area", value: "oncology" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedCreate).toHaveBeenCalledWith("u1", {
      category: "focus_area",
      value: "oncology",
    });
  });

  it("invalidates ['personalization', userId] on success", async () => {
    mockedCreate.mockResolvedValueOnce(mockPreference);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePreference("u1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ category: "focus_area", value: "oncology" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["personalization", "u1"] });
  });
});

describe("useUpdatePreference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls userPreferencesApi.update with userId, preferenceId, data", async () => {
    mockedUpdate.mockResolvedValueOnce(mockPreference);

    const { result } = renderHook(() => useUpdatePreference("u1"), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ preferenceId: "p1", data: { value: "immunology" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedUpdate).toHaveBeenCalledWith("u1", "p1", { value: "immunology" });
  });
});

describe("useDeletePreference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls userPreferencesApi.remove with userId and preferenceId", async () => {
    mockedRemove.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeletePreference("u1"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("p1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRemove).toHaveBeenCalledWith("u1", "p1");
  });

  it("invalidates ['personalization', userId] on success", async () => {
    mockedRemove.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePreference("u1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("p1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["personalization", "u1"] });
  });
});
