import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

function renderWithProvider(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Tabs", () => {
  // Test 1
  it("renders active tab content but not inactive tab content text visibly", () => {
    renderWithProvider(
      <Tabs value="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">ContentA</TabsContent>
        <TabsContent value="b">ContentB</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("ContentA")).toBeVisible();
    // ContentB is still in the DOM (render-both + hidden-toggle contract) but
    // must not be visible/accessible via the default (non-hidden) query.
    expect(screen.queryByText("ContentB")).not.toBeVisible();
  });

  // Test 2
  it("sets data-state=active on the active trigger and data-state=inactive on the inactive trigger", () => {
    renderWithProvider(
      <Tabs value="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">ContentA</TabsContent>
        <TabsContent value="b">ContentB</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("data-state", "inactive");
  });

  // Test 3
  it("sets data-state=active on the rendered active tabpanel", () => {
    renderWithProvider(
      <Tabs value="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">ContentA</TabsContent>
        <TabsContent value="b">ContentB</TabsContent>
      </Tabs>,
    );

    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    const activePanel = panels.find((panel) => panel.textContent === "ContentA");
    expect(activePanel).toHaveAttribute("data-state", "active");
    const inactivePanel = panels.find((panel) => panel.textContent === "ContentB");
    expect(inactivePanel).toHaveAttribute("data-state", "inactive");
  });

  // Test 4
  it("calls onValueChange with the newly selected tab's value when clicked", () => {
    const handleValueChange = vi.fn();
    renderWithProvider(
      <Tabs value="a" onValueChange={handleValueChange}>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">ContentA</TabsContent>
        <TabsContent value="b">ContentB</TabsContent>
      </Tabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(handleValueChange).toHaveBeenCalledWith("b");
  });

  // Test 5
  it("supports uncontrolled usage via defaultValue without throwing and switches tabs internally", () => {
    renderWithProvider(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">ContentA</TabsContent>
        <TabsContent value="b">ContentB</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("ContentA")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByText("ContentB")).toBeVisible();
  });
});
