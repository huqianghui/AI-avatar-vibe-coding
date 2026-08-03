import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui";
import type { TranscriptSegment } from "@/types/voice-live";

interface VoiceTranscriptProps {
  transcripts: TranscriptSegment[];
  hcpName: string;
  className?: string;
  /**
   * Overrides the empty-state copy (Phase 37, UI fidelity fix). Defaults to
   * the voice-namespace's `emptyTranscript` ("Start speaking...") for the
   * coach pages this component originated on -- callers outside that
   * context (e.g. the anonymous avatar page, whose mic may be denied) should
   * pass their own namespace's copy instead of the coach-era default.
   */
  emptyText?: string;
}

/**
 * Real-time transcript display.
 * Renders transcript segments as chat-style messages with auto-scroll.
 * User messages aligned right (primary), assistant messages aligned left.
 */
export function VoiceTranscript({
  transcripts,
  hcpName,
  className,
  emptyText,
}: VoiceTranscriptProps) {
  const { t } = useTranslation("voice");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center p-4", className)}
        aria-live="polite"
      >
        <p className="text-center text-sm text-muted-foreground">
          {emptyText ?? t("emptyTranscript")}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div
        ref={scrollRef}
        className="flex flex-col gap-3 p-4"
        aria-live="polite"
      >
        {transcripts.map((segment) => {
          const isUser = segment.role === "user";
          const speakerLabel = isUser
            ? t("transcript.user")
            : t("transcript.hcp", { name: hcpName });
          const timeStr = new Date(segment.timestamp).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit", second: "2-digit" },
          );

          return (
            <div
              key={segment.id}
              className={cn(
                "flex w-full",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              <div className="max-w-[75%]">
                <div
                  className={cn(
                    "mb-1 flex items-center gap-2 text-xs",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      isUser ? "text-primary" : "text-voice-speaking",
                    )}
                  >
                    {speakerLabel}
                  </span>
                  <span className="text-muted-foreground" data-testid="transcript-timestamp">
                    {timeStr}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2",
                    isUser
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted text-foreground",
                    !segment.isFinal && "opacity-70",
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm">
                    {segment.content}
                    {!segment.isFinal && (
                      <span className="ml-1 inline-block animate-pulse">
                        |
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
