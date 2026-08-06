import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import LoginPage from "./login";

const mockNavigate = vi.fn();
const mockMutate = vi.fn();
let mockIsPending = false;
let mockIsError = false;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useLogin: () => ({
    mutate: mockMutate,
    isPending: mockIsPending,
    isError: mockIsError,
    error: null,
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockIsError = false;
  });

  it("renders the login form with title", () => {
    render(<LoginPage />, { wrapper });
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders username and password input fields", () => {
    render(<LoginPage />, { wrapper });
    expect(screen.getByLabelText("email")).toBeInTheDocument();
    expect(screen.getByLabelText("password")).toBeInTheDocument();
  });

  it("renders the sign in button", () => {
    render(<LoginPage />, { wrapper });
    expect(screen.getByRole("button", { name: "signIn" })).toBeInTheDocument();
  });

  it("renders the remember me checkbox", () => {
    render(<LoginPage />, { wrapper });
    expect(screen.getByText("rememberMe")).toBeInTheDocument();
  });

  it("allows typing into username and password fields", async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper });

    const usernameInput = screen.getByLabelText("email");
    const passwordInput = screen.getByLabelText("password");

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpass");

    expect(usernameInput).toHaveValue("testuser");
    expect(passwordInput).toHaveValue("testpass");
  });

  it("calls loginMutation.mutate on form submit", async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper });

    const usernameInput = screen.getByLabelText("email");
    const passwordInput = screen.getByLabelText("password");

    await user.type(usernameInput, "admin");
    await user.type(passwordInput, "password123");
    await user.click(screen.getByRole("button", { name: "signIn" }));

    expect(mockMutate).toHaveBeenCalledWith(
      { username: "admin", password: "password123" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("toggles password visibility when clicking eye button", async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper });

    const passwordInput = screen.getByLabelText("password");
    expect(passwordInput).toHaveAttribute("type", "password");

    // Click the show password button
    const toggleBtn = screen.getByLabelText("ariaShowPassword");
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute("type", "text");
  });

  // NEW TESTS for uncovered branches

  it("toggles password back to hidden on second click", async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper });

    const passwordInput = screen.getByLabelText("password");
    // Show password
    await user.click(screen.getByLabelText("ariaShowPassword"));
    expect(passwordInput).toHaveAttribute("type", "text");
    // Hide password (label changes to ariaHidePassword)
    await user.click(screen.getByLabelText("ariaHidePassword"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows error message when login fails (isError = true)", () => {
    mockIsError = true;
    render(<LoginPage />, { wrapper });
    expect(screen.getByText("loginFailed")).toBeInTheDocument();
  });

  it("does not show error message when isError is false", () => {
    mockIsError = false;
    render(<LoginPage />, { wrapper });
    expect(screen.queryByText("loginFailed")).not.toBeInTheDocument();
  });

  it("shows loading state when isPending is true", () => {
    mockIsPending = true;
    render(<LoginPage />, { wrapper });
    expect(screen.getByText("signingIn")).toBeInTheDocument();
  });

  it("disables submit button when isPending is true", () => {
    mockIsPending = true;
    render(<LoginPage />, { wrapper });
    const submitBtn = screen.getByRole("button", { name: /signingIn/ });
    expect(submitBtn).toBeDisabled();
  });

  it("disables input fields when isPending is true", () => {
    mockIsPending = true;
    render(<LoginPage />, { wrapper });
    expect(screen.getByLabelText("email")).toBeDisabled();
    expect(screen.getByLabelText("password")).toBeDisabled();
  });

  it("navigates admin to /admin/dashboard on login success", async () => {
    const user = userEvent.setup();
    // Make the mutate call invoke onSuccess with an admin user
    mockMutate.mockImplementation((_data: unknown, options: { onSuccess: (u: { role: string }) => void }) => {
      options.onSuccess({ role: "admin" });
    });
    render(<LoginPage />, { wrapper });

    await user.type(screen.getByLabelText("email"), "admin");
    await user.type(screen.getByLabelText("password"), "pass");
    await user.click(screen.getByRole("button", { name: "signIn" }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("navigates user to / on login success", async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_data: unknown, options: { onSuccess: (u: { role: string }) => void }) => {
      options.onSuccess({ role: "user" });
    });
    render(<LoginPage />, { wrapper });

    await user.type(screen.getByLabelText("email"), "user1");
    await user.type(screen.getByLabelText("password"), "pass");
    await user.click(screen.getByRole("button", { name: "signIn" }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("can check the remember me checkbox", async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
