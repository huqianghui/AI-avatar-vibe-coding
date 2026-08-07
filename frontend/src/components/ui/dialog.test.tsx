import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog", () => {
  it("renders an element with role='dialog' when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("wires aria-labelledby on the dialog surface to the DialogTitle element's id", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    const title = screen.getByText("My Title");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(title.id).toBe(labelledBy);
    expect(title).toBeVisible();
  });

  it("wires aria-describedby on the dialog surface to the DialogDescription element's id when present", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
          <DialogDescription>My Description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    const description = screen.getByText("My Description");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(description.id).toBe(describedBy);
    expect(description).toBeVisible();
  });

  it("closes the dialog when the close (X) button is clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const closeButton = screen.getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("preserves data-slot on Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription", () => {
    render(
      <Dialog open>
        <DialogTrigger>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My Title</DialogTitle>
            <DialogDescription>My Description</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button">Cancel</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "dialog-content");
    expect(screen.getByText("My Title")).toHaveAttribute("data-slot", "dialog-title");
    expect(screen.getByText("My Description")).toHaveAttribute(
      "data-slot",
      "dialog-description",
    );
    const header = screen.getByText("My Title").closest('[data-slot="dialog-header"]');
    expect(header).not.toBeNull();
    const footer = screen.getByText("Cancel").closest('[data-slot="dialog-footer"]');
    expect(footer).not.toBeNull();
  });

  it("includes consumer className passed to DialogContent in the rendered surface's class list", () => {
    render(
      <Dialog open>
        <DialogContent className="my-custom-class">
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog").className).toContain("my-custom-class");
  });
});
