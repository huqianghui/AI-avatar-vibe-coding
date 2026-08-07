import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "./form";
import { Input } from "./input";

afterEach(() => {
  cleanup();
});

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

type FormValues = { name: string };

function Harness({
  defaultValues,
  errorMessage,
  showDescription = false,
}: {
  defaultValues: FormValues;
  errorMessage?: string;
  showDescription?: boolean;
}) {
  const form = useForm<FormValues>({ defaultValues });

  if (errorMessage) {
    // Simulate a field-level validation error via react-hook-form's own
    // setError API (matches how real consumers surface server/validation
    // errors -- e.g. hcp-editor.tsx's form.setError usage).
    form.setError("name", { type: "manual", message: errorMessage });
  }

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            {showDescription && (
              <FormDescription>Enter your full name</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("Form", () => {
  // Test 1
  it("renders label text and an input whose id matches the label's htmlFor", () => {
    renderWithProvider(<Harness defaultValues={{ name: "" }} />);

    const label = screen.getByText("Name");
    const input = screen.getByRole("textbox");

    expect(label).toBeInTheDocument();
    expect(input).toBeInTheDocument();
    expect(label).toHaveAttribute("for", input.id);
    expect(input.id).toBe(label.getAttribute("for"));
  });

  // Test 2
  it("renders FormMessage error text and sets aria-invalid + aria-describedby on the input when the field has an error", () => {
    renderWithProvider(
      <Harness defaultValues={{ name: "" }} errorMessage="Name is required" />,
    );

    const input = screen.getByRole("textbox");
    const message = screen.getByText("Name is required");

    expect(message).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
  });

  // Test 3
  it("renders FormDescription text and includes its id in aria-describedby alongside the message id when both are present", () => {
    renderWithProvider(
      <Harness
        defaultValues={{ name: "" }}
        errorMessage="Name is required"
        showDescription
      />,
    );

    const input = screen.getByRole("textbox");
    const description = screen.getByText("Enter your full name");
    const message = screen.getByText("Name is required");

    expect(description).toBeInTheDocument();
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain(description.id);
    expect(describedBy).toContain(message.id);
  });

  // Test 3b: description-only (no error) still wires up aria-describedby
  it("includes only the description id in aria-describedby when there is no error", () => {
    renderWithProvider(
      <Harness defaultValues={{ name: "" }} showDescription />,
    );

    const input = screen.getByRole("textbox");
    const description = screen.getByText("Enter your full name");

    expect(input.getAttribute("aria-describedby")).toBe(description.id);
  });

  // Test 4
  it("does not add an extra wrapper DOM element around the child input (FormControl clones, does not wrap)", () => {
    renderWithProvider(<Harness defaultValues={{ name: "" }} />);

    // Exactly one textbox is rendered, and FormControl's merged id/
    // aria-invalid/aria-describedby land directly on that <input> element
    // itself -- proof that FormControl cloned props onto its child (Radix
    // Slot's original contract) rather than wrapping it in a new element
    // (Input's own Fluent adapter renders its own internal <span> wrapper
    // around the native <input>, but that wrapper is Input's pre-existing
    // structure, not something FormControl introduced).
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
    const input = inputs[0] as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("id");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).toHaveAttribute("aria-describedby");
  });

  // Test 5
  it("useFormField throws when used outside a FormField/FormProvider context", () => {
    // FormLabel internally calls useFormField(); rendering it with no
    // surrounding <Form>/<FormField> reproduces the original Slot-based
    // component's behavior of relying on react-hook-form's context and
    // failing loudly rather than silently rendering broken markup.
    expect(() =>
      renderWithProvider(<FormLabel>Orphan Label</FormLabel>),
    ).toThrow();
  });
});
