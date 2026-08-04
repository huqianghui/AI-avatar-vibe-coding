import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceTestPlayground } from "@/components/voice/voice-test-playground";
import { testChatWithAgent } from "@/api/hcp-profiles";

interface ChatMessage {
  role: "user" | "hcp";
  content: string;
}

interface PlaygroundPreviewPanelProps {
  hcpProfileId?: string;
  profileName?: string;
  agentId?: string;
  vlInstanceId?: string;
  systemPrompt?: string;
  avatarCharacter?: string;
  avatarStyle?: string;
  avatarEnabled: boolean;
  voiceModeEnabled: boolean;
  disabled?: boolean;
  /** Extra content rendered in the toolbar area (e.g. the Foundry-portal-
   * style gear "Configure" button that opens the ConfigurationPanel --
   * persona-hcp-foundry-alignment Increment D). */
  toolbarExtra?: ReactNode;
}

export function PlaygroundPreviewPanel({
  hcpProfileId,
  profileName,
  agentId,
  vlInstanceId,
  systemPrompt,
  avatarCharacter,
  avatarStyle,
  avatarEnabled,
  voiceModeEnabled,
  disabled,
  toolbarExtra,
}: PlaygroundPreviewPanelProps) {
  const { t } = useTranslation(["admin"]);

  // ── Text chat state ───────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponseId, setChatResponseId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Reset chat when switching modes or profile changes
  useEffect(() => {
    setChatMessages([]);
    setChatInput("");
    setChatResponseId(null);
  }, [hcpProfileId, voiceModeEnabled]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading || !hcpProfileId) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const result = await testChatWithAgent(hcpProfileId, {
        message: userMsg.content,
        previous_response_id: chatResponseId ?? undefined,
      });
      setChatResponseId(result.response_id);
      setChatMessages((prev) => [
        ...prev,
        { role: "hcp", content: result.response_text },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get agent response";
      setChatMessages((prev) => [
        ...prev,
        { role: "hcp", content: `[Error] ${msg}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, hcpProfileId, chatResponseId]);

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendChatMessage();
    }
  };

  const hasAgent = !!agentId;

  // ── Render ────────────────────────────────────────────────────────

  if (voiceModeEnabled) {
    // Voice mode — delegate to shared VoiceTestPlayground component
    return (
      <Card className="flex flex-col h-full overflow-hidden">
        <VoiceTestPlayground
          hcpProfileId={hcpProfileId}
          vlInstanceId={vlInstanceId}
          systemPrompt={systemPrompt}
          avatarCharacter={avatarEnabled ? avatarCharacter : undefined}
          avatarStyle={avatarEnabled ? avatarStyle : undefined}
          avatarEnabled={avatarEnabled}
          hcpName={profileName}
          disabled={disabled}
          disabledMessage={
            disabled ? t("admin:hcp.playgroundDisabledNew") : undefined
          }
          headerExtra={toolbarExtra}
          className="flex-1"
        />
      </Card>
    );
  }

  // Text chat mode — HCP-specific (agent interaction via testChatWithAgent API)
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">
            {t("admin:hcp.playgroundTitle")}
          </CardTitle>
        </div>
        {toolbarExtra}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-3">
        {/* Chat messages area */}
        <ScrollArea className="flex-1 min-h-[360px] rounded-md border p-4" ref={chatScrollRef}>
          <div className="space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="size-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {hasAgent
                    ? t("admin:hcp.playgroundChatReady")
                    : t("admin:hcp.playgroundChatNoAgent")}
                </p>
                {profileName && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {profileName}
                  </p>
                )}
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-muted text-foreground"
                      : msg.content.startsWith("[Error]")
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-primary text-primary-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("admin:hcp.playgroundChatThinking")}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Chat input */}
        <div className="flex items-center gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder={
              disabled
                ? t("admin:hcp.playgroundDisabledNew")
                : hasAgent
                  ? t("admin:hcp.playgroundChatPlaceholder")
                  : t("admin:hcp.playgroundChatNoAgent")
            }
            className="flex-1"
            disabled={disabled || !hasAgent || chatLoading}
          />
          <Button
            size="icon"
            onClick={() => void sendChatMessage()}
            disabled={!chatInput.trim() || !hasAgent || chatLoading || disabled}
            aria-label={t("admin:hcp.playgroundChatSend")}
          >
            {chatLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
