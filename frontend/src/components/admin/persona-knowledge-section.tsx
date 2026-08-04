/**
 * Persona-scoped Knowledge / Foundry IQ section (persona-hcp-foundry-alignment
 * Increment C). Mirrors `knowledge-tab.tsx`'s HCP UI exactly -- same card
 * layout, same "hcp.*" translation keys (reused as-is, matching how
 * `persona-agent-status-section.tsx` already reuses `hcp.agentVersion` /
 * `hcp.retrySync` for personas rather than duplicating strings) -- but wired
 * to the persona-scoped hooks/API instead of the HCP ones.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Trash2, Plus, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectKbDialog } from "@/components/admin/connect-kb-dialog";
import {
  usePersonaKnowledgeConfigs,
  useAddPersonaKnowledgeConfig,
  useRemovePersonaKnowledgeConfig,
} from "@/hooks/use-knowledge-base";
import type { KnowledgeConfigCreate } from "@/types/knowledge-base";

interface PersonaKnowledgeSectionProps {
  personaId: string;
}

export function PersonaKnowledgeSection({
  personaId,
}: PersonaKnowledgeSectionProps) {
  const { t } = useTranslation("admin");
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const { data: configs, isLoading } = usePersonaKnowledgeConfigs(personaId);
  const addMutation = useAddPersonaKnowledgeConfig();
  const removeMutation = useRemovePersonaKnowledgeConfig();

  const handleRemove = (configId: string) => {
    removeMutation.mutate(configId);
  };

  const handleConnect = (data: KnowledgeConfigCreate, onDone: () => void) => {
    addMutation.mutate({ personaId, data }, { onSuccess: onDone });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {t("hcp.knowledgeTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("hcp.knowledgeDescription")}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-1" />
                  {t("hcp.addKnowledgeBase")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setConnectDialogOpen(true)}>
                  <Database className="size-4 mr-2" />
                  {t("hcp.connectToFoundryIQ")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : configs && configs.length > 0 ? (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Database className="size-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {config.index_name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {t("hcp.kbConnected")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span>
                          {t("hcp.kbConnectionLabel")}: {config.connection_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemove(config.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">
                      {t("hcp.removeKnowledgeBase")}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="size-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("hcp.noKnowledgeBases")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConnectKbDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={handleConnect}
        isPending={addMutation.isPending}
      />
    </div>
  );
}
