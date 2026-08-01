/**
 * AvatarPage composition tests (Phase 32, ANON-04).
 *
 * Mocks every hook AvatarPage composes (`useAnonymousAvatarSession`,
 * `useAnonymousAvatarChat`, `useAnonymousVoiceLive`) so these tests exercise
 * only the page's own wiring/composition logic -- not the hooks' internals
 * (those are covered by their own dedicated test files).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import AvatarPage from "./avatar-page";

const mockNavigate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
      if (opts) {
        const suffix = Object.entries(opts)
          .map(([k, v]) => `${k}=${v}`)
          .join(",");
        return `${key}(${suffix})`;
      }
      return key;
    },
    i18n: { language: "en-US" },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Same Radix-Dialog-avoidance convention used by sources-panel.test.tsx.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockRenewSession = vi.fn();
let mockSessionToken: string | null = "anon-token-123";
vi.mock("@/hooks/use-anonymous-avatar-session", () => ({
  useAnonymousAvatarSession: () => ({
    sessionToken: mockSessionToken,
    expiresAt: null,
    isLoading: false,
    error: null,
    renewSession: mockRenewSession,
  }),
}));

const mockMutate = vi.fn();
vi.mock("@/hooks/use-anonymous-avatar-chat", () => ({
  useAnonymousAvatarChat: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const mockConnect = vi.fn();
vi.mock("@/hooks/use-anonymous-voice-live", () => ({
  useAnonymousVoiceLive: () => ({
    connect: mockConnect,
    disconnect: vi.fn(),
    toggleMute: vi.fn(),
    sendTextMessage: vi.fn(),
    sendAudio: vi.fn(),
    send: vi.fn(),
    isMuted: false,
    connectionState: "disconnected",
    audioState: "idle",
    avatarSdpCallbackRef: { current: null },
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

describe("AvatarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionToken = "anon-token-123";
    mockConnect.mockResolvedValue(undefined);
  });

  it("renders at / without any auth context and does not redirect", () => {
    render(<AvatarPage />, { wrapper });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("submitting a question sends only the answer to the transcript and only citations to SourcesPanel", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation(
      (_message: string, options: { onSuccess: (data: unknown) => void }) => {
        options.onSuccess({
          answer: "The answer text",
          citations: [
            { title: "Secret Source Title", url: "https://example.com/secret-source", page: 1 },
          ],
          is_refusal: false,
        });
      },
    );

    render(<AvatarPage />, { wrapper });
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "What is the warranty?");
    await user.keyboard("{Enter}");

    expect(mockMutate).toHaveBeenCalledWith("What is the warranty?", expect.any(Object));

    await waitFor(() => {
      expect(screen.getByText("The answer text")).toBeInTheDocument();
    });

    // Mechanical proof of structural separation: transcript bubble text must
    // never contain the citation's url/title.
    const bubbleText = screen.getByText("The answer text").closest("div")?.textContent ?? "";
    expect(bubbleText).not.toContain("https://example.com/secret-source");
    expect(bubbleText).not.toContain("Secret Source Title");

    // SourcesPanel received the citation (rendered separately).
    expect(screen.getByText("Secret Source Title")).toBeInTheDocument();
  });

  it('on is_refusal=true, the transcript bubble uses bg-muted (never destructive) and SourcesPanel shows "empty-no-match"', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation(
      (_message: string, options: { onSuccess: (data: unknown) => void }) => {
        options.onSuccess({
          answer: "I could not find that in the source material.",
          citations: [],
          is_refusal: true,
        });
      },
    );

    render(<AvatarPage />, { wrapper });
    await user.type(screen.getByRole("textbox"), "Unrelated question");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("I could not find that in the source material."),
      ).toBeInTheDocument();
    });

    const bubble = screen
      .getByText("I could not find that in the source material.")
      .closest("div");
    expect(bubble).toHaveClass("bg-muted");
    expect(bubble).not.toHaveClass("bg-destructive");

    expect(screen.getByText("sourcesPanel.emptyNoMatch.heading")).toBeInTheDocument();
  });

  it("on a 429 chat error, disables the send button while keeping the textarea enabled", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation(
      (_message: string, options: { onError: (err: Error) => void }) => {
        options.onError(new Error("send anonymous chat message failed: 429"));
      },
    );

    render(<AvatarPage />, { wrapper });
    await user.type(screen.getByRole("textbox"), "Hello");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "input.sendAriaLabel" })).toBeDisabled();
    });
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("opens MicPermissionDialog automatically on a getUserMedia denial, and keeps the text input enabled", async () => {
    const getUserMediaMock = vi
      .fn()
      .mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
    });
    mockConnect.mockImplementation(() => navigator.mediaDevices.getUserMedia({ audio: true }));

    render(<AvatarPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText("micDialog.title")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeEnabled();
  });
});
