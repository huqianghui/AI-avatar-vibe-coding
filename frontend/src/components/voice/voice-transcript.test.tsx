import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceTranscript } from "./voice-transcript";
import type { TranscriptSegment } from "@/types/voice-live";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === "transcript.hcp" && opts?.["name"]) {
        return `transcript.hcp(${opts["name"]})`;
      }
      return key;
    },
  }),
}));

// Mock ScrollArea to avoid Radix issues in tests
vi.mock("@/components/ui", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

function makeSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: "seg-1",
    role: "user",
    content: "Hello doctor",
    isFinal: true,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("VoiceTranscript", () => {
  it("renders empty state message when transcripts array is empty", () => {
    render(<VoiceTranscript transcripts={[]} hcpName="Dr. Wang" />);
    expect(screen.getByText("emptyTranscript")).toBeInTheDocument();
  });

  it("renders the caller-supplied emptyText instead of the default voice-namespace copy when provided", () => {
    render(
      <VoiceTranscript
        transcripts={[]}
        hcpName="Dr. Wang"
        emptyText="Ask a question or use the mic to start talking with the avatar."
      />,
    );
    expect(
      screen.getByText("Ask a question or use the mic to start talking with the avatar."),
    ).toBeInTheDocument();
    expect(screen.queryByText("emptyTranscript")).not.toBeInTheDocument();
  });

  it("renders transcript segments with correct content", () => {
    const segments = [
      makeSegment({ id: "s1", content: "Hello doctor", role: "user" }),
      makeSegment({ id: "s2", content: "Good morning", role: "assistant" }),
    ];
    render(<VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />);
    expect(screen.getByText("Hello doctor")).toBeInTheDocument();
    expect(screen.getByText("Good morning")).toBeInTheDocument();
  });

  it("user messages contain transcript.user label", () => {
    const segments = [makeSegment({ id: "s1", role: "user" })];
    render(<VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />);
    expect(screen.getByText("transcript.user")).toBeInTheDocument();
  });

  it("assistant messages contain transcript.hcp label", () => {
    const segments = [
      makeSegment({ id: "s2", role: "assistant", content: "Hello" }),
    ];
    render(<VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />);
    expect(screen.getByText("transcript.hcp(Dr. Wang)")).toBeInTheDocument();
  });

  it("has aria-live polite attribute on container", () => {
    render(<VoiceTranscript transcripts={[]} hcpName="Dr. Wang" />);
    const ariaLiveElement = document.querySelector('[aria-live="polite"]');
    expect(ariaLiveElement).toBeInTheDocument();
    expect(ariaLiveElement).toHaveAttribute("aria-live", "polite");
  });

  it("non-final segments have opacity styling", () => {
    const segments = [
      makeSegment({ id: "s1", isFinal: false, content: "Typing..." }),
    ];
    const { container } = render(
      <VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />,
    );
    const opacityEl = container.querySelector(".opacity-70");
    expect(opacityEl).toBeInTheDocument();
  });

  it("non-final segments show typing cursor animation", () => {
    const segments = [
      makeSegment({ id: "s1", isFinal: false, content: "Typing..." }),
    ];
    const { container } = render(
      <VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />,
    );
    const pulseEl = container.querySelector(".animate-pulse");
    expect(pulseEl).toBeInTheDocument();
  });

  it("renders timestamps for each transcript segment", () => {
    const timestamp = new Date("2026-04-04T10:30:45").getTime();
    const segments = [
      makeSegment({ id: "s1", content: "Hello", timestamp }),
      makeSegment({ id: "s2", role: "assistant", content: "Hi", timestamp }),
    ];
    render(<VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />);
    const timestampElements = screen.getAllByTestId("transcript-timestamp");
    expect(timestampElements).toHaveLength(2);
    // Each timestamp should have non-empty text content
    for (const el of timestampElements) {
      expect(el.textContent).toBeTruthy();
    }
  });

  it("user message timestamps are right-aligned", () => {
    const segments = [makeSegment({ id: "s1", role: "user" })];
    const { container } = render(
      <VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />,
    );
    const headerRow = container.querySelector(".justify-end.flex.items-center");
    expect(headerRow).toBeInTheDocument();
  });

  it("assistant message timestamps are left-aligned", () => {
    const segments = [
      makeSegment({ id: "s1", role: "assistant", content: "Reply" }),
    ];
    const { container } = render(
      <VoiceTranscript transcripts={segments} hcpName="Dr. Wang" />,
    );
    const headerRow = container.querySelector(".justify-start.flex.items-center");
    expect(headerRow).toBeInTheDocument();
  });
});
