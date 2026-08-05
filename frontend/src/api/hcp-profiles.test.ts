import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  getHcpProfiles,
  getHcpProfile,
  createHcpProfile,
  updateHcpProfile,
  deleteHcpProfile,
  retrySyncHcpProfile,
  batchSyncAgents,
  testChatWithAgent,
  getAgentPortalUrl,
  previewInstructions,
  pullVoiceConfig,
} from "./hcp-profiles";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("HCP Profiles API client", () => {
  describe("getHcpProfiles", () => {
    it("calls GET /hcp-profiles with params", async () => {
      const paginated = {
        items: [{ id: "hp-1", name: "Dr. Smith" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getHcpProfiles({ page: 1, page_size: 10 });

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles", {
        params: { page: 1, page_size: 10 },
      });
      expect(result.total).toBe(1);
    });

    it("calls GET /hcp-profiles without params", async () => {
      const paginated = {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getHcpProfiles();

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles", {
        params: undefined,
      });
      expect(result.items).toHaveLength(0);
    });

    it("supports search filter", async () => {
      const paginated = {
        items: [{ id: "hp-1" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      await getHcpProfiles({ search: "Smith" });

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles", {
        params: { search: "Smith" },
      });
    });
  });

  describe("getHcpProfile", () => {
    it("calls GET /hcp-profiles/:id", async () => {
      mockClient.get.mockResolvedValue({
        data: { id: "hp-1", name: "Dr. Smith" },
      });

      const result = await getHcpProfile("hp-1");

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles/hp-1");
      expect(result.name).toBe("Dr. Smith");
    });

    it("propagates 404 for missing profile", async () => {
      mockClient.get.mockRejectedValue(new Error("404"));

      await expect(getHcpProfile("missing")).rejects.toThrow("404");
    });
  });

  describe("createHcpProfile", () => {
    it("calls POST /hcp-profiles with profile data", async () => {
      const profile = { name: "Dr. New", specialty: "Oncology" };
      mockClient.post.mockResolvedValue({
        data: { id: "hp-new", ...profile },
      });

      const result = await createHcpProfile(profile as never);

      expect(mockClient.post).toHaveBeenCalledWith("/hcp-profiles", profile);
      expect(result.id).toBe("hp-new");
    });
  });

  describe("updateHcpProfile", () => {
    it("calls PUT /hcp-profiles/:id with update data", async () => {
      const update = { name: "Dr. Updated" };
      mockClient.put.mockResolvedValue({
        data: { id: "hp-1", name: "Dr. Updated" },
      });

      const result = await updateHcpProfile("hp-1", update as never);

      expect(mockClient.put).toHaveBeenCalledWith("/hcp-profiles/hp-1", update);
      expect(result.name).toBe("Dr. Updated");
    });
  });

  describe("deleteHcpProfile", () => {
    it("calls DELETE /hcp-profiles/:id", async () => {
      mockClient.delete.mockResolvedValue({ status: 204 });

      await deleteHcpProfile("hp-1");

      expect(mockClient.delete).toHaveBeenCalledWith("/hcp-profiles/hp-1");
    });

    it("propagates errors on delete", async () => {
      mockClient.delete.mockRejectedValue(new Error("403 Forbidden"));

      await expect(deleteHcpProfile("hp-1")).rejects.toThrow("403 Forbidden");
    });
  });

  describe("retrySyncHcpProfile", () => {
    it("calls POST /hcp-profiles/:id/retry-sync", async () => {
      const synced = { id: "hp-1", name: "Dr. Smith", agent_sync_status: "synced" };
      mockClient.post.mockResolvedValue({ data: synced });

      const result = await retrySyncHcpProfile("hp-1");

      expect(mockClient.post).toHaveBeenCalledWith("/hcp-profiles/hp-1/retry-sync");
      expect(result.agent_sync_status).toBe("synced");
    });

    it("propagates errors on retry sync", async () => {
      mockClient.post.mockRejectedValue(new Error("500 Sync failed"));

      await expect(retrySyncHcpProfile("hp-1")).rejects.toThrow("500 Sync failed");
    });
  });

  describe("batchSyncAgents", () => {
    it("calls POST /hcp-profiles/batch-sync and returns sync summary", async () => {
      const syncResult = { synced: 5, failed: 1, total: 6 };
      mockClient.post.mockResolvedValue({ data: syncResult });

      const result = await batchSyncAgents();

      expect(mockClient.post).toHaveBeenCalledWith("/hcp-profiles/batch-sync");
      expect(result.synced).toBe(5);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(6);
    });

    it("returns error field when some syncs fail", async () => {
      const syncResult = { synced: 0, failed: 3, total: 3, error: "Connection timeout" };
      mockClient.post.mockResolvedValue({ data: syncResult });

      const result = await batchSyncAgents();

      expect(result.error).toBe("Connection timeout");
    });

    it("propagates errors from apiClient", async () => {
      mockClient.post.mockRejectedValue(new Error("503 Service Unavailable"));

      await expect(batchSyncAgents()).rejects.toThrow("503 Service Unavailable");
    });
  });

  describe("testChatWithAgent", () => {
    it("calls POST /hcp-profiles/:id/test-chat with message body", async () => {
      const chatResponse = {
        response_text: "Hello, I am Dr. Smith.",
        response_id: "resp-123",
        agent_name: "Dr. Smith Agent",
        agent_version: "v1.0",
      };
      mockClient.post.mockResolvedValue({ data: chatResponse });

      const result = await testChatWithAgent("hp-1", {
        message: "Hello doctor",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/hcp-profiles/hp-1/test-chat", {
        message: "Hello doctor",
      });
      expect(result.response_text).toBe("Hello, I am Dr. Smith.");
      expect(result.response_id).toBe("resp-123");
    });

    it("passes previous_response_id for continuation", async () => {
      const chatResponse = {
        response_text: "Yes, let me explain further.",
        response_id: "resp-456",
        agent_name: "Dr. Smith Agent",
        agent_version: "v1.0",
      };
      mockClient.post.mockResolvedValue({ data: chatResponse });

      const result = await testChatWithAgent("hp-1", {
        message: "Can you explain more?",
        previous_response_id: "resp-123",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/hcp-profiles/hp-1/test-chat", {
        message: "Can you explain more?",
        previous_response_id: "resp-123",
      });
      expect(result.response_id).toBe("resp-456");
    });

    it("propagates errors on test chat", async () => {
      mockClient.post.mockRejectedValue(new Error("404 Agent not found"));

      await expect(
        testChatWithAgent("hp-missing", { message: "Hello" }),
      ).rejects.toThrow("404 Agent not found");
    });
  });

  describe("getAgentPortalUrl", () => {
    it("calls GET /hcp-profiles/:id/portal-url and returns URL data", async () => {
      const portalData = {
        url: "https://portal.azure.com/agent/hp-1",
        agent_name: "Dr. Smith Agent",
        agent_version: "v1.0",
      };
      mockClient.get.mockResolvedValue({ data: portalData });

      const result = await getAgentPortalUrl("hp-1");

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles/hp-1/portal-url");
      expect(result.url).toBe("https://portal.azure.com/agent/hp-1");
      expect(result.agent_name).toBe("Dr. Smith Agent");
    });

    it("propagates errors for missing profile", async () => {
      mockClient.get.mockRejectedValue(new Error("404 Not Found"));

      await expect(getAgentPortalUrl("missing")).rejects.toThrow("404 Not Found");
    });
  });

  describe("previewInstructions", () => {
    it("calls POST /hcp-profiles/preview-instructions with body", async () => {
      const previewResponse = {
        instructions: "You are Dr. Smith, an oncologist...",
        is_override: false,
      };
      mockClient.post.mockResolvedValue({ data: previewResponse });

      const body = {
        name: "Dr. Smith",
        specialty: "Oncology",
        hospital: "Beijing General Hospital",
        personality_type: "analytical",
        difficulty: "medium",
      };

      const result = await previewInstructions(body);

      expect(mockClient.post).toHaveBeenCalledWith(
        "/hcp-profiles/preview-instructions",
        body,
        { signal: undefined },
      );
      expect(result.instructions).toContain("Dr. Smith");
      expect(result.is_override).toBe(false);
    });

    it("returns override flag when agent_instructions_override is set", async () => {
      const previewResponse = {
        instructions: "Custom override instructions",
        is_override: true,
      };
      mockClient.post.mockResolvedValue({ data: previewResponse });

      const result = await previewInstructions({
        agent_instructions_override: "Custom override instructions",
      });

      expect(result.is_override).toBe(true);
    });

    it("passes AbortSignal when provided", async () => {
      const controller = new AbortController();
      mockClient.post.mockResolvedValue({
        data: { instructions: "test", is_override: false },
      });

      await previewInstructions({ name: "Test" }, controller.signal);

      expect(mockClient.post).toHaveBeenCalledWith(
        "/hcp-profiles/preview-instructions",
        { name: "Test" },
        { signal: controller.signal },
      );
    });

    it("propagates errors from apiClient", async () => {
      mockClient.post.mockRejectedValue(new Error("422 Validation Error"));

      await expect(previewInstructions({})).rejects.toThrow("422 Validation Error");
    });
  });

  describe("pullVoiceConfig", () => {
    it("calls POST /hcp-profiles/:id/agent/pull-voice-config and returns updated profile", async () => {
      const updated = {
        id: "hp-1",
        name: "Dr. Smith",
        voice_name: "en-US-JennyNeural",
        agent_sync_status: "synced",
      };
      mockClient.post.mockResolvedValue({ data: updated });

      const result = await pullVoiceConfig("hp-1");

      expect(mockClient.post).toHaveBeenCalledWith(
        "/hcp-profiles/hp-1/agent/pull-voice-config",
      );
      expect(result.voice_name).toBe("en-US-JennyNeural");
    });

    it("propagates errors on pull voice config", async () => {
      mockClient.post.mockRejectedValue(new Error("422 No agent to pull from"));

      await expect(pullVoiceConfig("hp-1")).rejects.toThrow(
        "422 No agent to pull from",
      );
    });
  });
});
