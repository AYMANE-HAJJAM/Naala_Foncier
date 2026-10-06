"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportItem } from "@/types/domain";
import { getReportContentUrl } from "@/lib/api/binary";
import { uiErrorMessage } from "@/lib/api/error-message";
import { getReportDownloadUrl, getReportPreviewUrl } from "@/lib/api/reports";
import { detectPreviewKind } from "@/lib/documents";

export function useReportPreview() {
  const [preview, setPreview] = useState<ReportItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const closePreview = useCallback(() => {
    requestIdRef.current += 1;
    setPreview(null);
    setPreviewUrl(null);
    setContentUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

  const openReport = useCallback(async (report: ReportItem) => {
    if (!report.canDownload && !report.hasFile && !report.documentId) {
      toast.error("Fichier du rapport indisponible");
      return;
    }

    const requestId = ++requestIdRef.current;
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
      if (requestId !== requestIdRef.current) return;
      const url = response.data?.url;
      if (!url) throw new Error("URL manquante");
      setPreviewUrl(url);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setPreviewError(uiErrorMessage(error, "Impossible d’ouvrir ce rapport."));
    } finally {
      if (requestId === requestIdRef.current) setPreviewLoading(false);
    }
  }, []);

  const downloadReport = useCallback(async (report: ReportItem) => {
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
        response.data?.originalFilename ?? report.originalFilename ?? "rapport.docx";
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(uiErrorMessage(error, "Téléchargement impossible"));
    }
  }, []);

  return {
    closePreview,
    contentUrl,
    downloadReport,
    openReport,
    preview,
    previewError,
    previewLoading,
    previewUrl,
  };
}
