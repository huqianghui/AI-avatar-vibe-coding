import { useTranslation } from "react-i18next";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { avatarPersonasApi, type AvatarPersona } from "@/api/avatar-personas";

/**
 * Thin persona variant of agent-status-section.tsx's AgentStatusSection.
 *
 * agent-status-section.tsx is hard-typed to `HcpProfile` and imports
 * `getAgentPortalUrl` directly from `@/api/hcp-profiles` (established
 * codebase precedent: domain-specific status cards are duplicated rather
 * than shared through a polymorphic type -- see
 * .planning/debug/persona-hcp-foundry-alignment.md Increment B rationale).
 * This component mirrors it exactly, swapped to AvatarPersona + the
 * /admin/avatar-personas/{id}/agent-portal-url endpoint.
 */

const AGENT_STATUS_CONFIG = {
  synced: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Agent Synced",
  },
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    label: "Sync Pending",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Sync Failed",
  },
  none: {
    icon: AlertTriangle,
    color: "text-muted-foreground",
    bg: "bg-muted/50 border-muted",
    label: "No Agent",
  },
} as const;

interface PersonaAgentStatusSectionProps {
  persona: AvatarPersona | undefined;
  isNew: boolean;
  onRetrySync: () => void;
  retrySyncPending: boolean;
  // Pull the latest voice-live config from the synced agent (Increment H).
  // Optional so existing call sites/tests that predate this feature keep
  // compiling; the button itself only renders when both are provided.
  onPullConfig?: () => void;
  pullConfigPending?: boolean;
}

export function PersonaAgentStatusSection({
  persona,
  isNew,
  onRetrySync,
  retrySyncPending,
  onPullConfig,
  pullConfigPending = false,
}: PersonaAgentStatusSectionProps) {
  const { t } = useTranslation(["admin", "common"]);

  const agentStatus = persona?.agent_sync_status ?? "none";
  const statusConfig = AGENT_STATUS_CONFIG[agentStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn("border", statusConfig.bg)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bot className="size-5" />
          AI Foundry Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("size-5", statusConfig.color)} />
          <span className={cn("text-sm font-medium", statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>

        {/* Agent ID */}
        {persona?.agent_id && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Agent ID</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm font-mono bg-background/80 rounded px-2 py-1 truncate border">
                  {persona.agent_id}
                </p>
              </TooltipTrigger>
              <TooltipContent>{persona.agent_id}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Agent Version */}
        {persona?.agent_version && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("admin:hcp.agentVersion")}
            </Label>
            <p className="text-sm font-mono bg-background/80 rounded px-2 py-1 border">
              {persona.agent_version}
            </p>
          </div>
        )}

        {/* Error message */}
        {agentStatus === "failed" && persona?.agent_sync_error && (
          <div className="space-y-1">
            <Label className="text-xs text-red-600">Error</Label>
            <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-200 max-h-24 overflow-y-auto">
              {persona.agent_sync_error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {!isNew && agentStatus !== "pending" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetrySync}
              disabled={retrySyncPending}
              className="w-full"
            >
              <RefreshCw
                className={cn(
                  "size-4 mr-2",
                  retrySyncPending && "animate-spin",
                )}
              />
              {retrySyncPending
                ? "Syncing..."
                : agentStatus === "synced"
                  ? "Force re-sync"
                  : t("admin:hcp.retrySync")}
            </Button>
          )}
          {!isNew && agentStatus === "synced" && onPullConfig && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPullConfig}
              disabled={pullConfigPending}
              className="w-full"
            >
              <Download
                className={cn(
                  "size-4 mr-2",
                  pullConfigPending && "animate-pulse",
                )}
              />
              {pullConfigPending
                ? t("admin:hcp.pullVoiceConfigPending")
                : t("admin:hcp.pullVoiceConfig")}
            </Button>
          )}
          {persona?.agent_id && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={async () => {
                try {
                  const result = await avatarPersonasApi.getAgentPortalUrl(
                    persona.id,
                  );
                  window.open(result.url, "_blank", "noopener,noreferrer");
                } catch {
                  window.open(
                    "https://ai.azure.com",
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              View in Azure Portal
            </Button>
          )}
        </div>

        {/* Info for new personas */}
        {isNew && (
          <p className="text-xs text-muted-foreground">
            An AI Foundry Agent will be automatically created when you save
            this persona. The agent will use the persona data as its
            instructions.
          </p>
        )}

        {/* Metadata */}
        {!isNew && persona && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <Label className="text-xs text-muted-foreground">Created</Label>
              <p className="text-sm">
                {new Date(persona.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Last Updated
              </Label>
              <p className="text-sm">
                {new Date(persona.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
