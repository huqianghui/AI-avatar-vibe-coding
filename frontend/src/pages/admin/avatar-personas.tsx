import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonaTable } from "@/components/admin/persona-table";
import { PersonaDialog } from "@/components/admin/persona-dialog";
import { useAvatarPersonas } from "@/hooks/use-avatar-personas";
import type { AvatarPersona } from "@/api/avatar-personas";

export default function AvatarPersonasPage() {
  const { t } = useTranslation("admin");
  const { data, isLoading } = useAvatarPersonas();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AvatarPersona | null>(null);

  const personas = data ?? [];

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (persona: AvatarPersona) => {
    setEditTarget(persona);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("personas.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("personas.pageDescription")}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          {t("personas.create")}
        </Button>
      </div>

      <PersonaTable personas={personas} isLoading={isLoading} onEdit={openEdit} />

      <PersonaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        persona={editTarget}
      />
    </div>
  );
}
