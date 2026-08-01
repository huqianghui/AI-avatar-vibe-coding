export interface CrmImportRowIssue {
  row: number;
  reason: string;
  email?: string;
}

export interface CrmImportResult {
  success_count: number;
  skipped: CrmImportRowIssue[];
  unmatched: CrmImportRowIssue[];
}

export interface CrmImportLog extends CrmImportResult {
  id: string;
  filename: string;
  imported_by: string;
  created_at: string;
}
