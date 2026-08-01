/**
 * MicPermissionDialog (Phase 32, ANON-04) -- shown when `getUserMedia` is
 * denied/fails while attempting to start voice input on the anonymous
 * avatar page. Text input always remains usable as a fallback.
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MicPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onUseTextInstead: () => void;
  /** True once a retry attempt has failed a second time. */
  stillDenied?: boolean;
}

export function MicPermissionDialog({
  open,
  onOpenChange,
  onRetry,
  onUseTextInstead,
  stillDenied = false,
}: MicPermissionDialogProps) {
  const { t } = useTranslation("avatar");

  const handleUseTextInstead = () => {
    onUseTextInstead();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("micDialog.title")}</DialogTitle>
          <DialogDescription>{t("micDialog.body")}</DialogDescription>
        </DialogHeader>
        {stillDenied && (
          <p className="text-destructive text-sm">{t("micDialog.stillDenied")}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleUseTextInstead}>
            {t("micDialog.useTextInstead")}
          </Button>
          <Button onClick={onRetry}>{t("micDialog.retry")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
