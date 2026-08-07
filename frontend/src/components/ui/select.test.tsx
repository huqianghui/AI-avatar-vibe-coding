import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

function renderSelect(props: {
  value?: string;
  onValueChange?: (v: string) => void;
  triggerSize?: "sm" | "default";
}) {
  return render(
    <FluentProvider theme={webLightTheme}>
      <Select value={props.value} onValueChange={props.onValueChange}>
        <SelectTrigger size={props.triggerSize} aria-label="fruit">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>
    </FluentProvider>,
  );
}

describe("Select (Fluent adapter)", () => {
  it("Test 1: renders the selected value's display text in the trigger", () => {
    renderSelect({ value: "b" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Beta");
  });

  it("Test 2: opens a listbox with option roles and correct accessible names", () => {
    renderSelect({ value: "a" });
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Alpha", "Beta"]);
  });

  it("Test 3: selecting an option calls onValueChange with the value prop (not display text)", () => {
    const onValueChange = vi.fn();
    renderSelect({ value: "b", onValueChange });
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Alpha" }));
    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("Test 4: data-slot attributes are present on the composed parts", () => {
    renderSelect({ value: "a" });
    // `select` wrapper + `select-trigger` (Fluent button) are present while closed.
    expect(document.querySelector('[data-slot="select"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="select-trigger"]')).toBeInTheDocument();
    // Fluent renders the listbox (content + items) in a portal once opened.
    fireEvent.click(screen.getByRole("combobox"));
    expect(document.querySelector('[data-slot="select-content"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="select-item"]')).toBeInTheDocument();
  });

  it("Test 5: SelectTrigger size='sm' produces data-size='sm'", () => {
    const { container } = renderSelect({ value: "a", triggerSize: "sm" });
    expect(
      container.querySelector('[data-slot="select-trigger"]')?.getAttribute("data-size"),
    ).toBe("sm");
  });

  it("Test 6: scroll buttons render without throwing (no-op)", () => {
    expect(() =>
      render(
        <FluentProvider theme={webLightTheme}>
          <SelectScrollUpButton />
          <SelectScrollDownButton />
        </FluentProvider>,
      ),
    ).not.toThrow();
  });

  it("Test 7: react-hook-form Controller-style onChange receives the plain string value", () => {
    const fieldOnChange = vi.fn();
    renderSelect({ value: "a", onValueChange: fieldOnChange });
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(fieldOnChange).toHaveBeenCalledWith("b");
    expect(typeof fieldOnChange.mock.calls[0]?.[0]).toBe("string");
  });

  it("Test 8: uncontrolled Select tracks selection via defaultValue + internal state", () => {
    render(
      <FluentProvider theme={webLightTheme}>
        <Select defaultValue="a">
          <SelectTrigger aria-label="fruit">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b">Beta</SelectItem>
          </SelectContent>
        </Select>
      </FluentProvider>,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Alpha");
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    // Uncontrolled: internal state updates the trigger display without a value prop.
    expect(screen.getByRole("combobox")).toHaveTextContent("Beta");
  });

  it("Test 9: derives display text from nested element children (not just string)", () => {
    render(
      <FluentProvider theme={webLightTheme}>
        <Select value="a">
          <SelectTrigger aria-label="fruit">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">
              <span>Alpha</span> <span>Fruit</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </FluentProvider>,
    );
    // textContent() must walk arrays + nested elements to compose "Alpha Fruit".
    expect(screen.getByRole("combobox")).toHaveTextContent("Alpha Fruit");
  });

  it("Test 10: SelectGroup, SelectLabel and SelectSeparator render with their data-slots", () => {
    const { container } = render(
      <FluentProvider theme={webLightTheme}>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectSeparator />
        </SelectGroup>
      </FluentProvider>,
    );
    expect(container.querySelector('[data-slot="select-group"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="select-label"]')).toHaveTextContent("Fruits");
    expect(container.querySelector('[data-slot="select-separator"]')).toBeInTheDocument();
  });
});
