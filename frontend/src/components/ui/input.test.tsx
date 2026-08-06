import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { createRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { Input } from "./input";

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

afterEach(() => {
  cleanup();
});

describe("Input", () => {
  // Test 1
  it("renders Fluent Input preserving native input attributes", () => {
    renderWithProvider(
      <Input type="email" placeholder="you@example.com" defaultValue="" disabled={false} />,
    );
    const input = screen.getByPlaceholderText("you@example.com");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "email");
    expect(input).not.toBeDisabled();
  });

  // Test 2 (Pitfall 20, MANDATORY)
  it("forwards ref to the actual <input> DOM node, not the wrapper span, and focus() works", () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProvider(<Input ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("INPUT");
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });

  // Test 3
  it('has data-slot="input" on the rendered native input element', () => {
    renderWithProvider(<Input placeholder="slot-test" />);
    const input = screen.getByPlaceholderText("slot-test");
    expect(input).toHaveAttribute("data-slot", "input");
  });

  it("applies custom className", () => {
    renderWithProvider(<Input className="custom-class" placeholder="cls" />);
    expect(screen.getByPlaceholderText("cls")).toHaveClass("custom-class");
  });

  it("respects the disabled attribute", () => {
    renderWithProvider(<Input disabled placeholder="disabled-input" />);
    expect(screen.getByPlaceholderText("disabled-input")).toBeDisabled();
  });

  it("fires onChange with the typed value", () => {
    let observed = "";
    renderWithProvider(
      <Input
        placeholder="change-test"
        onChange={(e) => {
          observed = e.target.value;
        }}
      />,
    );
    const input = screen.getByPlaceholderText("change-test");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(observed).toBe("hello");
  });

  // Regression test (Rule 1 auto-fix): react-hook-form's uncontrolled
  // register() pattern directly mutates fieldRef.current.value via ref on
  // reset()/setValue(), bypassing React state entirely. Fluent's high-level
  // <Input> unconditionally re-asserts its own internally-controlled value
  // (defaulting to '') on every render, silently erasing that direct DOM
  // mutation -- discovered as a real regression in rubric-editor.test.tsx
  // (which uses `<Input {...form.register("name")} />`). This adapter must
  // stay genuinely uncontrolled when neither value nor defaultValue is
  // passed, so react-hook-form's ref-based sync keeps working.
  it("keeps working with react-hook-form's uncontrolled register() + reset() pattern", async () => {
    function Harness() {
      const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
      useEffect(() => {
        form.reset({ name: "Hello World" });
      }, [form]);
      return <Input {...form.register("name")} placeholder="rhf-test" />;
    }
    renderWithProvider(<Harness />);
    const input = (await screen.findByPlaceholderText("rhf-test")) as HTMLInputElement;
    expect(input.value).toBe("Hello World");
  });

  it("still supports defaultValue for uncontrolled usage without react-hook-form", () => {
    renderWithProvider(<Input defaultValue="seeded" placeholder="dv-test" />);
    const input = screen.getByPlaceholderText("dv-test") as HTMLInputElement;
    expect(input.value).toBe("seeded");
  });
});
