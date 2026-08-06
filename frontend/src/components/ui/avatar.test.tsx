import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

describe("Avatar", () => {
  it("renders the image when an AvatarImage child with a src is present", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/a.jpg" alt="Ann" />
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>,
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/a.jpg");
    expect(img).toHaveAttribute("alt", "Ann");
  });

  it("renders initials and no image element when there is no AvatarImage child", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("AN");
  });

  // Pitfall 21 (mandatory): jsdom does not naturally fire `error` events on
  // <img> when a src 404s -- Radix auto-swaps to fallback on a broken image,
  // and this adapter must re-implement that behavior manually via onError.
  // Simulate it explicitly rather than relying on jsdom's (non-existent)
  // default image-load-failure behavior.
  it("falls back to initials when the image fires an error event (broken src)", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/broken.jpg" alt="Test" />
        <AvatarFallback>TB</AvatarFallback>
      </Avatar>,
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();

    fireEvent.error(img!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("TB");
  });

  it("preserves data-slot on the rendered root", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("data-slot", "avatar");
  });

  it("appends consumer className onto the rendered root", () => {
    const { container } = render(
      <Avatar className="custom-class">
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-class");
  });
});
