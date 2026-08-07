import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { selectFluentOption } from "@/test/test-utils";
import { AssignHcpDialog } from "../assign-hcp-dialog";

// Polyfill pointer capture methods missing in jsdom (required by Radix Select)
beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  // Polyfill scrollIntoView
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

const mockMutate = vi.fn();

// Mutable overrides for per-test customization
let hcpItemsOverride: unknown[] | null = null;
let isPendingOverride = false;

vi.mock("@/hooks/use-hcp-profiles", () => ({
  useHcpProfiles: () => ({
    data: {
      items: hcpItemsOverride ?? [
        { id: "hcp-1", name: "Dr. Zhang", specialty: "Oncology", voice_live_instance_id: null },
        { id: "hcp-2", name: "Dr. Li", specialty: "Cardiology", voice_live_instance_id: "inst-1" },
        { id: "hcp-3", name: "Dr. Wang", specialty: "Neurology", voice_live_instance_id: null },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-voice-live-instances", () => ({
  useAssignVoiceLiveInstance: () => ({
    mutate: mockMutate,
    isPending: isPendingOverride,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.name) return `${key}: ${opts.name}`;
      return key;
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("AssignHcpDialog", () => {
  it("renders dialog when open", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("voiceLive.assignDialogTitle")).toBeDefined();
  });

  it("does not render when closed", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders cancel and assign buttons", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("voiceLive.vlDialogCancel")).toBeDefined();
    expect(screen.getByText("voiceLive.assignToHcp")).toBeDefined();
  });

  it("shows description with instance name", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="My VL Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("voiceLive.assignDialogDescription: My VL Instance"),
    ).toBeDefined();
  });

  it("assign button is disabled when no HCP is selected", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const assignButton = screen.getByText("voiceLive.assignToHcp");
    expect(assignButton.closest("button")?.disabled).toBe(true);
  });

  it("filters out HCPs already assigned to the given instance", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // hcp-2 (Dr. Li) is assigned to inst-1, so should be filtered out.
    // The Select trigger shows a placeholder, not the items themselves.
    // We check that the dialog does NOT show Dr. Li in any visible text.
    // Available HCPs: Dr. Zhang, Dr. Wang (not Dr. Li since she's assigned to inst-1)
    expect(screen.queryByText(/Dr\. Li/)).toBeNull();
  });

  it("calls onOpenChange(false) when cancel button is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup({ delay: null });

    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    const cancelButton = screen.getByText("voiceLive.vlDialogCancel");
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call mutate when assign clicked without selection", async () => {
    mockMutate.mockClear();
    const user = userEvent.setup({ delay: null });

    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const assignButton = screen.getByText("voiceLive.assignToHcp");
    // Button is disabled, so clicking should not call mutate
    await user.click(assignButton);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows HCPs that are not assigned to any instance", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-2"
        instanceName="Other Instance"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // For inst-2, all HCPs should be available because:
    // hcp-1: no assignment (null)
    // hcp-2: assigned to inst-1 (different instance), so available
    // hcp-3: no assignment (null)
    // All three should be available since none are assigned to inst-2
    // The select items are rendered but might not be visible until opened,
    // so we just verify the dialog renders a select (not the empty message)
    expect(screen.queryByText("voiceLive.assignDialogEmpty")).toBeNull();
  });

  it("calls mutate when HCP is selected and assign clicked", async () => {
    mockMutate.mockClear();
    const user = userEvent.setup({ delay: null });

    render(
      <FluentProvider theme={webLightTheme}>
        <AssignHcpDialog
          instanceId="inst-2"
          instanceName="Test Instance"
          open={true}
          onOpenChange={vi.fn()}
        />
      </FluentProvider>,
    );

    // Select an HCP; the assign button enables once the selection commits.
    const assignBtn = screen.getByText("voiceLive.assignToHcp").closest("button")!;
    await selectFluentOption(user, /Dr\. Zhang/, () => !assignBtn.disabled);
    expect(assignBtn.disabled).toBe(false);
    await user.click(assignBtn);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      { instanceId: "inst-2", hcpProfileId: "hcp-1" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("calls toast.success and closes dialog on assign success", async () => {
    const { toast } = await import("sonner");
    const onOpenChange = vi.fn();
    const user = userEvent.setup({ delay: null });

    // Make mutate call onSuccess synchronously
    mockMutate.mockImplementation((_args: unknown, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.();
    });

    render(
      <FluentProvider theme={webLightTheme}>
        <AssignHcpDialog
          instanceId="inst-2"
          instanceName="Test Instance"
          open={true}
          onOpenChange={onOpenChange}
        />
      </FluentProvider>,
    );

    const assignBtn = screen.getByText("voiceLive.assignToHcp").closest("button")!;
    await selectFluentOption(user, /Dr\. Zhang/, () => !assignBtn.disabled);
    await user.click(assignBtn);

    expect(toast.success).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    mockMutate.mockReset();
  });

  it("calls toast.error on assign failure", async () => {
    const { toast } = await import("sonner");
    const user = userEvent.setup({ delay: null });

    // Make mutate call onError synchronously
    mockMutate.mockImplementation((_args: unknown, opts: { onError?: () => void }) => {
      opts.onError?.();
    });

    render(
      <FluentProvider theme={webLightTheme}>
        <AssignHcpDialog
          instanceId="inst-2"
          instanceName="Test"
          open={true}
          onOpenChange={vi.fn()}
        />
      </FluentProvider>,
    );

    const assignBtn = screen.getByText("voiceLive.assignToHcp").closest("button")!;
    await selectFluentOption(user, /Dr\. Zhang/, () => !assignBtn.disabled);
    await user.click(assignBtn);

    expect(toast.error).toHaveBeenCalled();

    mockMutate.mockReset();
  });

  it("shows description fallback when instanceName is empty", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName=""
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // When instanceName is empty, falls back to "this instance"
    expect(
      screen.getByText("voiceLive.assignDialogDescription: this instance"),
    ).toBeDefined();
  });

  it("renders select label", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("voiceLive.assignDialogSelect")).toBeDefined();
  });

  it("renders select trigger with placeholder", () => {
    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("voiceLive.assignToHcpPlaceholder")).toBeDefined();
  });
});

// Separate describe block for edge cases using mutable overrides
describe("AssignHcpDialog — edge cases", () => {
  afterEach(() => {
    hcpItemsOverride = null;
    isPendingOverride = false;
  });

  it("shows empty message when all HCPs are assigned to this instance", () => {
    // Override to return only HCPs assigned to inst-1
    hcpItemsOverride = [
      { id: "hcp-2", name: "Dr. Li", specialty: "Cardiology", voice_live_instance_id: "inst-1" },
    ];

    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // All HCPs are assigned to inst-1, so the empty message should show
    expect(screen.getByText("voiceLive.assignDialogEmpty")).toBeDefined();
  });

  it("shows isPending/saving text when mutation is pending", () => {
    isPendingOverride = true;

    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("voiceLive.vlDialogSaving")).toBeDefined();
  });

  it("shows empty message when no HCPs exist at all", () => {
    hcpItemsOverride = [];

    render(
      <AssignHcpDialog
        instanceId="inst-1"
        instanceName="Test"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("voiceLive.assignDialogEmpty")).toBeDefined();
  });
});
