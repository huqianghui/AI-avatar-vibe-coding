import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSearchConnections, useSearchIndexes } from "@/hooks/use-knowledge-base";
import type { KnowledgeConfigCreate } from "@/types/knowledge-base";

interface ConnectKbDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owner-agnostic connect handler (persona-hcp-foundry-alignment
   * Increment C). The dialog itself has no knowledge of *what* it's
   * attaching to (HCP profile vs AvatarPersona) -- the caller supplies
   * the actual mutate call and is responsible for invoking `onDone` once
   * the request succeeds so the dialog can reset/close itself. */
  onConnect: (data: KnowledgeConfigCreate, onDone: () => void) => void;
  isPending: boolean;
}

export function ConnectKbDialog({
  open,
  onOpenChange,
  onConnect,
  isPending,
}: ConnectKbDialogProps) {
  const { t } = useTranslation("admin");
  const [selectedConnection, setSelectedConnection] = useState("");
  const [selectedIndex, setSelectedIndex] = useState("");

  const { data: connections, isLoading: connectionsLoading } =
    useSearchConnections();
  const { data: indexes, isLoading: indexesLoading } = useSearchIndexes();

  const selectedConnectionObj = connections?.find(
    (c) => c.name === selectedConnection,
  );

  const handleConnect = () => {
    if (!selectedConnection || !selectedIndex || !selectedConnectionObj) return;

    onConnect(
      {
        connection_name: selectedConnection,
        connection_target: selectedConnectionObj.target,
        index_name: selectedIndex,
      },
      () => {
        setSelectedConnection("");
        setSelectedIndex("");
        onOpenChange(false);
      },
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedConnection("");
      setSelectedIndex("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("hcp.connectToFoundryIQ")}</DialogTitle>
          <DialogDescription>
            {t("hcp.knowledgeDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Select Connection */}
          <div className="space-y-2">
            <Label>{t("hcp.connectionLabel")}</Label>
            <Select
              value={selectedConnection}
              onValueChange={setSelectedConnection}
              disabled={connectionsLoading || connections?.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    connectionsLoading
                      ? "Loading..."
                      : t("hcp.selectConnection")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {connections && connections.length > 0 ? (
                  connections.map((conn) => (
                    <SelectItem key={conn.name} value={conn.name}>
                      {conn.name}
                      {conn.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {t("hcp.noConnectionsFound")}
                  </div>
                )}
              </SelectContent>
            </Select>
            {!connectionsLoading && connections?.length === 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{t("hcp.noConnectionsHint")}</span>
              </div>
            )}
          </div>

          {/* Step 2: Select Knowledge Base / Index */}
          <div className="space-y-2">
            <Label>{t("hcp.knowledgeBaseLabel")}</Label>
            <Select
              value={selectedIndex}
              onValueChange={setSelectedIndex}
              disabled={indexesLoading || !selectedConnection || indexes?.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    indexesLoading
                      ? "Loading..."
                      : t("hcp.selectKnowledgeBase")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {indexes && indexes.length > 0 ? (
                  indexes.map((idx) => (
                    <SelectItem key={idx.name} value={idx.name}>
                      {idx.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {t("hcp.noKnowledgeBasesFound")}
                  </div>
                )}
              </SelectContent>
            </Select>
            {!indexesLoading && selectedConnection && indexes?.length === 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{t("hcp.noKnowledgeBasesHint")}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("hcp.cancelButton")}
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!selectedConnection || !selectedIndex || isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("hcp.connectButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
