import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from "./client";
import { userPreferencesApi } from "./user-preferences";
import type { PersonalizationSummary, UserPreference } from "./user-preferences";

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedDelete = vi.mocked(apiClient.delete);

describe("userPreferencesApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getSummary calls GET /users/{userId}/personalization and returns PersonalizationSummary", async () => {
    const summary: PersonalizationSummary = {
      crm_matched: true,
      customer_name: "张三",
      company: "XX医院",
      preferences: [],
    };
    mockedGet.mockResolvedValueOnce({ data: summary });

    const result = await userPreferencesApi.getSummary("u1");

    expect(mockedGet).toHaveBeenCalledWith("/users/u1/personalization");
    expect(result).toEqual(summary);
  });

  it("create calls POST /users/{userId}/preferences with body", async () => {
    const pref: UserPreference = {
      id: "p1",
      user_id: "u1",
      category: "focus_area",
      value: "oncology",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    mockedPost.mockResolvedValueOnce({ data: pref });

    const result = await userPreferencesApi.create("u1", {
      category: "focus_area",
      value: "oncology",
    });

    expect(mockedPost).toHaveBeenCalledWith("/users/u1/preferences", {
      category: "focus_area",
      value: "oncology",
    });
    expect(result).toEqual(pref);
  });

  it("update calls PUT /users/{userId}/preferences/{preferenceId} with body", async () => {
    const pref: UserPreference = {
      id: "p1",
      user_id: "u1",
      category: "focus_area",
      value: "immunology",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    mockedPut.mockResolvedValueOnce({ data: pref });

    const result = await userPreferencesApi.update("u1", "p1", { value: "immunology" });

    expect(mockedPut).toHaveBeenCalledWith("/users/u1/preferences/p1", {
      value: "immunology",
    });
    expect(result).toEqual(pref);
  });

  it("remove calls DELETE /users/{userId}/preferences/{preferenceId}", async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });

    await userPreferencesApi.remove("u1", "p1");

    expect(mockedDelete).toHaveBeenCalledWith("/users/u1/preferences/p1");
  });
});
