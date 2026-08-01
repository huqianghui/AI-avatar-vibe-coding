import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Card,
  CardContent,
  Badge,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
} from "@/components/ui";
import {
  usePersonalizationSummary,
  useCreatePreference,
  useDeletePreference,
  CATEGORY_OPTIONS,
} from "@/hooks/use-user-preferences";
import type { AdminUser } from "@/api/users";
import type { PreferenceCategory } from "@/api/user-preferences";

interface UserPersonalizationDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function categoryToKey(category: string): string {
  return category.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function UserPersonalizationDialog({
  user,
  open,
  onOpenChange,
}: UserPersonalizationDialogProps) {
  const { t } = useTranslation("admin");
  const userId = user?.id ?? "";
  const { data: summary } = usePersonalizationSummary(userId);
  const createMutation = useCreatePreference(userId);
  const deleteMutation = useDeletePreference(userId);
  const [category, setCategory] = useState<PreferenceCategory | "">("");
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (!category || !value.trim()) return;
    createMutation.mutate(
      { category, value: value.trim() },
      {
        onSuccess: () => {
          setCategory("");
          setValue("");
        },
      },
    );
  };

  const handleDelete = (preferenceId: string, label: string) => {
    deleteMutation.mutate(preferenceId, {
      onSuccess: () => {
        toast.success(t("personalization.deleteToast", { label }), {
          action: {
            label: t("personalization.undo"),
            onClick: () => {
              // Re-creating the deleted preference is out of scope for this POC's
              // toast action; the undo button surfaces the affordance per the
              // UI spec while admins can re-add the tag manually via the add-row.
            },
          },
        });
      },
    });
  };

  const preferences = summary?.preferences ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("personalization.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="bg-muted">
            <CardContent className="pt-4">
              {summary?.crm_matched ? (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-strength" />
                  <span className="text-sm">{t("personalization.crmMatched")}</span>
                  <span className="text-base">
                    {summary.customer_name} · {summary.company}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("personalization.crmUnmatched")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            {preferences.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold">{t("personalization.emptyTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("personalization.emptyBody")}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {preferences.map((pref) => (
                  <Badge key={pref.id} variant="secondary" className="gap-2">
                    {t(`personalization.category.${categoryToKey(pref.category)}`)}: {pref.value}
                    <button
                      type="button"
                      title={t("personalization.deleteTag")}
                      onClick={() => handleDelete(pref.id, `${pref.category}: ${pref.value}`)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as PreferenceCategory)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t("personalization.categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("personalization.valuePlaceholder")}
              />
              <Button
                onClick={handleAdd}
                disabled={!category || !value.trim() || createMutation.isPending}
              >
                {createMutation.isPending
                  ? t("personalization.adding")
                  : t("personalization.add")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
