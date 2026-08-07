import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Tooltip", () => {
  // Test 1 (existing, preserve intent)
  it("renders trigger content", () => {
    renderWithProvider(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  // Test 2 (existing, preserve intent)
  it("renders within TooltipProvider without crashing", () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Test Trigger</TooltipTrigger>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(container).toBeInTheDocument();
  });

  // Test 3 (NEW): relationship default-injection probe. Fluent's "label"
  // relationship sets aria-label on the trigger when the tooltip content is
  // a plain string (verified via source read of useTooltipBase.js:
  // `if (typeof state.content.children === 'string') triggerAriaProps['aria-label'] = ...`).
  it("injects relationship='label' by default, setting aria-label on the trigger from string content", () => {
    renderWithProvider(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Icon Button</button>
        </TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Save changes" });
    expect(trigger).toHaveAttribute("aria-label", "Save changes");
  });

  // Test 4 (NEW): an explicit relationship="description" override is
  // respected and not clobbered by the default-injection logic -- Fluent's
  // "description" relationship sets aria-describedby (not aria-label) on
  // the trigger, referencing the tooltip content's generated id.
  it("respects an explicit relationship='description' override", () => {
    renderWithProvider(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Icon Button</button>
        </TooltipTrigger>
        <TooltipContent relationship="description">Extra detail</TooltipContent>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Icon Button" });
    expect(trigger).not.toHaveAttribute("aria-label", "Extra detail");
    expect(trigger).toHaveAttribute("aria-describedby");
  });
});
