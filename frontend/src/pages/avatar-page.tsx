/**
 * AvatarPage (Phase 32 ANON-04, extended Phase 33 PERS-02) -- the landing
 * page at `/`. Composes the anonymous session/chat hooks with the
 * `SourcesPanel` / `AvatarInputBar` / `MicPermissionDialog` components into
 * the full grounded-Q&A experience.
 *
 * Auth-aware routing (Phase 33, PERS-02): both `useAnonymousAvatarSession`
 * and `usePersonalizedAvatarSession` are called unconditionally on every
 * render (React rules-of-hooks -- only their *results* are selected
 * conditionally via `isAuthenticated ? x : y`). The anonymous session token
 * always powers `useAnonymousVoiceLive` regardless of auth state, per D-13
 * ("Voice/WebRTC flow is unconditionally reused for both anonymous and
 * personalized users -- zero new voice code"); only the *text chat*
 * session/mutation source swaps to the personalized pipeline when logged
 * in. The header's right-hand slot swaps from the "登录" button to
 * `{user.email}` + a "专属模式" `Badge` (D-13/D-14) -- no CRM field,
 * preference tag, or match-status content is ever read or rendered here.
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
import { LogIn, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Sheet, SheetContent, SheetTrigger } from "@/components/ui";
import { AvatarView } from "@/components/voice/avatar-view";
import { VoiceTranscript } from "@/components/voice/voice-transcript";
import {
  SourcesPanel,
  type SourcesPanelCitation,
  type SourcesPanelStatus,
} from "@/components/avatar/sources-panel";
import { AvatarInputBar, type MicUiState } from "@/components/avatar/avatar-input-bar";
import { MicPermissionDialog } from "@/components/avatar/mic-permission-dialog";
import { PersonaSwitcher } from "@/components/avatar/persona-switcher";
import { useMe } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { useAnonymousAvatarSession } from "@/hooks/use-anonymous-avatar-session";
import { useAnonymousAvatarChat } from "@/hooks/use-anonymous-avatar-chat";
import { usePersonalizedAvatarSession } from "@/hooks/use-personalized-avatar-session";
import { usePersonalizedAvatarChat } from "@/hooks/use-personalized-avatar-chat";
import { useAnonymousVoiceLive } from "@/hooks/use-anonymous-voice-live";
import {
  useEnabledPersonas,
  useSelectedPersona,
  useSetSelectedPersona,
} from "@/hooks/use-selected-persona";
import { AnonymousApiError, type ChatResponse } from "@/api/public-avatar";
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
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { isAuthenticated, user } = useAuthStore();

  // Persona switcher data (Phase 36, PERSONA-03). Both queries are gated on
  // `isAuthenticated` -- the switcher itself is hidden entirely for
  // anonymous visitors (36-UI-SPEC.md section 3), so there is no reason to
  // hit either endpoint before login. `activePersonaId` is tracked as local
  // state (not read directly from `selectedPersonaQuery.data` on every
  // render) so a failed session-rebuild after a successful PUT does not
  // visually flip the trigger to the new persona -- "leaves the previous
  // persona's trigger state unchanged" per 36-UI-SPEC.md's failure case.
  const selectedPersonaQuery = useSelectedPersona(isAuthenticated);
  const enabledPersonasQuery = useEnabledPersonas(isAuthenticated);
  const setSelectedPersonaMutation = useSetSelectedPersona();
  const [activePersonaId, setActivePersonaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (activePersonaId === undefined && selectedPersonaQuery.data) {
      setActivePersonaId(selectedPersonaQuery.data.id);
    }
  }, [activePersonaId, selectedPersonaQuery.data]);

  // `AvatarPage` is a public route (not `ProtectedRoute`-wrapped), so unlike
  // guarded pages it never otherwise calls `useMe()` -- on a hard reload,
  // the in-memory auth store hydrates `token` from localStorage but leaves
  // `user` as `null` until something fetches `/auth/me`. Call it here
  // (side-effect only, via `setAuth()` inside its queryFn) so a logged-in
  // visitor's email is available for the personalization badge below even
  // on a fresh load. No-op when there's no token (`useMe`'s query is
  // `enabled: !!token`).
  useMe();

  const { sessionToken, renewSession } = useAnonymousAvatarSession();

  const handleUnauthorized = useCallback(() => {
    void renewSession();
  }, [renewSession]);

  const anonymousChatMutation = useAnonymousAvatarChat(sessionToken, handleUnauthorized);

  // Personalized session/chat hooks are called unconditionally too (rules of
  // hooks) -- only which *result* powers `chatMutation` below is selected via
  // `isAuthenticated`. See module docstring.
  const { session: personalizedSession } = usePersonalizedAvatarSession();
  const personalizedChatMutation = usePersonalizedAvatarChat(
    personalizedSession?.session_id ?? null,
  );

  const chatMutation = isAuthenticated ? personalizedChatMutation : anonymousChatMutation;

  // Voice/WebRTC is unconditionally powered by the ANONYMOUS session token
  // regardless of auth state (D-13) -- personalized mode never negotiates its
  // own voice session in this phase.
  const voiceLive = useAnonymousVoiceLive(sessionToken ?? "", {
    locale: i18n.language,
  });

  const hasAttemptedConnectRef = useRef(false);
  const micAttemptCountRef = useRef(0);

  // `personaId` (Phase 36, PERSONA-03) is optional and only ever supplied by
  // `handleSwitchPersona` below -- the mount effect and mic-button click
  // handler call this with no args, preserving whichever persona the
  // anonymous session already resolved to. Returns whether the connect
  // succeeded so callers (e.g. the persona-switch flow) can react to failure
  // without this function's own mic-dialog side effects leaking into that
  // unrelated UI.
  const attemptMicConnect = useCallback((personaId?: string) => {
    hasAttemptedConnectRef.current = true;
    return voiceLive
      .connect(i18n.language, personaId)
      .then(() => {
        micAttemptCountRef.current = 0;
        setMicDialogOpen(false);
        setMicStillDenied(false);
        return true;
      })
      .catch(() => {
        micAttemptCountRef.current += 1;
        setMicStillDenied(micAttemptCountRef.current > 1);
        setMicDialogOpen(true);
        return false;
      });
    // voiceLive is a fresh object on every render (hook mocked in tests
    // returns a new literal each call) -- guard via hasAttemptedConnectRef
    // instead of depending on it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  // Persona-switch handler (Phase 36, PERSONA-03): disconnect + reconnect,
  // never a mid-session hot-swap (Phase 34 convention). The trigger's visible
  // persona (`activePersonaId`) is only ever updated after the reconnect
  // itself succeeds -- a PUT that succeeds but is followed by a failed
  // reconnect leaves the previous persona active with no partial-state UI,
  // per 36-UI-SPEC.md section 3.
  const handleSwitchPersona = useCallback(
    (personaId: string) => {
      const targetName = enabledPersonasQuery.data?.find((p) => p.id === personaId)?.name ?? "";
      const toastId = toast.loading(t("personaSwitcher.switching", { name: targetName }));

      void voiceLive.disconnect();

      setSelectedPersonaMutation.mutate(personaId, {
        onSuccess: (data) => {
          void attemptMicConnect(personaId).then((connected) => {
            toast.dismiss(toastId);
            if (connected) {
              setActivePersonaId(personaId);
              void voiceLive.sendTextMessage(data.greeting);
            } else {
              toast.error(t("personaSwitcher.error.title"), {
                description: t("personaSwitcher.error.body"),
              });
            }
          });
        },
        onError: () => {
          toast.dismiss(toastId);
          toast.error(t("personaSwitcher.error.title"), {
            description: t("personaSwitcher.error.body"),
          });
        },
      });
    },
    [enabledPersonasQuery.data, voiceLive, setSelectedPersonaMutation, attemptMicConnect, t],
  );

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
    // Defer the focus call past the current synchronous handler -- Radix's
    // Dialog focus-trap is still active at this exact point (it only
    // releases once React re-renders with `open=false`), so calling
    // `.focus()` here immediately gets stolen back into the dialog.
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  // Rate-limit countdown: on a 429 chat response, disable only the send
  // action (text input stays usable per UI-SPEC) until the countdown hits 0.
  const startRateLimitCountdown = useCallback((seconds: number) => {
    if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    setRateLimitSeconds(seconds);
    rateLimitTimerRef.current = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
          rateLimitTimerRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    };
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
          const retryAfterSeconds =
            err instanceof AnonymousApiError && err.retryAfterSeconds
              ? err.retryAfterSeconds
              : 30;
          startRateLimitCountdown(retryAfterSeconds);
        } else {
          toast.error(tVoice("error.connectionFailed"));
        }
      },
    });
  }, [inputValue, chatMutation, t, tVoice, startRateLimitCountdown]);

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
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <PersonaSwitcher
              isAuthenticated={isAuthenticated}
              personas={enabledPersonasQuery.data ?? []}
              activePersonaId={activePersonaId}
              onSwitch={handleSwitchPersona}
              disabled={setSelectedPersonaMutation.isPending}
            />
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/10 text-primary text-sm font-normal"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("personalizationBadge")}
            </Badge>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="font-normal"
            onClick={() => navigate("/login")}
          >
            <LogIn className="mr-1.5 h-4 w-4" />
            {t("login")}
          </Button>
        )}
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
            rateLimitSeconds={rateLimitSeconds}
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
