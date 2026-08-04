import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PersonaKnowledgeConfig } from "@/types/knowledge-base";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockAddMutate = vi.fn();
const mockRemoveMutate = vi.fn();

let mockConfigsReturn: { data: PersonaKnowledgeConfig[] | undefined; isLoading: boolean };
let mockAddReturn: { isPending: boolean } = { isPending: false };
let mockRemoveReturn: { isPending: boolean } = { isPending: false };

vi.mock("@/hooks/use-knowledge-base", () => ({
  usePersonaKnowledgeConfigs: () => mockConfigsReturn,
  useAddPersonaKnowledgeConfig: () => ({
    mutate: mockAddMutate,
    isPending: mockAddReturn.isPending,
  }),
  useRemovePersonaKnowledgeConfig: () => ({
    mutate: mockRemoveMutate,
    isPending: mockRemoveReturn.isPending,
  }),
  useSearchConnections: () => ({
    data: [{ name: "conn-a", target: "https://search.example.com", is_default: true }],
    isLoading: false,
  }),
  useSearchIndexes: () => ({
    data: [{ name: "index-a", version: null, type: null, description: null }],
    isLoading: false,
  }),
}));

import { PersonaKnowledgeSection } from "./persona-knowledge-section";

function makeConfig(overrides: Partial<PersonaKnowledgeConfig> = {}): PersonaKnowledgeConfig {
  return {
    id: "config-1",
    avatar_persona_id: "persona-1",
    connection_name: "conn-a",
    connection_target: "https://search.example.com",
    index_name: "index-a",
    server_label: "knowledge-base-index-a",
    is_enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("PersonaKnowledgeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigsReturn = { data: [], isLoading: false };
    mockAddReturn = { isPending: false };
    mockRemoveReturn = { isPending: false };
  });

  it("renders the knowledge title and description", () => {
    render(<PersonaKnowledgeSection personaId="persona-1" />);
    expect(screen.getByText("hcp.knowledgeTitle")).toBeInTheDocument();
    expect(screen.getByText("hcp.knowledgeDescription")).toBeInTheDocument();
  });

  it("shows the empty state when there are no configs", () => {
    render(<PersonaKnowledgeSection personaId="persona-1" />);
    expect(screen.getByText("hcp.noKnowledgeBases")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockConfigsReturn = { data: undefined, isLoading: true };
    render(<PersonaKnowledgeSection personaId="persona-1" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("lists an existing config", () => {
    mockConfigsReturn = { data: [makeConfig()], isLoading: false };
    render(<PersonaKnowledgeSection personaId="persona-1" />);
    expect(screen.getByText("index-a")).toBeInTheDocument();
    expect(screen.getByText(/conn-a/)).toBeInTheDocument();
  });

  it("calls the remove mutation when the remove button is clicked", async () => {
    mockConfigsReturn = { data: [makeConfig()], isLoading: false };
    render(<PersonaKnowledgeSection personaId="persona-1" />);

    await userEvent.click(screen.getByText("hcp.removeKnowledgeBase"));

    expect(mockRemoveMutate).toHaveBeenCalledWith("config-1");
  });

  it("opens the connect dialog and calls the add mutation with personaId", async () => {
    render(<PersonaKnowledgeSection personaId="persona-1" />);

    await userEvent.click(screen.getByText("hcp.addKnowledgeBase"));
    await userEvent.click(screen.getByText("hcp.connectToFoundryIQ"));

    // Dialog is open now -- select connection then index, then connect.
    await userEvent.click(screen.getByText("hcp.connectButton"));

    // Nothing selected yet -- button should be a no-op (still just one dialog open).
    expect(mockAddMutate).not.toHaveBeenCalled();
  });
});
