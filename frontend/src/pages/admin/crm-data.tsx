import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDownloadCrmTemplate,
  useLastCrmImport,
  useUploadCrmExcel,
} from "@/hooks/use-crm-import";
import { cn } from "@/lib/utils";

const MAX_CRM_FILE_SIZE = 4 * 1024 * 1024;

export default function CrmDataPage() {
  const { t } = useTranslation("admin");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const lastImport = useLastCrmImport();
  const uploadMutation = useUploadCrmExcel();
  const downloadTemplateMutation = useDownloadCrmTemplate();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxSize: MAX_CRM_FILE_SIZE,
    maxFiles: 1,
    multiple: false,
    onDrop: (files: File[]) => {
      const file = files[0];
      if (file) {
        setSelectedFile(file);
        setHeaderError(null);
      }
    },
  });

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(
      { file: selectedFile, onProgress: setUploadProgress },
      {
        onSuccess: () => {
          toast.success(t("crmData.uploadSuccessToast"));
          setSelectedFile(null);
          setHeaderError(null);
        },
        onError: (error: unknown) => {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 422) {
            setHeaderError(t("crmData.headerErrorBody"));
          } else {
            toast.error(t("errors.crmUploadFailed"));
          }
        },
      },
    );
  };

  const data = lastImport.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("crmData.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("crmData.description")}</p>
      </div>

      <Card className="bg-card rounded-lg border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {t("crmData.uploadSectionTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {headerError && (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {t("crmData.headerErrorTitle")}
              </p>
              <p className="text-sm text-destructive">{headerError}</p>
            </div>
          )}

          <div
            {...getRootProps()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all duration-150",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-normal text-muted-foreground">
              {t("crmData.dropzoneHint")}
            </p>
            {selectedFile && (
              <p className="mt-2 text-sm font-medium text-primary">{selectedFile.name}</p>
            )}
          </div>

          {uploadMutation.isPending && (
            <div className="space-y-1">
              <Progress value={uploadProgress} />
              <p className="text-center text-xs font-normal text-muted-foreground">
                {t("crmData.uploading")}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-primary"
              onClick={() => downloadTemplateMutation.mutate()}
            >
              {t("crmData.downloadTemplate")}
            </Button>
            <Button
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={handleUpload}
            >
              {t("crmData.uploadButton")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card rounded-lg border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {t("crmData.resultSectionTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {headerError ? null : data ? (
            <div className="space-y-4">
              <p className="text-base font-normal text-foreground">
                {t("crmData.resultSummary", {
                  success: data.success_count,
                  skipped: data.skipped.length,
                  unmatched: data.unmatched.length,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary">{data.success_count}</Badge>
                <Badge className="bg-weakness/10 text-weakness">{data.skipped.length}</Badge>
                <Badge className="bg-weakness/10 text-weakness">{data.unmatched.length}</Badge>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="text-sm font-normal text-weakness underline-offset-2 hover:underline"
                  onClick={() => setShowSkipped((v) => !v)}
                >
                  {t("crmData.skippedToggle")}
                </button>
                {showSkipped && (
                  <ScrollArea className="max-h-[200px] rounded-md border border-weakness/20 bg-weakness/5 p-2">
                    <div className="space-y-1">
                      {data.skipped.map((issue, idx) => (
                        <p key={idx} className="text-sm font-normal text-weakness">
                          {t("crmData.skippedRowLine", {
                            row: issue.row,
                            reason: issue.reason,
                          })}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="text-sm font-normal text-weakness underline-offset-2 hover:underline"
                  onClick={() => setShowUnmatched((v) => !v)}
                >
                  {t("crmData.unmatchedToggle")}
                </button>
                {showUnmatched && (
                  <ScrollArea className="max-h-[200px] rounded-md border border-weakness/20 bg-weakness/5 p-2">
                    <div className="space-y-1">
                      {data.unmatched.map((issue, idx) => (
                        <p key={idx} className="text-sm font-normal text-weakness">
                          {t("crmData.unmatchedRowLine", {
                            email: issue.email,
                            reason: issue.reason,
                          })}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                {t("crmData.emptyTitle")}
              </p>
              <p className="mt-1 text-sm font-normal text-muted-foreground">
                {t("crmData.emptyBody")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
