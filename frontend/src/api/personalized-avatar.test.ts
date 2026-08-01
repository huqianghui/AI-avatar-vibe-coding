import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shared apiClient module (matches azure-config.test.ts's convention).
vi.mock("@/api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

import apiClient from "@/api/client";
import { createPersonalizedSession, sendPersonalizedChat } from "./personalized-avatar";

const mockedPost = vi.mocked(apiClient.post);

describe("personalized-avatar API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPersonalizedSession", () => {
    it("calls apiClient.post('/avatar/session') and returns { session_id, expires_at } on 200", async () => {
      mockedPost.mockResolvedValueOnce({
        data: { session_id: "sess-1", expires_at: "2026-08-01T12:00:00Z" },
      });

      const result = await createPersonalizedSession();

      expect(apiClient.post).toHaveBeenCalledWith("/avatar/session");
      expect(result).toEqual({ session_id: "sess-1", expires_at: "2026-08-01T12:00:00Z" });
    });
  });

  describe("sendPersonalizedChat", () => {
    it("calls apiClient.post('/avatar/chat', { session_id, message, locale }) and returns { answer, citations, is_refusal }", async () => {
      mockedPost.mockResolvedValueOnce({
        data: {
          answer: "Personalized answer",
          citations: [{ title: "Doc", url: "https://example.com/doc", page: 1 }],
          is_refusal: false,
        },
      });

      const result = await sendPersonalizedChat("sess-1", "What is my order status?", "zh-CN");

      expect(apiClient.post).toHaveBeenCalledWith("/avatar/chat", {
        session_id: "sess-1",
        message: "What is my order status?",
        locale: "zh-CN",
      });
      expect(result).toEqual({
        answer: "Personalized answer",
        citations: [{ title: "Doc", url: "https://example.com/doc", page: 1 }],
        is_refusal: false,
      });
    });
  });
});
