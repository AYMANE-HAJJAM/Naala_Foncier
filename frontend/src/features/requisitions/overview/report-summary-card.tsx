import { Download, Eye, FileChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type ReportSummaryCardProps = {
  title: string;
  version?: string | null;
  date?: string | null;
  onOpen: () => void;
  onDownload?: () => void;
  canDownload?: boolean;
};

export function ReportSummaryCard({
  title,
  version,
  date,
  onOpen,
  onDownload,
  canDownload,
}: ReportSummaryCardProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <FileChartColumn
          className="mt-0.5 size-4 shrink-0 text-[var(--navy-800)]"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[var(--navy-950)]">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {[version, date ? formatDate(date) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          <Eye className="size-3.5" />
          Ouvrir
        </Button>
        {canDownload && onDownload ? (
          <Button size="sm" variant="secondary" onClick={onDownload}>
            <Download className="size-3.5" />
            Télécharger
          </Button>
        ) : null}
      </div>
    </div>
  );
}
