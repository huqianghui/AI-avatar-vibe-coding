/**
 * AvatarInputBar (Phase 32, ANON-04) -- text + mic input bar for the
 * anonymous avatar page.
 *
 * Mic button color-state logic mirrors the pattern established by
 * `voice-controls.tsx`'s `getMicButtonConfig` (same color tokens: primary
 * idle, voice-speaking listening, voice-warning speaking, muted-foreground
 * muted) -- reimplemented here rather than imported, since that function is
 * not exported from voice-controls.tsx and this bar's state shape
 * (a plain `MicUiState` union, not the WebRTC hook's raw `AudioState` +
 * `VoiceConnectionState` + `isMuted` triple) is simpler and page-owned.
 *
 * Rate-limited state disables only the send action (`opacity-60
 * pointer-events-none`); the text input always stays usable per UI-SPEC.
 */
import { useTranslation } from "react-i18next";
import { ArrowUp, Mic, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export type MicUiState = "idle" | "listening" | "speaking" | "muted" | "disabled";

function getMicButtonColorClass(state: MicUiState): string {
  switch (state) {
    case "listening":
      return "bg-voice-speaking text-white";
    case "speaking":
      return "bg-voice-warning text-white";
    case "muted":
      return "bg-muted-foreground text-white";
    case "disabled":
      return "bg-muted text-muted-foreground opacity-50";
    default:
      return "bg-primary text-primary-foreground";
  }
}

function getMicIcon(state: MicUiState) {
  if (state === "muted") return MicOff;
  if (state === "speaking") return Volume2;
  return Mic;
}

interface AvatarInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onMicClick: () => void;
  micState: MicUiState;
  /** Seconds remaining before the caller can send another message; `null`/`undefined` = not rate-limited. */
  rateLimitSeconds?: number | null;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  className?: string;
}

export function AvatarInputBar({
  value,
  onChange,
  onSend,
  onMicClick,
  micState,
  rateLimitSeconds,
  textareaRef,
  className,
}: AvatarInputBarProps) {
  const { t } = useTranslation("avatar");

  const isRateLimited = typeof rateLimitSeconds === "number" && rateLimitSeconds > 0;
  const MicIcon = getMicIcon(micState);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isRateLimited) onSend();
    }
  };

  return (
    <div
      className={cn(
        "flex h-[72px] flex-col gap-1 border-t border-border bg-background px-4 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="min-h-0 flex-1 resize-none"
        />
        <button
          type="button"
          onClick={onMicClick}
          disabled={micState === "disabled"}
          aria-label={t("input.micIdleAriaLabel")}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed",
            getMicButtonColorClass(micState),
          )}
        >
          <MicIcon className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={isRateLimited}
          aria-label={t("input.sendAriaLabel")}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors",
            isRateLimited && "opacity-60 pointer-events-none",
          )}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
      {isRateLimited && (
        <p className="text-sm text-muted-foreground">
          {t("rateLimited", { seconds: rateLimitSeconds })}
        </p>
      )}
    </div>
  );
}
