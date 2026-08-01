import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { SourcesPanel } from "./sources-panel";
import { AvatarInputBar } from "./avatar-input-bar";
import { MicPermissionDialog } from "./mic-permission-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
      if (opts) {
        const interpolated = Object.entries(opts).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          key,
        );
        return interpolated;
      }
      return key;
    },
  }),
}));

// Mock the Radix-backed Dialog primitives so the dialog content is always
// present in the DOM when `open` is true, avoiding portal/focus-trap issues
// in jsdom (same convention as voice-session.test.tsx).
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("SourcesPanel", () => {
  it('status="loading" renders 1-3 Skeleton rows each h-[72px] rounded-lg and no spinner', () => {
    const { container } = render(<SourcesPanel status="loading" citations={[]} />);
    const skeletons = container.querySelectorAll(".h-\\[72px\\].rounded-lg");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    expect(skeletons.length).toBeLessThanOrEqual(3);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("status=populated with 1-3 citations renders that many cards with border, page badge, and a safe new-tab link", () => {
    const citations = [
      { title: "Product Guide", url: "https://example.com/guide", page: 3 },
      { title: "FAQ", url: "https://example.com/faq", page: 7 },
    ];
    const { container } = render(<SourcesPanel status="populated" citations={citations} />);

    const cards = container.querySelectorAll("a.border-border");
    expect(cards).toHaveLength(2);

    for (const card of Array.from(cards)) {
      expect(card).toHaveAttribute("target", "_blank");
      expect(card).toHaveAttribute("rel", "noopener noreferrer");
    }

    expect(screen.getByText("Product Guide")).toBeInTheDocument();
    expect(screen.getByText("sourcesPanel.pageBadge")).toBeInTheDocument();
  });

  it('status="empty-pre-question" renders the no-sources-yet heading with no destructive styling', () => {
    const { container } = render(<SourcesPanel status="empty-pre-question" citations={[]} />);
    expect(screen.getByText("sourcesPanel.emptyPreQuestion.heading")).toBeInTheDocument();
    expect(container.querySelector(".text-destructive")).not.toBeInTheDocument();
  });

  it('status="empty-no-match" renders the no-match heading with only text-muted-foreground, never text-destructive', () => {
    const { container } = render(<SourcesPanel status="empty-no-match" citations={[]} />);
    expect(screen.getByText("sourcesPanel.emptyNoMatch.heading")).toBeInTheDocument();
    expect(container.querySelector(".text-muted-foreground")).toBeInTheDocument();
    expect(container.querySelector(".text-destructive")).not.toBeInTheDocument();
  });
});

describe("AvatarInputBar", () => {
  it("renders a Textarea, a 56px (h-14 w-14) mic button, and a 44px (h-11 w-11) send button", () => {
    const { container } = render(
      <AvatarInputBar
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onMicClick={vi.fn()}
        micState="idle"
      />,
    );
    expect(container.querySelector("textarea")).toBeInTheDocument();
    expect(container.querySelector(".h-14.w-14")).toBeInTheDocument();
    expect(container.querySelector(".h-11.w-11")).toBeInTheDocument();
  });

  it("shows helper text with the interpolated {{seconds}} countdown when rate-limited, and disables send only", () => {
    const { container } = render(
      <AvatarInputBar
        value="hello"
        onChange={vi.fn()}
        onSend={vi.fn()}
        onMicClick={vi.fn()}
        micState="idle"
        rateLimitSeconds={12}
      />,
    );
    expect(screen.getByText("Rate limited — retry in 12s")).toBeInTheDocument();
    expect(container.querySelector("textarea")).not.toBeDisabled();
    const sendButton = container.querySelector(".h-11.w-11");
    expect(sendButton).toHaveClass("pointer-events-none");
  });

  it("supports an external ref on the textarea for programmatic focus", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(
      <AvatarInputBar
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onMicClick={vi.fn()}
        micState="idle"
        textareaRef={ref}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});

describe("MicPermissionDialog", () => {
  it("renders title/body/buttons per the copy table", () => {
    render(
      <MicPermissionDialog
        open={true}
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onUseTextInstead={vi.fn()}
      />,
    );
    expect(screen.getByText("micDialog.title")).toBeInTheDocument();
    expect(screen.getByText("micDialog.body")).toBeInTheDocument();
    expect(screen.getByText("micDialog.retry")).toBeInTheDocument();
    expect(screen.getByText("micDialog.useTextInstead")).toBeInTheDocument();
  });

  it('clicking "Use Text Instead" calls onUseTextInstead and closes the dialog', async () => {
    const user = userEvent.setup();
    const onUseTextInstead = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MicPermissionDialog
        open={true}
        onOpenChange={onOpenChange}
        onRetry={vi.fn()}
        onUseTextInstead={onUseTextInstead}
      />,
    );

    await user.click(screen.getByText("micDialog.useTextInstead"));

    expect(onUseTextInstead).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the still-denied inline error text only on a second failed attempt", () => {
    render(
      <MicPermissionDialog
        open={true}
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onUseTextInstead={vi.fn()}
        stillDenied
      />,
    );
    const stillDeniedEl = screen.getByText("micDialog.stillDenied");
    expect(stillDeniedEl).toHaveClass("text-destructive");
  });
});
