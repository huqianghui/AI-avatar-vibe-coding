import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AvatarPersona } from "@/api/avatar-personas";

vi.mock("@/api/avatar-personas", () => ({
  avatarPersonasApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setDefault: vi.fn(),
    retrySync: vi.fn(),
    getAgentPortalUrl: vi.fn(),
  },
}));

import { avatarPersonasApi } from "@/api/avatar-personas";
import {
  useAvatarPersonas,
  useAvatarPersona,
  useCreateAvatarPersona,
  useUpdateAvatarPersona,
  useDeleteAvatarPersona,
  useSetDefaultAvatarPersona,
  useRetrySyncAvatarPersona,
} from "./use-avatar-personas";

const mockedList = vi.mocked(avatarPersonasApi.list);
const mockedGet = vi.mocked(avatarPersonasApi.get);
const mockedCreate = vi.mocked(avatarPersonasApi.create);
const mockedUpdate = vi.mocked(avatarPersonasApi.update);
const mockedRemove = vi.mocked(avatarPersonasApi.remove);
const mockedSetDefault = vi.mocked(avatarPersonasApi.setDefault);
const mockedRetrySync = vi.mocked(avatarPersonasApi.retrySync);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createWrapperWithSpy() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, invalidateSpy };
}

const mockPersona: AvatarPersona = {
  id: "p1",
  name: "Lisa",
  character: "lisa",
  style: "casual-sitting",
  voice_map: {},
  greeting_map: { "en-US": "Hi there!" },
  prompt_fragment: "",
  enabled: true,
  is_default: true,
  agent_id: "",
  agent_version: "",
  agent_sync_status: "none",
  agent_sync_error: "",
  proactive_engagement: false,
  interim_response_enabled: false,
  interim_response_type: "llm",
  interim_response_threshold_ms: 500,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useAvatarPersonas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.list and exposes the returned array via data", async () => {
    mockedList.mockResolvedValueOnce([mockPersona]);

    const { result } = renderHook(() => useAvatarPersonas(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedList).toHaveBeenCalledWith();
    expect(result.current.data).toEqual([mockPersona]);
  });
});

describe("useAvatarPersona", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.get with the given id and exposes the result via data", async () => {
    mockedGet.mockResolvedValueOnce(mockPersona);

    const { result } = renderHook(() => useAvatarPersona("p1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("p1");
    expect(result.current.data).toEqual(mockPersona);
  });

  it("does not call avatarPersonasApi.get when id is undefined", () => {
    const { result } = renderHook(() => useAvatarPersona(undefined), {
      wrapper: createWrapper(),
    });

    expect(mockedGet).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  // Perf follow-up to persona-hcp-foundry-alignment: Foundry agent sync now
  // runs as a background task, so the detail query must poll while pending
  // and stop polling once the sync reaches a terminal state.
  it("refetches automatically while agent_sync_status is pending", async () => {
    vi.useFakeTimers();
    try {
      mockedGet
        .mockResolvedValueOnce({ ...mockPersona, agent_sync_status: "pending" })
        .mockResolvedValueOnce({ ...mockPersona, agent_sync_status: "synced" });

      const { result } = renderHook(() => useAvatarPersona("p1"), {
        wrapper: createWrapper(),
      });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.agent_sync_status).toBe("pending");
      expect(mockedGet).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      await vi.waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
      expect(result.current.data?.agent_sync_status).toBe("synced");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not refetch on an interval once agent_sync_status is synced", async () => {
    vi.useFakeTimers();
    try {
      mockedGet.mockResolvedValueOnce({ ...mockPersona, agent_sync_status: "synced" });

      const { result } = renderHook(() => useAvatarPersona("p1"), {
        wrapper: createWrapper(),
      });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedGet).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(mockedGet).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useCreateAvatarPersona", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.create and invalidates the list query key on success", async () => {
    mockedCreate.mockResolvedValueOnce(mockPersona);
    const { Wrapper, invalidateSpy } = createWrapperWithSpy();

    const { result } = renderHook(() => useCreateAvatarPersona(), { wrapper: Wrapper });

    result.current.mutate({ name: "Lisa", character: "lisa" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedCreate).toHaveBeenCalledWith({ name: "Lisa", character: "lisa" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["avatar-personas"] });
  });
});

describe("useUpdateAvatarPersona", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.update with { id, data } and invalidates on success", async () => {
    mockedUpdate.mockResolvedValueOnce(mockPersona);
    const { Wrapper, invalidateSpy } = createWrapperWithSpy();

    const { result } = renderHook(() => useUpdateAvatarPersona(), { wrapper: Wrapper });

    result.current.mutate({ id: "p1", data: { name: "Lisa 2" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedUpdate).toHaveBeenCalledWith("p1", { name: "Lisa 2" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["avatar-personas"] });
  });
});

describe("useDeleteAvatarPersona", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.remove and invalidates on success", async () => {
    mockedRemove.mockResolvedValueOnce(undefined);
    const { Wrapper, invalidateSpy } = createWrapperWithSpy();

    const { result } = renderHook(() => useDeleteAvatarPersona(), { wrapper: Wrapper });

    result.current.mutate({ id: "p1", newDefaultPersonaId: "p2" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRemove).toHaveBeenCalledWith("p1", "p2");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["avatar-personas"] });
  });
});

describe("useSetDefaultAvatarPersona", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.setDefault and invalidates on success", async () => {
    mockedSetDefault.mockResolvedValueOnce(mockPersona);
    const { Wrapper, invalidateSpy } = createWrapperWithSpy();

    const { result } = renderHook(() => useSetDefaultAvatarPersona(), { wrapper: Wrapper });

    result.current.mutate("p1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSetDefault).toHaveBeenCalledWith("p1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["avatar-personas"] });
  });
});

describe("useRetrySyncAvatarPersona", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls avatarPersonasApi.retrySync and invalidates on success", async () => {
    mockedRetrySync.mockResolvedValueOnce({ ...mockPersona, agent_sync_status: "synced" });
    const { Wrapper, invalidateSpy } = createWrapperWithSpy();

    const { result } = renderHook(() => useRetrySyncAvatarPersona(), { wrapper: Wrapper });

    result.current.mutate("p1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRetrySync).toHaveBeenCalledWith("p1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["avatar-personas"] });
  });
});
