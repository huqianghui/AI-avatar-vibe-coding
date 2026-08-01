import apiClient from "./client";
import type { CrmImportLog, CrmImportResult } from "@/types/crm";

export async function uploadCrmExcel(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CrmImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<CrmImportResult>(
    "/admin/crm/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    },
  );
  return data;
}

export async function downloadCrmTemplate(): Promise<void> {
  const { data } = await apiClient.get<Blob>("/admin/crm/template", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crm_template.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function getLastCrmImport(): Promise<CrmImportLog | null> {
  const { data } = await apiClient.get<CrmImportLog | null>(
    "/admin/crm/last-import",
  );
  return data;
}
