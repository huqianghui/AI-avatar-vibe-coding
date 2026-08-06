import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders without crashing", () => {
    render(<Checkbox aria-label="test checkbox" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    // Fluent's Checkbox root slot is the visually-styled wrapper `<span>`;
    // the native `<input>` (the `role="checkbox"` element) is an invisible
    // absolutely-positioned overlay inside it. Fluent's own
    // `getPartitionedNativeProps` routes `className`/`style` to the root
    // slot exclusively (confirmed via source read) -- so layout/spacing
    // classNames from real call sites (e.g. `topic-guide.tsx`'s
    // `className="mt-0.5"`) must land on root to have any visual effect.
    const { container } = render(<Checkbox className="custom-class" aria-label="test" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-class");
  });

  it("renders as checked when checked prop is true", () => {
    render(<Checkbox checked aria-label="test" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("renders as unchecked by default", () => {
    render(<Checkbox aria-label="test" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  // Pitfall 5 (39-CONTEXT.md, PITFALLS.md): Fluent's tri-state string is
  // "mixed", not Radix's "indeterminate" -- this must never leak through the
  // adapter boundary in either direction.
  it("renders indeterminate state with data-state and passes mixed down to Fluent", () => {
    render(<Checkbox checked="indeterminate" aria-label="test" />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox).toHaveAttribute("data-state", "indeterminate");
    // Fluent sets the native DOM `.indeterminate` property (not an
    // aria-checked attribute) when its own `checked` prop is "mixed" --
    // confirmed via source read of useCheckboxBase_unstable.
    expect(checkbox.indeterminate).toBe(true);
  });

  it("fires onCheckedChange with a boolean (not the string mixed/indeterminate) when clicked from indeterminate", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox checked="indeterminate" onCheckedChange={onCheckedChange} aria-label="test" />,
    );
    await userEvent.click(screen.getByRole("checkbox"));
    // Empirically confirmed (Fluent's useCheckboxBase_unstable click-cycle):
    // clicking from "mixed" transitions the native input's `.checked` to
    // true, which the adapter must pass through as the bare boolean `true`,
    // never as the string "mixed" or "indeterminate".
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("fires onCheckedChange(true) when clicked from unchecked, passing booleans through unshimmed", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onCheckedChange} aria-label="test" />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
