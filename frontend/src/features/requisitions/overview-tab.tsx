"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  useGetRequisitionDocuments,
  useGetRequisitionLegalCases,
  useGetRequisitionReports,
} from "@/generated/api/naala";
import type { DocumentItem, ReportItem, Requisition } from "@/types/domain";
import { Skeleton } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { FilePreviewDialog } from "@/components/documents/file-preview-dialog";
import { getReportContentUrl } from "@/lib/api/binary";
import {
  getReportDownloadUrl,
  getReportPreviewUrl,
} from "@/lib/api/reports";
import { useAuth } from "@/providers/auth-provider";
import { detectPreviewKind } from "@/lib/documents";
import { formatDate } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { JudicialPanel } from "./overview/judicial-panel";
import { OverviewEditDialog } from "./overview/overview-edit-dialog";
import { PointsToClarify } from "./overview/points-to-clarify";
import { RecentDocumentRow } from "./overview/recent-document-row";
import { ReportSummaryCard } from "./overview/report-summary-card";
import { SituationPanel } from "./overview/situation-panel";

type CourtCase = {
  id: string;
  number: string;
  court: string;
};

function isBlockedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("bloqu") || s.includes("incomplet");
}

function shortExplanation(text: string | null | undefined, max = 160): string {
  if (!text?.trim()) return "Situation à renseigner.";
  const trimmed = text.trim().replace(/\s+/g, " ");
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  let sentence = (match?.[1] ?? trimmed).trim();
  if (sentence.length > max) sentence = `${sentence.slice(0, max - 1).trim()}…`;
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

export function OverviewTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const docsQuery = useGetRequisitionDocuments(r.id);
  const casesQuery = useGetRequisitionLegalCases(r.id);
  const reportsQuery = useGetRequisitionReports(r.id);

  const [preview, setPreview] = useState<ReportItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestId = useRef(0);

  const docs = ((docsQuery.data?.data ?? []) as DocumentItem[]).filter(
    (d) => String(d.category ?? "").toUpperCase() !== "RAPPORTS",
  );
  const cases = (casesQuery.data?.data ?? []) as unknown as CourtCase[];
  const reports = (reportsQuery.data?.data ?? []) as unknown as ReportItem[];

  const loading =
    docsQuery.isLoading || casesQuery.isLoading || reportsQuery.isLoading;

  if (loading) return <Skeleton className="h-72" />;

  const recentDocs = [...docs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const availableReport =
    reports.find((x) => x.documentId || x.hasFile || x.canDownload) ??
    reports[0];

  const points = (
    r.pointsToClarify?.length
      ? r.pointsToClarify
      : (r.constraints ?? r.criticalDetails ?? [])
  ).slice(0, 4);

  const caseNumbers =
    r.tribunalCases?.length > 0
      ? r.tribunalCases
      : cases.map((c) => c.number).filter(Boolean);

  const today = new Date().toISOString().slice(0, 10);
  const rawNext = r.nextScheduledEventAt ?? null;
  const nextDate = rawNext && rawNext >= today ? rawNext : null;

  const statusLabel = r.status || "À confirmer";
  const explanation = shortExplanation(r.currentSituation ?? r.issue);
  const latestEvent =
    r.latestKnownEvent ?? r.event ?? "Aucun événement confirmé";
  const latestEventDate = r.latestKnownEventAt ?? null;

  const judicialEvent =
    r.latestJudicialEvent ??
    (r.courtReached === "Non" ? null : r.latestKnownEvent ?? null);
  const judicialEventDate =
    r.latestJudicialEventAt ??
    (r.courtReached === "Non" ? null : r.latestKnownEventAt ?? null);
  const judicialResult =
    r.judicialResult ??
    r.eventResult ??
    (r.courtReached === "Non"
      ? "Aucun événement judiciaire confirmé"
      : null);

  const freshness =
    r.dataFreshness ??
    (r.courtReached === "Non"
      ? "Aucun événement judiciaire confirmé"
      : "Situation à actualiser");

  const openReport = async (report: ReportItem) => {
    if (!report.canDownload && !report.hasFile && !report.documentId) {
      toast.error("Fichier du rapport indisponible");
      return;
    }
    const requestId = ++previewRequestId.current;
    const kind = detectPreviewKind(
      report.originalFilename ?? report.fileName,
      report.mimeType ?? report.fileType,
    );

    setPreview(report);
    setPreviewUrl(null);
    setContentUrl(null);
    setPreviewError(null);

    if (kind === "docx") {
      setContentUrl(getReportContentUrl(report.id));
      setPreviewLoading(false);
      return;
    }
    if (kind === "doc") {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await getReportPreviewUrl(report.id);
      if (requestId !== previewRequestId.current) return;
      const url = response.data?.url;
      if (!url) throw new Error("URL manquante");
      setPreviewUrl(url);
    } catch {
      if (requestId !== previewRequestId.current) return;
      setPreviewError("Impossible d’ouvrir ce rapport.");
    } finally {
      if (requestId === previewRequestId.current) {
        setPreviewLoading(false);
      }
    }
  };

  const closePreview = () => {
    previewRequestId.current += 1;
    setPreview(null);
    setPreviewUrl(null);
    setContentUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const downloadReport = async (report: ReportItem) => {
    if (!report.canDownload && !report.documentId) {
      toast.error("Fichier du rapport indisponible");
      return;
    }
    try {
      const response = await getReportDownloadUrl(report.id);
      const url = response.data?.url;
      if (!url) throw new Error("URL manquante");
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.data?.originalFilename ??
        report.originalFilename ??
        "rapport.docx";
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Téléchargement impossible");
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <SituationPanel
          statusLabel={statusLabel}
          explanation={explanation}
          latestEvent={latestEvent}
          latestEventDate={
            latestEventDate ? formatDate(latestEventDate) : null
          }
          eventResult={r.eventResult}
          platformUpdatedAt={formatDate(r.lastUpdate.slice(0, 10))}
          blocked={isBlockedStatus(statusLabel)}
          actions={
            admin ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
                Modifier
              </Button>
            ) : null
          }
        />
        <JudicialPanel
          reachedCourt={r.courtReached ?? "Transmission à confirmer"}
          caseNumbers={caseNumbers}
          latestEvent={judicialEvent}
          latestEventDate={
            judicialEventDate ? formatDate(judicialEventDate) : null
          }
          result={judicialResult}
          nextDate={nextDate ? formatDate(nextDate) : null}
          freshness={freshness}
        />
      </div>

      <section>
        <h2 className="mb-3 text-[17px] font-semibold text-[var(--navy-950)]">
          Points à clarifier
        </h2>
        <PointsToClarify items={points} />
      </section>

      <section className="border-t border-[var(--border)] pt-8">
        <div className="grid gap-8 lg:grid-cols-[1.65fr_1fr]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold text-[var(--navy-950)]">
                Documents récents
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="?tab=documents">Voir tous</Link>
              </Button>
            </div>
            {recentDocs.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Aucun document déposé.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentDocs.map((d) => (
                  <RecentDocumentRow
                    key={d.id}
                    id={d.id}
                    title={d.title}
                    category={d.category}
                    date={d.date}
                    href="?tab=documents"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-[17px] font-semibold text-[var(--navy-950)]">
              Rapport disponible
            </h2>
            {!availableReport ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Aucun rapport enregistré.
              </p>
            ) : (
              <ReportSummaryCard
                title={availableReport.title}
                version={availableReport.version}
                date={
                  availableReport.reportDate ?? availableReport.generatedAt
                }
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
                fileName:
                  preview.originalFilename ?? preview.fileName ?? undefined,
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
