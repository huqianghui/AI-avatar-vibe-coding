/**
 * SourcesPanel (Phase 32, ANON-04) -- renders grounded-answer citations as a
 * structurally separate sidebar, never merged into the transcript bubble
 * (AI Avatar Domain Rule #6 in CLAUDE.md; T-32-15 in the plan's threat model).
 *
 * Citation links render via plain React text/href (auto-escaped by React,
 * no `dangerouslySetInnerHTML`) with `rel="noopener noreferrer"` on every
 * outbound link -- mitigates citation-URL-injection / reverse-tabnabbing.
 *
 * Locked UI-SPEC rule: neither empty state may use the error/destructive
 * color token -- "no matching source" is a normal, expected outcome, not
 * an error.
 */
import { useTranslation } from "react-i18next";
import { BookOpen, ExternalLink, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface SourcesPanelCitation {
  title: string;
  url: string;
  page: number;
}

export type SourcesPanelStatus =
  | "loading"
  | "populated"
  | "empty-pre-question"
  | "empty-no-match";

interface SourcesPanelProps {
  status: SourcesPanelStatus;
  citations: SourcesPanelCitation[];
  className?: string;
}

const LOADING_SKELETON_COUNT = 3;

export function SourcesPanel({ status, citations, className }: SourcesPanelProps) {
  const { t } = useTranslation("avatar");

  return (
    <div
      className={cn(
        "sticky top-0 flex h-full flex-col gap-3 border-l border-border bg-background p-4",
        className,
      )}
    >
      <h2 className="text-heading font-semibold">{t("sourcesPanel.title")}</h2>

      {status === "loading" && (
        <div className="flex flex-col gap-3" data-testid="sources-panel-loading">
          {Array.from({ length: LOADING_SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      )}

      {status === "populated" && (
        <div className="flex flex-col gap-3">
          {citations.map((citation, idx) => (
            <a
              key={`${citation.url}-${idx}`}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1 rounded-lg border border-border p-4 hover:border-primary/40 hover:bg-accent/5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-base font-semibold">{citation.title}</span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                {t("sourcesPanel.pageBadge", { n: citation.page })}
              </span>
            </a>
          ))}
        </div>
      )}

      {status === "empty-pre-question" && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">{t("sourcesPanel.emptyPreQuestion.heading")}</p>
          <p className="text-sm text-muted-foreground">
            {t("sourcesPanel.emptyPreQuestion.body")}
          </p>
        </div>
      )}

      {status === "empty-no-match" && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">{t("sourcesPanel.emptyNoMatch.heading")}</p>
          <p className="text-sm text-muted-foreground">{t("sourcesPanel.emptyNoMatch.body")}</p>
        </div>
      )}
    </div>
  );
}
