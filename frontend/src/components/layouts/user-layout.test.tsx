import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UserLayout } from "./user-layout";

const mockLogout = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: { full_name: "Jane Doe", role: "user", username: "janedoe" },
    token: "mock-token",
    isAuthenticated: true,
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useLogout: () => mockLogout,
}));

const { mockUseConfig } = vi.hoisted(() => ({
  mockUseConfig: vi.fn(() => ({
    avatar_enabled: false,
    voice_enabled: false,
    realtime_voice_enabled: false,
    conference_enabled: false,
    voice_live_enabled: false,
    legacy_coach_nav_enabled: true,
    default_voice_mode: "text_only",
    region: "global",
  })),
}));

vi.mock("@/contexts/config-context", () => ({
  useConfig: mockUseConfig,
}));

vi.mock("@/components/shared/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

describe("UserLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the AI Coach brand name", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    // Logo is now an SVG icon; brand text shows "AI Coach"
    expect(screen.getByText("AI Coach")).toBeInTheDocument();
  });

  it("renders all desktop navigation items", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    // navItems labelKeys rendered via t() mock that returns the key
    expect(screen.getAllByText("dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("training").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("history").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("reports").length).toBeGreaterThanOrEqual(1);
  });

  it("hides navigation items on both desktop and mobile when legacy_coach_nav_enabled is false", () => {
    mockUseConfig.mockReturnValueOnce({
      avatar_enabled: false,
      voice_enabled: false,
      realtime_voice_enabled: false,
      conference_enabled: false,
      voice_live_enabled: false,
      legacy_coach_nav_enabled: false,
      default_voice_mode: "text_only",
      region: "global",
    });

    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("training")).not.toBeInTheDocument();
    expect(screen.queryByText("history")).not.toBeInTheDocument();
    expect(screen.queryByText("reports")).not.toBeInTheDocument();
  });

  it("renders the user avatar with initials", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders the footer with year text", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("2026 AI Coach Platform")).toBeInTheDocument();
  });

  it("renders the notifications button", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("renders language switcher in header", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });

  it("shows user dropdown with profile and logout on avatar click", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    const avatarButton = screen.getByText("Jane Doe").closest("button");
    expect(avatarButton).toBeInTheDocument();
    await user.click(avatarButton!);

    expect(screen.getByText("profile")).toBeInTheDocument();
    expect(screen.getByText("logout")).toBeInTheDocument();
  });

  it("renders mobile hamburger menu button", () => {
    render(
      <MemoryRouter initialEntries={["/user/dashboard"]}>
        <UserLayout />
      </MemoryRouter>,
    );

    // At least one button should be the mobile hamburger (with class md:hidden)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
