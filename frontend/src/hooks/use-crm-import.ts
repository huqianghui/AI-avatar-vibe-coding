import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadCrmTemplate, getLastCrmImport, uploadCrmExcel } from "@/api/crm";

export function useLastCrmImport() {
  return useQuery({ queryKey: ["crm-import", "last"], queryFn: getLastCrmImport });
}

export function useUploadCrmExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; onProgress?: (percent: number) => void }) =>
      uploadCrmExcel(args.file, args.onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-import", "last"] });
    },
  });
}

export function useDownloadCrmTemplate() {
  return useMutation({ mutationFn: downloadCrmTemplate });
}
