import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";
import { Button } from "./button";

function withProvider(ui: React.ReactElement) {
  return <FluentProvider theme={webLightTheme}>{ui}</FluentProvider>;
}

describe("DropdownMenu", () => {
  it("renders trigger button", () => {
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );
    expect(screen.getByText("Open Menu")).toBeInTheDocument();
  });

  it("shows menu items when trigger is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Action A</DropdownMenuItem>
            <DropdownMenuItem>Action B</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    await user.click(screen.getByText("Open Menu"));

    expect(await screen.findByText("Action A")).toBeInTheDocument();
    expect(screen.getByText("Action B")).toBeInTheDocument();
  });

  it("renders label and separator inside menu", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    await user.click(screen.getByText("Open"));

    expect(await screen.findByText("My Account")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders shortcut text inside menu items", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Save
              <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    await user.click(screen.getByText("Open"));

    expect(await screen.findByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+S")).toBeInTheDocument();
  });

  it("renders menu group with multiple items", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem>Item 1</DropdownMenuItem>
              <DropdownMenuItem>Item 2</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    await user.click(screen.getByText("Open"));

    expect(await screen.findByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("renders checkbox item", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={true}>
              Show Toolbar
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    await user.click(screen.getByText("Open"));

    expect(await screen.findByText("Show Toolbar")).toBeInTheDocument();
  });

  it("applies data-slot attributes for styling hooks", () => {
    const { container } = render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Action</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    const trigger = container.querySelector(
      "[data-slot='dropdown-menu-trigger']",
    );
    expect(trigger).toBeInTheDocument();
  });

  // --- Phase 40-07 new coverage -------------------------------------------

  it("Test 8: two checkbox items reflect independent checked states via the lifted dict", async () => {
    const user = userEvent.setup({ delay: null });

    function Harness() {
      const [a, setA] = React.useState(true);
      const [b, setB] = React.useState(false);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              name="cols"
              value="a"
              checked={a}
              onCheckedChange={setA}
            >
              Column A
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              name="cols"
              value="b"
              checked={b}
              onCheckedChange={setB}
            >
              Column B
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    render(withProvider(<Harness />));
    await user.click(screen.getByText("Open"));

    const itemA = await screen.findByRole("menuitemcheckbox", {
      name: "Column A",
    });
    const itemB = screen.getByRole("menuitemcheckbox", { name: "Column B" });
    expect(itemA).toHaveAttribute("aria-checked", "true");
    expect(itemB).toHaveAttribute("aria-checked", "false");

    // Toggle B on; A must stay checked (independent membership in the dict).
    await user.click(itemB);
    await waitFor(() =>
      expect(
        screen.getByRole("menuitemcheckbox", { name: "Column B" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Column A" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("Test 9: radio group enforces mutual exclusivity via the dict model", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();

    function Harness() {
      const [value, setValue] = React.useState("one");
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(v) => {
                onValueChange(v);
                setValue(v);
              }}
            >
              <DropdownMenuRadioItem value="one">One</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="two">Two</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="three">
                Three
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    render(withProvider(<Harness />));
    await user.click(screen.getByText("Open"));

    const one = await screen.findByRole("menuitemradio", { name: "One" });
    expect(one).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "Two" }));
    expect(onValueChange).toHaveBeenCalledWith("two");

    // Fluent dismisses the menu on radio selection (a final choice). Reopen it
    // and confirm the new selection persisted with mutual exclusivity — the
    // dict model, not per-item local state, decides who is checked.
    await user.click(screen.getByText("Open"));
    await waitFor(() =>
      expect(
        screen.getByRole("menuitemradio", { name: "Two" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
    expect(screen.getByRole("menuitemradio", { name: "One" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("Test 10: submenu reveals sub-items when opened", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Top Item</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Sub Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    await user.click(screen.getByText("Open"));
    const subTrigger = await screen.findByText("More");
    await user.click(subTrigger);
    expect(await screen.findByText("Sub Item")).toBeInTheDocument();
  });

  it("Test 11: DropdownMenuTrigger forwards its ref to the DOM element", () => {
    const ref = React.createRef<HTMLElement>();
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger ref={ref}>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toHaveAttribute("data-slot", "dropdown-menu-trigger");
  });

  it("Test 12: nested asChild Button (theme-picker pattern) renders one clickable element with no collision", async () => {
    const user = userEvent.setup({ delay: null });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      withProvider(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="theme">
              Icon
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Light</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    );

    // Exactly one trigger element carrying the data-slot (no duplicate clone).
    const triggers = document.querySelectorAll(
      "[data-slot='dropdown-menu-trigger']",
    );
    expect(triggers).toHaveLength(1);

    const trigger = screen.getByRole("button", { name: "theme" });
    await user.click(trigger);
    expect(await screen.findByText("Light")).toBeInTheDocument();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
