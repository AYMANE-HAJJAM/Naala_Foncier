"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileStack,
  Gavel,
  Pencil,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useGetRequisitionDocuments,
  useGetRequisitionEvents,
  useGetRequisitionLegalCases,
  useGetRequisitionReports,
} from "@/generated/api/naala";
import type { DocumentItem, ReportItem, Requisition } from "@/types/domain";
import { Skeleton } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { FilePreviewDialog } from "@/components/documents/file-preview-dialog";
import { useAuth } from "@/providers/auth-provider";
import { cn, formatDate } from "@/lib/utils";
import { OverviewEditDialog } from "./overview/overview-edit-dialog";
import { RecentDocumentRow } from "./overview/recent-document-row";
import { ReportSummaryCard } from "./overview/report-summary-card";
import { isDateOnOrAfterToday } from "@/lib/domain/date";
import { useReportPreview } from "./reports/use-report-preview";

type CourtCase = {
  id: string;
  number: string;
  court: string;
};

type TerrainEvent = {
  id: string;
  title: string;
  occurredAt: string;
};

type VerificationItem = {
  label: string;
  status: "À vérifier" | "À compléter";
};

function shortLine(text: string | null | undefined, max = 105) {
  if (!text?.trim()) return null;
  const compact = text.trim().replace(/\s+/g, " ");
  const sentence = compact.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? compact;
  return sentence.length > max
    ? `${sentence.slice(0, max - 1).trim()}…`
    : sentence;
}

function uniqueLines(values: Array<string | null | undefined>, max = 4) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const line = shortLine(value);
    if (!line) continue;
    const key = line.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
    if (result.length === max) break;
  }
  return result;
}

function QuickIndicator({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <section className="relative min-h-[112px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-4 py-4 shadow-[var(--shadow-xs)] sm:px-5">
      <span className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[var(--navy-800)]" />
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-muted)] text-[var(--navy-800)]">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-1.5 text-[15px] font-semibold leading-5 text-[var(--navy-950)] line-clamp-2">
            {value}
          </p>
          {detail ? (
            <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)] line-clamp-1">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OverviewTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const docsQuery = useGetRequisitionDocuments(r.id);
  const casesQuery = useGetRequisitionLegalCases(r.id);
  const reportsQuery = useGetRequisitionReports(r.id);
  const eventsQuery = useGetRequisitionEvents(r.id);

  const {
    closePreview,
    contentUrl,
    downloadReport,
    openReport,
    preview,
    previewError,
    previewLoading,
    previewUrl,
  } = useReportPreview();

  const docs = ((docsQuery.data?.data ?? []) as DocumentItem[]).filter(
    (document) => String(document.category ?? "").toUpperCase() !== "RAPPORTS",
  );
  const cases = (casesQuery.data?.data ?? []) as unknown as CourtCase[];
  const reports = (reportsQuery.data?.data ?? []) as unknown as ReportItem[];
  const events = (eventsQuery.data?.data ?? []) as unknown as TerrainEvent[];

  const loading =
    docsQuery.isLoading ||
    casesQuery.isLoading ||
    reportsQuery.isLoading ||
    eventsQuery.isLoading;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  const recentDocs = [...docs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const availableReport =
    reports.find((report) =>
      Boolean(report.documentId || report.hasFile || report.canDownload),
    ) ?? reports[0];

  const caseNumbers =
    r.tribunalCases?.length > 0
      ? r.tribunalCases
      : cases.map((courtCase) => courtCase.number).filter(Boolean);
  const nextDate = isDateOnOrAfterToday(r.nextScheduledEventAt)
    ? r.nextScheduledEventAt
    : null;

  const takeaways = uniqueLines([
    r.currentSituation ?? r.issue,
    r.mainConstraint,
    ...(r.constraints ?? []),
    r.eventResult,
    ...(r.criticalDetails ?? []),
  ]);

  const verificationItems: VerificationItem[] = [
    ...(r.pointsToClarify ?? []).map((label) => ({
      label,
      status: "À vérifier" as const,
    })),
    ...(r.missingDocuments ?? []).map((label) => ({
      label,
      status: "À compléter" as const,
    })),
  ].slice(0, 4);

  const recentEvents = [...events]
    .filter((event) => Boolean(event.title && event.occurredAt))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 3);
  const fallbackEvent =
    recentEvents.length === 0 && r.latestKnownEvent
      ? {
          id: "latest-known",
          title: r.latestKnownEvent,
          occurredAt: r.latestKnownEventAt ?? r.lastUpdate,
        }
      : null;
  const timeline = fallbackEvent ? [fallbackEvent] : recentEvents;

  const judicialState = r.courtReached ?? "À confirmer";
  const judicialNumber = caseNumbers[0] ?? "Non confirmé";
  const latestJudicialDate = r.latestJudicialEventAt ?? r.latestKnownEventAt;
  const statusLabel = r.status || "À confirmer";
  const oppositionLabel = `${r.oppositionCount ?? 0} opposition${r.oppositionCount === 1 ? "" : "s"}`;
  const documentLabel = `${docs.length} document${docs.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <section aria-labelledby="essential-status-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="essential-status-title"
            className="text-[15px] font-semibold text-[var(--navy-950)]"
          >
            Indicateurs essentiels
          </h2>
          <span className="text-[11px] text-[var(--text-faint)]">
            Mis à jour le {formatDate(r.lastUpdate.slice(0, 10))}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickIndicator
            icon={CheckCircle2}
            label="Situation actuelle"
            value={statusLabel}
          />
          <QuickIndicator
            icon={Gavel}
            label="Situation judiciaire"
            value={judicialState}
            detail={caseNumbers.length ? `Affaire ${judicialNumber}` : "Aucun n° confirmé"}
          />
          <QuickIndicator
            icon={CalendarDays}
            label="Prochaine échéance"
            value={nextDate ? formatDate(nextDate) : "Aucune date programmée"}
          />
          <QuickIndicator
            icon={FileStack}
            label="Dossier"
            value={oppositionLabel}
            detail={documentLabel}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-xs)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
              À retenir
            </h2>
            {admin ? (
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" />
                Modifier
              </Button>
            ) : null}
          </div>
          {takeaways.length ? (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {takeaways.map((fact) => (
                <li key={fact} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-0">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span className="text-[13px] font-medium leading-5 text-[var(--text)]">
                    {fact}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--text-muted)]">
              Aucun élément de synthèse renseigné.
            </p>
          )}
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[linear-gradient(145deg,var(--surface-muted),#fff)] p-5 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-2.5">
            <span className="nf-icon-box bg-white">
              <Gavel className="size-4" aria-hidden />
            </span>
            <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
              Situation judiciaire
            </h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
            {[
              ["État", judicialState],
              ["N° affaire", judicialNumber],
              [
                "Dernière date connue",
                latestJudicialDate ? formatDate(latestJudicialDate) : "Non renseignée",
              ],
              [
                "Prochaine date",
                nextDate ? formatDate(nextDate) : "Aucune date programmée",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-[var(--text-muted)]">{label}</dt>
                <dd className="mt-1 text-[13px] font-semibold leading-5 text-[var(--navy-950)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2">
            <Link href="?tab=judiciaire">
              Voir le suivi judiciaire
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-2.5">
            <Clock3 className="size-4 text-[var(--navy-800)]" aria-hidden />
            <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
              Derniers événements
            </h2>
          </div>
          {timeline.length ? (
            <ol className="relative mt-3 space-y-0 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-[var(--border)]">
              {timeline.map((event) => (
                <li key={event.id} className="relative py-2.5 pl-6">
                  <span className="absolute left-0 top-[15px] size-[11px] rounded-full border-[3px] border-white bg-[var(--navy-800)] shadow-[0_0_0_1px_var(--border)]" />
                  <time className="text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                    {formatDate(event.occurredAt)}
                  </time>
                  <p className="mt-0.5 text-[13px] font-semibold leading-5 text-[var(--navy-950)] line-clamp-2">
                    {event.title}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--text-muted)]">
              Aucun événement confirmé.
            </p>
          )}
          <Button asChild variant="ghost" size="sm" className="mt-2 -ml-2">
            <Link href="?tab=historique">
              Voir tout l’historique
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </section>

        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-xs)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
              À vérifier / à compléter
            </h2>
          </div>
          {verificationItems.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {verificationItems.map((item) => (
                <li key={`${item.status}-${item.label}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-muted)] text-[var(--navy-800)]">
                    <CircleHelp className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-[var(--text)] line-clamp-2">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      item.status === "À compléter"
                        ? "border-amber-200 bg-amber-50 text-[var(--warning)]"
                        : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
                    )}
                  >
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-5 text-[13px] text-[var(--text-muted)]">
              Aucun point ouvert n’est enregistré.
            </p>
          )}
        </section>
      </div>

      <section className="grid gap-5 border-t border-[var(--border)] pt-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-xs)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
            <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
              Documents récents
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="?tab=documents">Voir tous</Link>
            </Button>
          </div>
          {recentDocs.length === 0 ? (
            <p className="px-5 py-5 text-[13px] text-[var(--text-muted)]">
              Aucun document déposé.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)] px-5">
              {recentDocs.map((document) => (
                <RecentDocumentRow
                  key={document.id}
                  id={document.id}
                  title={document.title}
                  category={document.category}
                  date={document.date}
                  href="?tab=documents"
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-xs)]">
          <div className="border-b border-[var(--border)] px-5 py-3.5">
            <h2 className="text-[16px] font-semibold text-[var(--navy-950)]">
              Rapport disponible
            </h2>
          </div>
          <div className="p-5">
            {!availableReport ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Aucun rapport enregistré.
              </p>
            ) : (
              <ReportSummaryCard
                title={availableReport.title}
                version={availableReport.version}
                date={availableReport.reportDate ?? availableReport.generatedAt}
                onOpen={() => void openReport(availableReport)}
                onDownload={() => void downloadReport(availableReport)}
                canDownload={Boolean(
                  availableReport.canDownload ??
                    availableReport.hasFile ??
                    availableReport.documentId,
                )}
              />
            )}
          </div>
        </div>
      </section>

      {admin && editOpen ? (
        <OverviewEditDialog
          key={`${r.id}:${r.lastUpdate}`}
          r={r}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}

      <FilePreviewDialog
        open={Boolean(preview)}
        document={
          preview
            ? {
                id: preview.openDocumentId ?? preview.documentId ?? preview.id,
                requisitionId: preview.requisitionId,
                title: preview.title,
                category: "Rapports",
                version: preview.version,
                date: preview.reportDate ?? preview.generatedAt,
                documentDate: preview.reportDate ?? preview.generatedAt,
                uploadedBy: preview.uploadedBy ?? preview.generatedBy ?? "",
                status: "Disponible",
                analysis: "",
                quality: "Bonne",
                fileName: preview.originalFilename ?? preview.fileName ?? undefined,
                fileType: preview.mimeType ?? preview.fileType ?? undefined,
                fileSize: preview.fileSize ?? undefined,
              }
            : null
        }
        url={previewUrl}
        contentUrl={contentUrl}
        loading={previewLoading}
        error={previewError}
        contextLine={`${r.number} — ${r.property}`}
        onClose={closePreview}
        onRetry={() => preview && void openReport(preview)}
        onDownload={() => preview && void downloadReport(preview)}
      />
    </div>
  );
}
