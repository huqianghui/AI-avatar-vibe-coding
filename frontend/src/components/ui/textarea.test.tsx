import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { createRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { Textarea } from "./textarea";

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

afterEach(() => {
  cleanup();
});

describe("Textarea", () => {
  it("renders Fluent Textarea preserving native textarea attributes", () => {
    renderWithProvider(
      <Textarea placeholder="describe here" disabled={false} rows={4} />,
    );
    const textarea = screen.getByPlaceholderText("describe here");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("rows", "4");
    expect(textarea).not.toBeDisabled();
  });

  // Test 2 (Pitfall 20, MANDATORY)
  it("forwards ref to the actual <textarea> DOM node, not the wrapper span, and focus() works", () => {
    const ref = createRef<HTMLTextAreaElement>();
    renderWithProvider(<Textarea ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("TEXTAREA");
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });

  it('has data-slot="textarea" on the rendered native textarea element', () => {
    renderWithProvider(<Textarea placeholder="slot-test" />);
    const textarea = screen.getByPlaceholderText("slot-test");
    expect(textarea).toHaveAttribute("data-slot", "textarea");
  });

  it("applies custom className", () => {
    renderWithProvider(<Textarea className="custom-class" placeholder="cls" />);
    expect(screen.getByPlaceholderText("cls")).toHaveClass("custom-class");
  });

  it("respects the disabled attribute", () => {
    renderWithProvider(<Textarea disabled placeholder="disabled-textarea" />);
    expect(screen.getByPlaceholderText("disabled-textarea")).toBeDisabled();
  });

  it("fires onChange with the typed value", () => {
    let observed = "";
    renderWithProvider(
      <Textarea
        placeholder="change-test"
        onChange={(e) => {
          observed = e.target.value;
        }}
      />,
    );
    const textarea = screen.getByPlaceholderText("change-test");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(observed).toBe("hello world");
  });

  // Regression test (Rule 1 auto-fix, same mechanism as input.tsx): keep
  // working with react-hook-form's uncontrolled register() + reset()
  // pattern (real call site: rubric-editor.tsx's
  // `<Textarea rows={2} {...form.register("description")} />`).
  it("keeps working with react-hook-form's uncontrolled register() + reset() pattern", async () => {
    function Harness() {
      const form = useForm<{ description: string }>({
        defaultValues: { description: "" },
      });
      useEffect(() => {
        form.reset({ description: "Hello World" });
      }, [form]);
      return <Textarea {...form.register("description")} placeholder="rhf-test" />;
    }
    renderWithProvider(<Harness />);
    const textarea = (await screen.findByPlaceholderText(
      "rhf-test",
    )) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Hello World");
  });

  it("still supports defaultValue for uncontrolled usage without react-hook-form", () => {
    renderWithProvider(<Textarea defaultValue="seeded" placeholder="dv-test" />);
    const textarea = screen.getByPlaceholderText("dv-test") as HTMLTextAreaElement;
    expect(textarea.value).toBe("seeded");
  });
});
