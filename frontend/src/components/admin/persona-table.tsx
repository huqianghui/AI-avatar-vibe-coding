import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useDeleteAvatarPersona,
  useSetDefaultAvatarPersona,
  useUpdateAvatarPersona,
} from "@/hooks/use-avatar-personas";
import type { AvatarPersona } from "@/api/avatar-personas";
import { AVATAR_CHARACTERS, getAvatarInitials } from "@/data/avatar-characters";
import { CDN_BASE } from "@/lib/voice-constants";

interface PersonaTableProps {
  personas: AvatarPersona[];
  isLoading: boolean;
  onEdit: (persona: AvatarPersona) => void;
}

function getThumbnailUrl(character: string, style: string): string {
  const meta = AVATAR_CHARACTERS.find((c) => c.id === character);
  if (meta?.isPhotoAvatar) return meta.thumbnailUrl;
  return `${CDN_BASE}/${character}-${style}.png`;
}

function CharacterThumbnail({ persona }: { persona: AvatarPersona }) {
  const meta = AVATAR_CHARACTERS.find((c) => c.id === persona.character);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${meta?.gradientClasses ?? "from-slate-400 to-slate-600"}`}
      >
        {getAvatarInitials(meta?.displayName ?? persona.character)}
      </div>
    );
  }

  return (
    <img
      src={getThumbnailUrl(persona.character, persona.style)}
      alt={meta?.displayName ?? persona.character}
      className="size-8 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function PersonaTable({ personas, isLoading, onEdit }: PersonaTableProps) {
  const { t } = useTranslation("admin");
  const updateMutation = useUpdateAvatarPersona();
  const deleteMutation = useDeleteAvatarPersona();
  const setDefaultMutation = useSetDefaultAvatarPersona();

  const [deleteTarget, setDeleteTarget] = useState<AvatarPersona | null>(null);
  const pendingEnabledIdRef = useRef<string | null>(null);

  const handleError = (error: unknown) => {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 409) {
      toast.error(t("personas.defaultGuardError.title"), {
        description: t("personas.defaultGuardError.body"),
      });
    } else {
      toast.error(t("personas.saveError.title"), {
        description: t("personas.saveError.body"),
      });
    }
  };

  const handleToggleEnabled = (persona: AvatarPersona, value: boolean) => {
    pendingEnabledIdRef.current = persona.id;
    updateMutation.mutate(
      { id: persona.id, data: { enabled: value } },
      {
        onError: handleError,
        onSettled: () => {
          pendingEnabledIdRef.current = null;
        },
      },
    );
  };

  const handleSetDefault = (persona: AvatarPersona) => {
    setDefaultMutation.mutate(persona.id, { onError: handleError });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => setDeleteTarget(null),
        onError: handleError,
      },
    );
  };

  return (
    <div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-12 px-4 py-3" />
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("personas.columnName")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("personas.columnCharacterStyle")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("personas.columnDefault")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("personas.columnEnabled")}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("personas.columnActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Skeleton className="size-8 rounded-full" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-[120px] rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-[100px] rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-[60px] rounded-full" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-[40px] rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="size-5 rounded" />
                  </td>
                </tr>
              ))
            ) : personas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <EmptyState
                    title={t("personas.emptyTitle")}
                    body={t("personas.emptyBody")}
                  />
                </td>
              </tr>
            ) : (
              personas.map((persona) => {
                const meta = AVATAR_CHARACTERS.find((c) => c.id === persona.character);
                const characterStyleLabel = meta?.isPhotoAvatar
                  ? meta.displayName
                  : `${meta?.displayName ?? persona.character} (${persona.style.replace(/-/g, " ")})`;

                return (
                  <tr
                    key={persona.id}
                    data-testid="persona-row"
                    data-persona-id={persona.id}
                    className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                    onDoubleClick={() => onEdit(persona)}
                  >
                    <td className="px-4 py-3">
                      <CharacterThumbnail persona={persona} />
                    </td>
                    <td className="px-4 py-3 font-medium">{persona.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {characterStyleLabel}
                    </td>
                    <td className="px-4 py-3">
                      {persona.is_default ? (
                        <Badge variant="default">{t("personas.defaultBadge")}</Badge>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(persona);
                          }}
                        >
                          {t("personas.toggleDefault")}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={persona.enabled}
                        onCheckedChange={(v) => handleToggleEnabled(persona, v)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t("personas.toggleEnabled")}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t("personas.editAriaLabel")}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(persona);
                              }}
                            >
                              <Edit className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("personas.editAriaLabel")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                aria-label={t("personas.deleteAriaLabel")}
                                disabled={persona.is_default}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(persona);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {persona.is_default
                              ? t("personas.deleteDisabledTooltip")
                              : t("personas.deleteAriaLabel")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("personas.deletePersona.title")}</DialogTitle>
            <DialogDescription>
              {deleteTarget &&
                t("personas.deletePersona.body", { name: deleteTarget.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("personas.deletePersona.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDeleteConfirm}
            >
              {t("personas.deletePersona.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
