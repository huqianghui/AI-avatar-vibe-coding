/**
 * AvatarPage (Phase 32, ANON-04) -- the anonymous, no-login landing page at
 * `/`. Composes the anonymous session/chat hooks (Wave 3/4) with the
 * `SourcesPanel` / `AvatarInputBar` / `MicPermissionDialog` components
 * (Task 2) into the full grounded-Q&A experience.
 *
 * Structural separation (AI Avatar Domain Rule #6 / ANON-03 success
 * criterion): the transcript bubble only ever receives `data.answer`, and
 * `SourcesPanel` only ever receives `data.citations` -- these are NEVER
 * concatenated into a single string. See `handleSend` below.
 *
 * The anonymous WebRTC hook (`useAnonymousVoiceLive`) is audio-only (no
 * video track is ever negotiated -- see its module docstring), so
 * `AvatarView` is composed with `isDigitalHumanMode={false}` to render its
 * `AudioOrb` fallback rather than a (never-arriving) video stream, matching
 * the limitation already documented in 32-03-SUMMARY.md.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button, Sheet, SheetContent, SheetTrigger } from "@/components/ui";
import { AvatarView } from "@/components/voice/avatar-view";
import { VoiceTranscript } from "@/components/voice/voice-transcript";
import {
  SourcesPanel,
  type SourcesPanelCitation,
  type SourcesPanelStatus,
} from "@/components/avatar/sources-panel";
import { AvatarInputBar, type MicUiState } from "@/components/avatar/avatar-input-bar";
import { MicPermissionDialog } from "@/components/avatar/mic-permission-dialog";
import { useAnonymousAvatarSession } from "@/hooks/use-anonymous-avatar-session";
import { useAnonymousAvatarChat } from "@/hooks/use-anonymous-avatar-chat";
import { useAnonymousVoiceLive } from "@/hooks/use-anonymous-voice-live";
import type { ChatResponse } from "@/api/public-avatar";
import type { AudioState, TranscriptSegment, VoiceConnectionState } from "@/types/voice-live";

function resolveMicUiState(
  connectionState: VoiceConnectionState,
  audioState: AudioState,
  isMuted: boolean,
): MicUiState {
  if (connectionState === "connecting") return "disabled";
  if (isMuted) return "muted";
  if (audioState === "listening") return "listening";
  if (audioState === "speaking") return "speaking";
  return "idle";
}

export default function AvatarPage() {
  const { t, i18n } = useTranslation("avatar");
  const { t: tVoice } = useTranslation("voice");
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [sourcesStatus, setSourcesStatus] = useState<SourcesPanelStatus>("empty-pre-question");
  const [citations, setCitations] = useState<SourcesPanelCitation[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [micDialogOpen, setMicDialogOpen] = useState(false);
  const [micStillDenied, setMicStillDenied] = useState(false);
  const [sourcesSheetOpen, setSourcesSheetOpen] = useState(false);

  const { sessionToken, renewSession } = useAnonymousAvatarSession();

  const handleUnauthorized = useCallback(() => {
    void renewSession();
  }, [renewSession]);

  const chatMutation = useAnonymousAvatarChat(sessionToken, handleUnauthorized);

  const voiceLive = useAnonymousVoiceLive(sessionToken ?? "", {
    locale: i18n.language,
  });

  const hasAttemptedConnectRef = useRef(false);
  const micAttemptCountRef = useRef(0);

  const attemptMicConnect = useCallback(() => {
    hasAttemptedConnectRef.current = true;
    return voiceLive
      .connect(i18n.language)
      .then(() => {
        micAttemptCountRef.current = 0;
        setMicDialogOpen(false);
        setMicStillDenied(false);
      })
      .catch(() => {
        micAttemptCountRef.current += 1;
        setMicStillDenied(micAttemptCountRef.current > 1);
        setMicDialogOpen(true);
      });
    // voiceLive is a fresh object on every render (hook mocked in tests
    // returns a new literal each call) -- guard via hasAttemptedConnectRef
    // instead of depending on it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  // Always-connected anonymous avatar: attempt the WebRTC/mic handshake once
  // a session token exists. On denial, the mic-permission dialog opens
  // automatically -- text input remains usable regardless.
  useEffect(() => {
    if (!sessionToken || hasAttemptedConnectRef.current) return;
    void attemptMicConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const handleMicClick = useCallback(() => {
    if (voiceLive.connectionState === "connected") {
      voiceLive.toggleMute();
      return;
    }
    void attemptMicConnect();
  }, [voiceLive, attemptMicConnect]);

  const handleUseTextInstead = useCallback(() => {
    setMicDialogOpen(false);
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const message = inputValue.trim();
    if (!message || chatMutation.isPending) return;

    const userSegment: TranscriptSegment = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "user",
      content: message,
      isFinal: true,
      timestamp: Date.now(),
    };
    setTranscript((prev) => [...prev, userSegment]);
    setInputValue("");

    chatMutation.mutate(message, {
      onSuccess: (data: ChatResponse) => {
        const assistantSegment: TranscriptSegment = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          // Structural separation: ONLY the answer text goes into the
          // transcript bubble -- never citation title/url.
          content: data.answer,
          isFinal: true,
          timestamp: Date.now(),
        };
        setTranscript((prev) => [...prev, assistantSegment]);

        if (data.is_refusal) {
          setSourcesStatus("empty-no-match");
          setCitations([]);
        } else {
          setCitations(data.citations);
          setSourcesStatus(data.citations.length > 0 ? "populated" : "empty-no-match");
        }
      },
      onError: (err: Error) => {
        if (/\b429\b/.test(err.message)) {
          toast.error(t("toast.rateLimited"));
        } else {
          toast.error(tVoice("error.connectionFailed"));
        }
      },
    });
  }, [inputValue, chatMutation, t, tVoice]);

  const displaySourcesStatus: SourcesPanelStatus = chatMutation.isPending
    ? "loading"
    : sourcesStatus;

  const micUiState = resolveMicUiState(
    voiceLive.connectionState,
    voiceLive.audioState,
    voiceLive.isMuted,
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold">{t("sourcesPanel.title")}</span>
        <Button
          variant="ghost"
          className="font-normal"
          onClick={() => navigate("/login")}
        >
          <LogIn className="mr-1.5 h-4 w-4" />
          {t("login")}
        </Button>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_300px] md:gap-4 lg:grid-cols-[1fr_360px] lg:gap-6">
        <div className="flex flex-col overflow-hidden">
          <div className="min-h-[240px] flex-1 overflow-hidden">
            <AvatarView
              videoRef={videoRef}
              isAvatarConnected={false}
              isSessionActive={voiceLive.connectionState === "connected"}
              audioState={voiceLive.audioState}
              isConnecting={voiceLive.connectionState === "connecting"}
              isDigitalHumanMode={false}
              hcpName=""
              isFullScreen={false}
            />
          </div>
          <div className="h-64 overflow-hidden border-t border-border">
            <VoiceTranscript transcripts={transcript} hcpName="" />
          </div>
          <AvatarInputBar
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onMicClick={handleMicClick}
            micState={micUiState}
            textareaRef={textareaRef}
          />
        </div>

        <div className="hidden overflow-hidden md:block">
          <SourcesPanel status={displaySourcesStatus} citations={citations} />
        </div>

        <div className="md:hidden">
          <Sheet open={sourcesSheetOpen} onOpenChange={setSourcesSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="fixed bottom-24 right-4 z-30 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
              >
                {t("sourcesPanel.title")} ({citations.length})
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] overflow-hidden">
              <SourcesPanel status={displaySourcesStatus} citations={citations} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <MicPermissionDialog
        open={micDialogOpen}
        onOpenChange={setMicDialogOpen}
        onRetry={attemptMicConnect}
        onUseTextInstead={handleUseTextInstead}
        stillDenied={micStillDenied}
      />
    </div>
  );
}
