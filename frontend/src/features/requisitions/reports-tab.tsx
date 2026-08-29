"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRequisitionReportsQueryKey, useGetRequisitionReports } from "@/generated/api/naala";
import type { DocumentItem, ReportItem, Requisition } from "@/types/domain";
import { Card, Dialog, EmptyState, Skeleton, StatusBadge } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { FilePreviewDialog } from "@/components/documents/file-preview-dialog";
import { getReportContentUrl } from "@/lib/api/binary";
import {
  getReportDownloadUrl,
  getReportPreviewUrl,
} from "@/lib/api/reports";
import { detectPreviewKind, formatFileSize } from "@/lib/documents";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { addReportVersion, createReport, publishReport, rejectReport, submitReport, validateReport } from "@/lib/api/phase-b";
import { Check, Download, Eye, FilePlus2, FileText, Send, Upload } from "lucide-react";
import { toast } from "sonner";

function toPreviewDocument(report: ReportItem): DocumentItem {
  return {
    id: report.openDocumentId ?? report.documentId ?? report.id,
    requisitionId: report.requisitionId,
    title: report.title,
    category: "Rapports",
    version: report.version,
    date: report.reportDate ?? report.generatedAt,
    documentDate: report.reportDate ?? report.generatedAt,
    uploadedBy: report.uploadedBy ?? report.generatedBy,
    status: "Disponible",
    analysis: "",
    quality: "Bonne",
    fileName: report.originalFilename ?? report.fileName ?? undefined,
    fileType: report.mimeType ?? report.fileType ?? undefined,
    fileSize: report.fileSize ?? undefined,
  };
}

export function ReportsTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useGetRequisitionReports(r.id);
  const reports = (data?.data ?? []) as unknown as ReportItem[];

  const [preview, setPreview] = useState<ReportItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionFor, setVersionFor] = useState<ReportItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const previewRequestId = useRef(0);

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

  if (isLoading) return <Skeleton className="h-56" />;
  const refresh = () => qc.invalidateQueries({ queryKey: getGetRequisitionReportsQueryKey(r.id) });
  const transition = async (report: ReportItem, action: (id: string) => Promise<unknown>, success: string) => { setBusyId(report.id); try { await action(report.id); await refresh(); toast.success(success); } catch { toast.error("Action impossible"); } finally { setBusyId(null); } };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h2 className="text-[17px] font-semibold text-[var(--navy-950)]">
          Rapports de {r.number}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {r.property} — séparés des documents du dossier.
        </p>
        </div>
        {admin && <Button size="sm" onClick={() => setCreateOpen(true)}><FilePlus2 className="size-4" /> Créer un rapport</Button>}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title={admin ? "Aucun rapport enregistré" : "Aucun rapport publié"}
          description={admin ? "Créez un premier brouillon pour ce terrain." : "Aucun rapport publié pour ce dossier."}
        />
      ) : (
        <Card className="overflow-hidden divide-y divide-[var(--border)]">
          {reports.map((report) => {
            const hasFile = Boolean(
              report.hasFile ?? report.canDownload ?? report.documentId,
            );
            const dateLabel = formatDate(
              report.reportDate ?? report.generatedAt,
            );

            return (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-[var(--text-faint)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--navy-950)]">
                      {report.title}
                    </p>
                    {admin && <div className="mt-1"><StatusBadge status={report.status} /></div>}
                    {hasFile ? (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        {dateLabel}
                        {report.fileSize
                          ? ` · ${formatFileSize(report.fileSize)}`
                          : ""}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                        Fichier du rapport indisponible
                      </p>
                    )}
                  </div>
                </div>
                {hasFile ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() => void openReport(report)}
                      aria-label="Ouvrir le rapport"
                    >
                      <Eye className="size-3.5" />
                      Ouvrir
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => void downloadReport(report)}
                      aria-label="Télécharger le rapport"
                    >
                      <Download className="size-3.5" />
                      Télécharger
                    </Button>
                  </div>
                ) : null}
                {admin && <div className="flex flex-wrap gap-2">{(report.statusCode === "BROUILLON" || report.statusCode === "REJETE") && <><Button size="sm" variant="secondary" onClick={() => setVersionFor(report)}><FilePlus2 className="size-4" /> Version</Button><Button size="sm" disabled={busyId === report.id} onClick={() => void transition(report, submitReport, "Rapport soumis") }><Send className="size-4" /> Soumettre</Button></>}{report.statusCode === "A_VALIDER" && <><Button size="sm" disabled={busyId === report.id} onClick={() => void transition(report, validateReport, "Rapport validé") }><Check className="size-4" /> Valider</Button><Button size="sm" variant="secondary" disabled={busyId === report.id} onClick={() => void transition(report, rejectReport, "Rapport rejeté")}>Rejeter</Button></>}{report.statusCode === "VALIDE" && <Button size="sm" disabled={busyId === report.id} onClick={() => void transition(report, publishReport, "Rapport publié") }><Upload className="size-4" /> Publier</Button>}</div>}
              </div>
            );
          })}
        </Card>
      )}

      <FilePreviewDialog
        open={!!preview}
        document={preview ? toPreviewDocument(preview) : null}
        url={previewUrl}
        contentUrl={contentUrl}
        loading={previewLoading}
        error={previewError}
        contextLine={`${r.number} — ${r.property}`}
        onClose={closePreview}
        onRetry={() => preview && void openReport(preview)}
        onDownload={() => preview && void downloadReport(preview)}
      />
      <CreateReportDialog open={createOpen} close={() => setCreateOpen(false)} requisitionId={r.id} saved={refresh} />
      <VersionDialog report={versionFor} close={() => setVersionFor(null)} saved={refresh} />
    </div>
  );
}

function CreateReportDialog({ open, close, requisitionId, saved }: { open: boolean; close: () => void; requisitionId: string; saved: () => Promise<unknown> }) {
  const [title, setTitle] = useState(""); const [reportType, setReportType] = useState(""); const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={(value) => !value && close()} title="Créer un rapport"><form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); setBusy(true); try { await createReport({ requisitionId, title, reportType }); await saved(); close(); toast.success("Brouillon créé"); } catch { toast.error("Création impossible"); } finally { setBusy(false); } }}><label className="text-xs font-medium">Titre<input required className="nf-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="text-xs font-medium">Type<input required className="nf-input mt-1" value={reportType} onChange={(e) => setReportType(e.target.value)} /></label><Button disabled={busy} type="submit">Créer le brouillon</Button></form></Dialog>;
}

function VersionDialog({ report, close, saved }: { report: ReportItem | null; close: () => void; saved: () => Promise<unknown> }) {
  const [content, setContent] = useState(""); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  return <Dialog open={!!report} onOpenChange={(value) => !value && close()} title="Ajouter une version" description={report?.title}><form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); if (!report) return; setBusy(true); try { await addReportVersion(report.id, { contentJson: { content }, generatedBy: "Saisie manuelle", sourceCount: 0, notes: notes || undefined }); await saved(); close(); toast.success("Version ajoutée"); } catch { toast.error("Ajout impossible"); } finally { setBusy(false); } }}><label className="text-xs font-medium">Contenu<textarea required className="nf-input mt-1 min-h-40" value={content} onChange={(e) => setContent(e.target.value)} /></label><label className="text-xs font-medium">Notes de version<textarea className="nf-input mt-1 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} /></label><Button disabled={busy} type="submit">Ajouter la version</Button></form></Dialog>;
}
