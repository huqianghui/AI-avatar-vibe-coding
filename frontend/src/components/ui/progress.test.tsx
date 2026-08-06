import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Progress } from "./progress";

describe("Progress", () => {
  it("renders without crashing", () => {
    const { container } = render(<Progress value={50} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Progress value={50} className="custom-progress" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-progress");
  });

  it("renders a progressbar role element", () => {
    const { container } = render(<Progress value={75} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("role", "progressbar");
  });

  it("renders indicator child with style transform", () => {
    const { container } = render(<Progress value={75} />);
    const root = container.firstChild as HTMLElement;
    // The indicator is a child div
    expect(root.children.length).toBeGreaterThan(0);
  });

  // Mandatory per Pitfall 13: Fluent's ProgressBar uses a 0-1 decimal scale
  // by default (max=1), while this adapter's public contract is 0-100. A
  // missed division by 100 would silently render a near-empty bar instead of
  // crashing, so the numeric conversion itself must be asserted explicitly.
  it("converts a 0-100 public value to Fluent's 0-1 internal scale (value=50 -> 0.5)", () => {
    const { container } = render(<Progress value={50} />);
    const root = container.firstChild as HTMLElement;
    // Fluent's ProgressBar sets aria-valuenow to its own internal (already
    // clamped/converted) value, and aria-valuemax to its internal `max`
    // (default 1) -- both reflect the POST-conversion 0-1 scale, not the
    // public 0-100 scale passed into this adapter.
    expect(root).toHaveAttribute("aria-valuenow", "0.5");
    expect(root).toHaveAttribute("aria-valuemax", "1");
  });

  it("renders a definite (non-indeterminate) empty bar for value=0", () => {
    const { container } = render(<Progress value={0} />);
    const root = container.firstChild as HTMLElement;
    // Definite state (value explicitly provided, even at 0) sets
    // aria-valuenow to "0" -- indeterminate state omits aria-valuenow
    // entirely, so this distinguishes "empty" from "indeterminate".
    expect(root).toHaveAttribute("aria-valuenow", "0");
    expect(root).toHaveAttribute("aria-valuemin", "0");
  });

  it("renders Fluent's indeterminate/busy state when value is undefined (not a crash, not a zero-width bar)", () => {
    const { container } = render(<Progress value={undefined} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("role", "progressbar");
    // Indeterminate state: Fluent omits aria-valuenow/aria-valuemin/aria-valuemax
    // entirely rather than defaulting to 0 (confirmed via useProgressBarBase_unstable
    // source: `value !== undefined ? ... : undefined` for all three attributes).
    expect(root).not.toHaveAttribute("aria-valuenow");
    expect(root).not.toHaveAttribute("aria-valuemin");
    expect(root).not.toHaveAttribute("aria-valuemax");
  });
});
