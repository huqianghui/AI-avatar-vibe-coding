import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";

describe("Sheet", () => {
  it("renders trigger button", () => {
    render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
      </Sheet>,
    );
    expect(screen.getByText("Open Sheet")).toBeInTheDocument();
  });

  it("renders SheetHeader with custom className", () => {
    const { container } = render(
      <SheetHeader className="test-header">Header content</SheetHeader>,
    );
    const header = container.firstChild as HTMLElement;
    expect(header.className).toContain("test-header");
    expect(header).toHaveAttribute("data-slot", "sheet-header");
  });

  it("renders SheetFooter with custom className", () => {
    const { container } = render(
      <SheetFooter className="test-footer">Footer content</SheetFooter>,
    );
    const footer = container.firstChild as HTMLElement;
    expect(footer.className).toContain("test-footer");
    expect(footer).toHaveAttribute("data-slot", "sheet-footer");
  });

  it("renders SheetTitle and SheetDescription", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>My Title</SheetTitle>
          <SheetDescription>My Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My Description")).toBeInTheDocument();
  });

  it("renders content with side='bottom' via OverlayDrawer position='bottom'", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom" className="h-[70vh] overflow-hidden">
          Bottom sheet content
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Bottom sheet content")).toBeInTheDocument();
    // OverlayDrawer renders via a portal (outside the render container), so
    // query document.body directly for the sheet-content slot.
    const content = document.body.querySelector('[data-slot="sheet-content"]');
    expect(content).not.toBeNull();
    // Fluent's OverlayDrawer forwards position="bottom" as its own
    // fui-OverlayDrawer class token rather than a raw DOM attribute --
    // assert the element rendered and carries our merged className.
    expect(content?.className).toContain("h-[70vh]");
  });

  it("triggers open behavior when asChild wraps a plain button (avatar-page.tsx usage shape)", () => {
    const handleOpenChange = vi.fn();
    render(
      <Sheet open={false} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <button type="button">Open Sources</button>
        </SheetTrigger>
      </Sheet>,
    );
    const trigger = screen.getByText("Open Sources");
    expect(trigger).toHaveAttribute("data-slot", "sheet-trigger");
    fireEvent.click(trigger);
    expect(handleOpenChange).toHaveBeenCalledWith(true);
  });
});
