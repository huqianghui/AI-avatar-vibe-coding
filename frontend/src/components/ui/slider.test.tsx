import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Slider } from "./slider";

describe("Slider", () => {
  it("renders without crashing", () => {
    const { container } = render(<Slider value={[50]} min={0} max={100} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders Fluent Slider with scalar value derived from the public array contract", () => {
    const { container } = render(<Slider value={[50]} min={0} max={100} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("50");
  });

  it("fires onValueChange with an array-wrapped value on a native change event (bidirectional shim)", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider value={[50]} min={0} max={100} onValueChange={onValueChange} />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "75" } });
    expect(onValueChange).toHaveBeenCalledWith([75]);
  });

  it("preserves data-slot", () => {
    // Fluent's Slider routes all top-level native props except
    // `className`/`style` to its PRIMARY slot (the native `<input
    // type="range">`, the `role="slider"` element), not the root `<div>`
    // wrapper -- confirmed via probe render (getPartitionedNativeProps'
    // documented primarySlotTagName: 'input' behavior), mirroring
    // checkbox.tsx's/switch.tsx's analogous root-vs-input slot distinction.
    const { container } = render(<Slider value={[50]} min={0} max={100} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).toHaveAttribute("data-slot", "slider");
  });

  it("applies custom className to the root element", () => {
    const { container } = render(
      <Slider value={[50]} min={0} max={100} className="custom-slider" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-slider");
  });
});
