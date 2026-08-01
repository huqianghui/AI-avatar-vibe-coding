import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarInputBar, type MicUiState } from "./avatar-input-bar";

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
  }),
}));

function renderBar(overrides: Partial<Parameters<typeof AvatarInputBar>[0]> = {}) {
  const onChange = vi.fn();
  const onSend = vi.fn();
  const onMicClick = vi.fn();
  const props = {
    value: "",
    onChange,
    onSend,
    onMicClick,
    micState: "idle" as MicUiState,
    ...overrides,
  };
  render(<AvatarInputBar {...props} />);
  return { onChange, onSend, onMicClick };
}

describe("AvatarInputBar", () => {
  it("calls onChange when typing in the textarea", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar();

    await user.type(screen.getByRole("textbox"), "hi");

    expect(onChange).toHaveBeenCalled();
  });

  it("Enter without Shift calls onSend and prevents newline insertion", async () => {
    const user = userEvent.setup();
    const { onSend } = renderBar();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("Shift+Enter does not call onSend", async () => {
    const user = userEvent.setup();
    const { onSend } = renderBar();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("Enter while rate-limited does not call onSend", async () => {
    const user = userEvent.setup();
    const { onSend } = renderBar({ rateLimitSeconds: 10 });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("clicking the mic button calls onMicClick", async () => {
    const user = userEvent.setup();
    const { onMicClick } = renderBar();

    await user.click(screen.getByRole("button", { name: "input.micIdleAriaLabel" }));

    expect(onMicClick).toHaveBeenCalledTimes(1);
  });

  it("clicking the send button calls onSend", async () => {
    const user = userEvent.setup();
    const { onSend } = renderBar();

    await user.click(screen.getByRole("button", { name: "input.sendAriaLabel" }));

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("renders the rate-limit message and disables send when rateLimitSeconds > 0", () => {
    renderBar({ rateLimitSeconds: 15 });

    expect(screen.getByText("rateLimited(seconds=15)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "input.sendAriaLabel" })).toBeDisabled();
  });

  it("does not render the rate-limit message when rateLimitSeconds is null", () => {
    renderBar({ rateLimitSeconds: null });

    expect(screen.queryByText(/rateLimited/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "input.sendAriaLabel" })).toBeEnabled();
  });

  it.each<[MicUiState, string]>([
    ["idle", "bg-primary"],
    ["listening", "bg-voice-speaking"],
    ["speaking", "bg-voice-warning"],
    ["muted", "bg-muted-foreground"],
    ["disabled", "bg-muted"],
  ])("applies the correct color class for micState=%s", (micState, expectedClass) => {
    renderBar({ micState });

    const micButton = screen.getByRole("button", { name: "input.micIdleAriaLabel" });
    expect(micButton.className).toContain(expectedClass);
  });

  it('micState="disabled" disables the mic button', () => {
    renderBar({ micState: "disabled" });

    expect(screen.getByRole("button", { name: "input.micIdleAriaLabel" })).toBeDisabled();
  });

  it('micState="muted" renders the MicOff icon and micState="speaking" renders Volume2', () => {
    const { container: mutedContainer } = render(
      <AvatarInputBar
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onMicClick={vi.fn()}
        micState="muted"
      />,
    );
    expect(mutedContainer.querySelector("svg.lucide-mic-off")).toBeInTheDocument();
  });
});
