import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { Label } from "./label";

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

afterEach(() => {
  cleanup();
});

describe("Label", () => {
  it("renders Fluent Label with htmlFor correctly associating to its target input", () => {
    renderWithProvider(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    );
    const label = screen.getByText("Email");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "email");
    // getByLabelText resolves via the htmlFor/id association -- confirms it
    // actually associates, not just renders the matching attribute.
    expect(screen.getByLabelText("Email")).toBe(screen.getByRole("textbox"));
  });

  it('has data-slot="label" on the rendered element', () => {
    renderWithProvider(<Label htmlFor="name">Name</Label>);
    expect(screen.getByText("Name")).toHaveAttribute("data-slot", "label");
  });

  it("applies custom className", () => {
    renderWithProvider(<Label className="custom-class">Custom</Label>);
    expect(screen.getByText("Custom")).toHaveClass("custom-class");
  });
});
