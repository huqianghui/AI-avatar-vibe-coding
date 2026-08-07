import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "./card";

describe("Card", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<Card>Card content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveAttribute("data-slot", "card");
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom-card">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("custom-card");
  });

  it("merges the Griffel token class with the consumer className", () => {
    const { container } = render(<Card className="custom-card">Content</Card>);
    const card = container.firstChild as HTMLElement;
    // Griffel's makeStyles generates atomic classnames matching either the
    // scoped-hash pattern (`___<hash>_<hash>`) or the short-hash atomic
    // pattern (`f<hash>`) -- neither of which Tailwind or a consumer
    // className would ever produce. Assert both the Griffel-generated
    // token class(es) and the consumer-supplied className are present on
    // the rendered element (mergeClasses() coalesces all atomic/sequenced
    // classes together internally regardless of call-order, so exact
    // positional ordering is an implementation detail of `mergeClasses`
    // itself, not something adapter code controls -- presence, not
    // position, is the meaningful contract here).
    const classList = card.className.split(" ");
    const griffelClasses = classList.filter((cls) => /^(___[\w-]+|f[a-z0-9]{5,})$/.test(cls));
    expect(griffelClasses.length).toBeGreaterThan(0);
    expect(classList).toContain("custom-card");

    // Confirm one of the Griffel classes resolves, via the actual injected
    // stylesheet rule, to the Fluent design token this plan wires up
    // (`tokens.colorNeutralBackground1`), matching the CSSOM-verification
    // pattern established in button.test.tsx's destructive-override test.
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
          griffelClasses.some((cls) => rule.selectorText === `.${cls}`) &&
          rule.cssText.includes("background-color: var(--colorNeutralBackground1)"),
      );
    expect(matchingRule).toBeDefined();
  });

  it("renders as a plain div element, not a Fluent Card component instance", () => {
    const { container } = render(<Card>Card content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.tagName).toBe("DIV");
    // Fluent's real Card component renders a "fui-Card" root class; Option B
    // must never introduce it.
    expect(card.className).not.toContain("fui-Card");
  });
});

describe("CardHeader", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-header");
  });
});

describe("CardTitle", () => {
  it("renders heading text", () => {
    render(<CardTitle>My Title</CardTitle>);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });
});

describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>My description</CardDescription>);
    expect(screen.getByText("My description")).toBeInTheDocument();
  });
});

describe("CardContent", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardContent>Body</CardContent>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-content");
  });
});

describe("CardFooter", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-footer");
  });
});

describe("CardAction", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardAction>Action</CardAction>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-action");
  });
});
