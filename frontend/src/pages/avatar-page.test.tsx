/**
 * AvatarPage composition tests (Phase 32, ANON-04).
 *
 * Mocks every hook AvatarPage composes (`useAnonymousAvatarSession`,
 * `useAnonymousAvatarChat`, `useAnonymousVoiceLive`) so these tests exercise
 * only the page's own wiring/composition logic -- not the hooks' internals
 * (those are covered by their own dedicated test files).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
let mockIsPending = false;
let capturedOnUnauthorized: (() => void) | null = null;
vi.mock("@/hooks/use-anonymous-avatar-chat", () => ({
  useAnonymousAvatarChat: (_token: string | null, onUnauthorized: () => void) => {
    capturedOnUnauthorized = onUnauthorized;
    return {
      mutate: mockMutate,
      isPending: mockIsPending,
    };
  },
}));

const mockConnect = vi.fn();
const mockToggleMute = vi.fn();
let mockConnectionState: "disconnected" | "connecting" | "connected" = "disconnected";
let mockAudioState: "idle" | "listening" | "speaking" = "idle";
let mockIsMuted = false;
vi.mock("@/hooks/use-anonymous-voice-live", () => ({
  useAnonymousVoiceLive: () => ({
    connect: mockConnect,
    disconnect: vi.fn(),
    toggleMute: mockToggleMute,
    sendTextMessage: vi.fn(),
    sendAudio: vi.fn(),
    send: vi.fn(),
    isMuted: mockIsMuted,
    connectionState: mockConnectionState,
    audioState: mockAudioState,
    avatarSdpCallbackRef: { current: null },
  }),
}));

// Auth-aware routing mocks (Phase 33, PERS-02).
let mockIsAuthenticated = false;
let mockAuthUser: { email: string } | null = null;
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockAuthUser,
  }),
}));

// AvatarPage calls useMe() purely for its /auth/me hydration side-effect
// (see avatar-page.tsx docstring) -- it never consumes the return value, so
// this stub only needs to exist to avoid requiring a real QueryClientProvider
// in this hook-mocked composition test.
vi.mock("@/hooks/use-auth", () => ({
  useMe: () => ({ data: undefined, isLoading: false, error: null }),
}));

let mockPersonalizedSession: { session_id: string; expires_at: string } | null = null;
const mockPersonalizedRenewSession = vi.fn();
vi.mock("@/hooks/use-personalized-avatar-session", () => ({
  usePersonalizedAvatarSession: () => ({
    session: mockPersonalizedSession,
    isLoading: false,
    error: null,
    renewSession: mockPersonalizedRenewSession,
  }),
}));

const mockPersonalizedMutate = vi.fn();
let mockPersonalizedIsPending = false;
vi.mock("@/hooks/use-personalized-avatar-chat", () => ({
  usePersonalizedAvatarChat: () => ({
    mutate: mockPersonalizedMutate,
    isPending: mockPersonalizedIsPending,
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
    mockIsPending = false;
    mockConnectionState = "disconnected";
    mockAudioState = "idle";
    mockIsMuted = false;
    mockIsAuthenticated = false;
    mockAuthUser = null;
    mockPersonalizedSession = null;
    mockPersonalizedIsPending = false;
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

  it("resolves mic UI state to disabled while connecting", () => {
    mockConnectionState = "connecting";
    render(<AvatarPage />, { wrapper });

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    expect(micButton).toBeDisabled();
  });

  it("resolves mic UI state to muted when voiceLive.isMuted is true", () => {
    mockConnectionState = "connected";
    mockIsMuted = true;
    render(<AvatarPage />, { wrapper });

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    expect(micButton.className).toContain("bg-muted-foreground");
  });

  it("resolves mic UI state to listening when voiceLive.audioState is listening", () => {
    mockConnectionState = "connected";
    mockAudioState = "listening";
    render(<AvatarPage />, { wrapper });

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    expect(micButton.className).toContain("bg-voice-speaking");
  });

  it("resolves mic UI state to speaking when voiceLive.audioState is speaking", () => {
    mockConnectionState = "connected";
    mockAudioState = "speaking";
    render(<AvatarPage />, { wrapper });

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    expect(micButton.className).toContain("bg-voice-warning");
  });

  it("clicking the mic button while already connected toggles mute instead of reconnecting", async () => {
    const user = userEvent.setup();
    mockConnectionState = "connected";
    render(<AvatarPage />, { wrapper });

    // The mount effect always attempts one connect while sessionToken exists
    // (real hook only reports "connected" after that resolves) -- clicking
    // the mic button while already connected must not trigger a second one.
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    await user.click(micButton);

    expect(mockToggleMute).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("shows stillDenied messaging after a second consecutive mic connect failure", async () => {
    mockConnect.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
    });
    expect(screen.queryByText("micDialog.stillDenied")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "micDialog.retry" }));

    await waitFor(() => {
      expect(screen.getByText("micDialog.stillDenied")).toBeInTheDocument();
    });
  });

  it('"Use text instead" closes the mic dialog and focuses the textarea', async () => {
    mockConnect.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "micDialog.useTextInstead" }));

    await waitFor(() => {
      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveFocus();
    });
  });

  it("does not call mutate when the message is only whitespace", async () => {
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    await user.type(screen.getByRole("textbox"), "   ");
    await user.keyboard("{Enter}");

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not call mutate again while a chat mutation is already pending", async () => {
    mockIsPending = true;
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    await user.type(screen.getByRole("textbox"), "Another question");
    await user.keyboard("{Enter}");

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows the SourcesPanel loading state while the chat mutation is pending", () => {
    mockIsPending = true;
    render(<AvatarPage />, { wrapper });

    expect(screen.queryByText("sourcesPanel.emptyNoMatch.heading")).not.toBeInTheDocument();
  });

  it("on a non-429 chat error, shows a generic connection-failed toast and keeps send enabled", async () => {
    const { toast } = await import("sonner");
    const user = userEvent.setup();
    mockMutate.mockImplementation(
      (_message: string, options: { onError: (err: Error) => void }) => {
        options.onError(new Error("network failure"));
      },
    );

    render(<AvatarPage />, { wrapper });
    await user.type(screen.getByRole("textbox"), "Hello");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("error.connectionFailed");
    });
    expect(screen.getByRole("button", { name: "input.sendAriaLabel" })).toBeEnabled();
  });

  it("uses AnonymousApiError.retryAfterSeconds for the countdown when present", async () => {
    const { AnonymousApiError } = await import("@/api/public-avatar");
    const user = userEvent.setup();
    mockMutate.mockImplementation(
      (_message: string, options: { onError: (err: Error) => void }) => {
        options.onError(new AnonymousApiError("send anonymous chat message failed: 429", 429, 5));
      },
    );

    render(<AvatarPage />, { wrapper });
    await user.type(screen.getByRole("textbox"), "Hello");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("rateLimited(seconds=5)")).toBeInTheDocument();
    });
  });

  it('renders "empty-no-match" sources state when a non-refusal answer has zero citations', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation(
      (_message: string, options: { onSuccess: (data: unknown) => void }) => {
        options.onSuccess({
          answer: "An answer with no sources",
          citations: [],
          is_refusal: false,
        });
      },
    );

    render(<AvatarPage />, { wrapper });
    await user.type(screen.getByRole("textbox"), "Any question");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("sourcesPanel.emptyNoMatch.heading")).toBeInTheDocument();
    });
  });

  it("clicking the login button navigates to /login", async () => {
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    await user.click(screen.getByRole("button", { name: /login/ }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("calls renewSession when the chat hook reports an unauthorized (401) session", () => {
    render(<AvatarPage />, { wrapper });

    capturedOnUnauthorized?.();

    expect(mockRenewSession).toHaveBeenCalledTimes(1);
  });

  it("clicking the mic button while disconnected attempts a mic connect", async () => {
    const user = userEvent.setup();
    // Prevent the mount effect from auto-attempting a connect so the click
    // is the only call under test.
    mockSessionToken = null;
    render(<AvatarPage />, { wrapper });

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    await user.click(micButton);

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("counts down rate-limit seconds and clears back to null (re-enabling send) at zero", () => {
    vi.useFakeTimers();
    try {
      mockMutate.mockImplementation(
        (_message: string, options: { onError: (err: Error) => void }) => {
          options.onError(new Error("send anonymous chat message failed: 429"));
        },
      );

      render(<AvatarPage />, { wrapper });
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Hello" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(screen.getByText("rateLimited(seconds=30)")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText("rateLimited(seconds=29)")).toBeInTheDocument();

      // Fast-forward the remaining seconds down to and past zero.
      act(() => {
        vi.advanceTimersByTime(29_000);
      });

      expect(screen.queryByText(/rateLimited/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "input.sendAriaLabel" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AvatarPage — authenticated user (Phase 33, PERS-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionToken = "anon-token-123";
    mockConnect.mockResolvedValue(undefined);
    mockIsPending = false;
    mockConnectionState = "disconnected";
    mockAudioState = "idle";
    mockIsMuted = false;
    mockIsAuthenticated = true;
    mockAuthUser = { email: "test@x.com" };
    mockPersonalizedSession = { session_id: "psess-1", expires_at: "2026-08-01T12:00:00Z" };
    mockPersonalizedIsPending = false;
  });

  it('renders the "专属模式" badge + user email instead of the 登录 button when isAuthenticated is true', () => {
    render(<AvatarPage />, { wrapper });

    expect(screen.getByText("personalizationBadge")).toBeInTheDocument();
    expect(screen.getByText("test@x.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /login/ })).not.toBeInTheDocument();
  });

  it("routes chat through usePersonalizedAvatarChat, never the anonymous chat mutation", async () => {
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    await user.type(screen.getByRole("textbox"), "What is my order status?");
    await user.keyboard("{Enter}");

    expect(mockPersonalizedMutate).toHaveBeenCalledWith(
      "What is my order status?",
      expect.any(Object),
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("renders no CRM field, preference tag, or match-status content anywhere on the page", () => {
    const { container } = render(<AvatarPage />, { wrapper });

    const forbidden = [
      "crm_notes",
      "contact_person",
      "customer_name",
      "match",
      "已匹配",
      "未匹配",
      "偏好标签",
    ];
    const text = container.textContent ?? "";
    for (const term of forbidden) {
      expect(text).not.toContain(term);
    }
  });

  it("still calls the anonymous voice-live connect unconditionally (D-13 — zero new voice code)", async () => {
    render(<AvatarPage />, { wrapper });

    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));
  });
});

describe("AvatarPage — logged-out user regression guard (Phase 33, PERS-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionToken = "anon-token-123";
    mockConnect.mockResolvedValue(undefined);
    mockIsPending = false;
    mockConnectionState = "disconnected";
    mockAudioState = "idle";
    mockIsMuted = false;
    mockIsAuthenticated = false;
    mockAuthUser = null;
    mockPersonalizedSession = null;
    mockPersonalizedIsPending = false;
  });

  it("still renders the 登录 button and routes chat through the anonymous mutation when logged out", async () => {
    const user = userEvent.setup();
    render(<AvatarPage />, { wrapper });

    expect(screen.queryByText("personalizationBadge")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/ })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "Hello");
    await user.keyboard("{Enter}");

    expect(mockMutate).toHaveBeenCalledWith("Hello", expect.any(Object));
    expect(mockPersonalizedMutate).not.toHaveBeenCalled();
  });
});
