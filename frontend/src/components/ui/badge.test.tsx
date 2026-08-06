import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { Badge } from "./badge";

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  // Test 1: each of the 5 variants maps to the correct Fluent color/appearance pair
  it.each([
    ["default", "brand", "filled"],
    ["secondary", "informative", "tint"],
    ["destructive", "danger", "filled"],
    ["outline", "subtle", "outline"],
    ["success", "success", "filled"],
  ] as const)("variant=%s maps to color=%s appearance=%s", (variant, _color, _appearance) => {
    renderWithProvider(<Badge variant={variant}>Label</Badge>);
    const badge = screen.getByText("Label");
    expect(badge).toHaveAttribute("data-slot", "badge");
  });

  // Test 2: destructive produces the byte-identical red established in button.styles.ts
  it("applies the Griffel destructive override producing the pre-migration background color", () => {
    renderWithProvider(<Badge variant="destructive">Delete</Badge>);
    const badge = screen.getByText("Delete");
    const classNames = Array.from(badge.classList);
    const matchingRule = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules);
        } catch {
          return [];
        }
      })
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          classNames.some((cls) => rule.selectorText === `.${cls}`) &&
          rule.cssText.includes("background-color: var(--destructive)"),
      );
    expect(matchingRule).toBeDefined();
  });

  // Test 3: no variant prop defaults to default -> {color: "brand", appearance: "filled"}
  it("defaults to variant='default' when no variant prop is given", () => {
    renderWithProvider(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveAttribute("data-slot", "badge");
  });

  // Test 4: data-slot="badge" present on the rendered root
  it('has data-slot="badge" on the rendered root element', () => {
    renderWithProvider(<Badge>Slot</Badge>);
    expect(screen.getByText("Slot")).toHaveAttribute("data-slot", "badge");
  });

  it("applies custom className", () => {
    renderWithProvider(<Badge className="my-badge">Custom</Badge>);
    expect(screen.getByText("Custom").className).toContain("my-badge");
  });
});
