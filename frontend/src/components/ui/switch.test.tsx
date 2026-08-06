import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders without crashing and reflects checked prop", () => {
    render(<Switch checked aria-label="test switch" />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeInTheDocument();
    expect(switchEl).toBeChecked();
  });

  it("renders as unchecked when checked is false", () => {
    render(<Switch checked={false} aria-label="test switch" />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).not.toBeChecked();
  });

  // Pitfall 5 (39-CONTEXT.md, PITFALLS.md): confirm the adapter boundary
  // stays clean -- Switch has no tri-state concept in either Radix or
  // Fluent, so onCheckedChange must only ever receive a bare boolean, never
  // a "mixed"/"indeterminate" string (which would indicate an accidental
  // copy-paste of Checkbox's shim onto Switch).
  it("fires onCheckedChange(true) when clicked while unchecked", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="test switch" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("fires onCheckedChange(false) when clicked while checked", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked onCheckedChange={onCheckedChange} aria-label="test switch" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("has data-slot attribute preserved on the native input", () => {
    render(<Switch checked aria-label="test switch" />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("data-slot", "switch");
  });

  it("applies custom className to the root", () => {
    const { container } = render(<Switch className="custom-class" aria-label="test switch" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-class");
  });
});
