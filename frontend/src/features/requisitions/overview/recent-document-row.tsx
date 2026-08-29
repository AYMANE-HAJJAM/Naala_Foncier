import Link from "next/link";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cleanDocumentTitle } from "@/lib/documents";

type RecentDocumentRowProps = {
  id: string;
  title: string;
  category: string;
  date: string;
  href: string;
};

export function RecentDocumentRow({
  title,
  category,
  date,
  href,
}: RecentDocumentRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-2.5 transition hover:bg-[var(--surface-muted)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--navy-800)]/25"
    >
      <FileText className="size-4 shrink-0 text-[var(--navy-800)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--navy-950)]">
          {cleanDocumentTitle(title)}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          {category} · {formatDate(date)}
        </p>
      </div>
      <span className="shrink-0 text-[12px] font-medium text-[var(--navy-900)]">
        Ouvrir
      </span>
    </Link>
  );
}
