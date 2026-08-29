"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCw,
  X,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import {
  cleanDocumentTitle,
  detectPreviewKind,
  formatFileFormat,
  formatFileSize,
} from "@/lib/documents";
import type { DocumentItem } from "@/types/domain";
import { DocxViewer } from "./docx-viewer";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PreviewDoc = DocumentItem & {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  documentDate?: string;
};

type DocumentPreviewModalProps = {
  open: boolean;
  document: PreviewDoc | null;
  url?: string | null;
  /** Authenticated API path that streams binary content (DOCX). */
  contentUrl?: string | null;
  loading?: boolean;
  error?: string | null;
  contextLine?: string | null;
  onClose: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
};

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
  className,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-[12px] font-medium text-[var(--slate-700)] transition-colors",
        "hover:bg-[var(--slate-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-800)]/30",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function LazyPdfPage({
  pageNumber,
  width,
  rotate,
  prioritize,
}: {
  pageNumber: number;
  width: number;
  rotate: number;
  prioritize?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(Boolean(prioritize) || pageNumber <= 2);
  const placeholderHeight = Math.round(width * 1.414);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { root: el.closest("[data-pdf-scroll]") ?? null, rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      id={`pdf-page-${pageNumber}`}
      data-page={pageNumber}
      className="overflow-hidden rounded-sm bg-white shadow-[0_8px_32px_rgba(0,0,0,.35)]"
      style={{ minHeight: placeholderHeight }}
    >
      {visible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          rotate={rotate}
          renderAnnotationLayer={prioritize}
          renderTextLayer={prioritize}
          loading={
            <div
              className="animate-pulse bg-[#e8eaed]"
              style={{ width, height: placeholderHeight }}
            />
          }
        />
      ) : (
        <div
          className="animate-pulse bg-[#e8eaed]"
          style={{ width, height: placeholderHeight }}
        />
      )}
    </div>
  );
}

function PdfViewer({
  url,
  onDownload,
  onRetry,
}: {
  url: string;
  onDownload?: () => void;
  onRetry?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.max(280, Math.floor(w - 32)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !numPages) return;
    const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-page]"));
    if (!pages.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const n = Number(visible?.target.getAttribute("data-page"));
        if (n) setPage(n);
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    );
    pages.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [numPages, containerWidth, rotation, fitWidth, scale]);

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), numPages || 1);
    setPage(clamped);
    containerRef.current
      ?.querySelector(`#pdf-page-${clamped}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pageWidth = fitWidth ? containerWidth : Math.round(containerWidth * scale);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5">
        <ToolbarButton
          label="Page précédente"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </ToolbarButton>
        <span className="min-w-[4.5rem] px-1 text-center text-[12px] tabular-nums text-[var(--text-muted)]">
          {numPages ? `${page} / ${numPages}` : "— / —"}
        </span>
        <ToolbarButton
          label="Page suivante"
          disabled={!numPages || page >= numPages}
          onClick={() => goToPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton
          label="Zoom arrière"
          onClick={() => {
            setFitWidth(false);
            setScale((s) => Math.max(0.5, Math.round((s - 0.1) * 10) / 10));
          }}
        >
          <Minus className="size-3.5" />
        </ToolbarButton>
        <span className="min-w-[3rem] text-center text-[12px] tabular-nums text-[var(--text-muted)]">
          {Math.round((fitWidth ? 1 : scale) * 100)}%
        </span>
        <ToolbarButton
          label="Zoom avant"
          onClick={() => {
            setFitWidth(false);
            setScale((s) => Math.min(2.5, Math.round((s + 0.1) * 10) / 10));
          }}
        >
          <Plus className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Ajuster à la largeur"
          onClick={() => {
            setFitWidth(true);
            setScale(1);
          }}
        >
          Ajuster
        </ToolbarButton>
        <ToolbarButton
          label="Rotation"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw className="size-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton label="Télécharger" onClick={onDownload}>
          <Download className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Ouvrir dans un nouvel onglet"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="size-3.5" />
        </ToolbarButton>
      </div>

      <div
        ref={containerRef}
        data-pdf-scroll
        className="relative min-h-0 flex-1 overflow-auto bg-[#3a3f46]"
      >
        {loading && !loadError && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#3a3f46]/90">
            <div className="flex items-center gap-2 text-[13px] text-white/80">
              <Loader2 className="size-4 animate-spin" />
              Chargement du document…
            </div>
          </div>
        )}
        {loadError ? (
          <div className="grid h-full place-items-center p-6 text-center text-white/80">
            <div>
              <p className="text-[14px]">Impossible d’afficher ce document.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-md bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20"
                  onClick={() => {
                    if (onRetry) {
                      onRetry();
                      return;
                    }
                    setLoadError(false);
                    setLoading(true);
                  }}
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-[12px] text-[var(--navy-950)]"
                  onClick={onDownload}
                >
                  Télécharger le document
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-4">
            <Document
              file={url}
              loading={null}
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n);
                setLoading(false);
              }}
              onLoadError={() => {
                setLoadError(true);
                setLoading(false);
              }}
            >
              {Array.from({ length: numPages || 0 }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <LazyPdfPage
                    key={pageNumber}
                    pageNumber={pageNumber}
                    width={pageWidth}
                    rotate={rotation}
                    prioritize={pageNumber === page}
                  />
                ),
              )}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageViewer({
  url,
  title,
  onDownload,
  onRetry,
}: {
  url: string;
  title: string;
  onDownload?: () => void;
  onRetry?: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5">
        <ToolbarButton
          label="Zoom arrière"
          onClick={() => setScale((s) => Math.max(0.25, Math.round((s - 0.15) * 100) / 100))}
        >
          <Minus className="size-3.5" />
        </ToolbarButton>
        <span className="min-w-[3rem] text-center text-[12px] tabular-nums text-[var(--text-muted)]">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton
          label="Zoom avant"
          onClick={() => setScale((s) => Math.min(4, Math.round((s + 0.15) * 100) / 100))}
        >
          <Plus className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Ajuster" onClick={() => setScale(1)}>
          Ajuster
        </ToolbarButton>
        <ToolbarButton
          label="Rotation"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw className="size-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton label="Télécharger" onClick={onDownload}>
          <Download className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Ouvrir dans un nouvel onglet"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="size-3.5" />
        </ToolbarButton>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-[#3a3f46]">
        {loading && !error && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="flex items-center gap-2 text-[13px] text-white/80">
              <Loader2 className="size-4 animate-spin" />
              Chargement du document…
            </div>
          </div>
        )}
        {error ? (
          <div className="grid h-full place-items-center p-6 text-center text-white/80">
            <div>
              <p className="text-[14px]">Impossible d’afficher ce document.</p>
              <div className="mt-4 flex justify-center gap-2">
                {onRetry && (
                  <button
                    type="button"
                    className="cursor-pointer rounded-md bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20"
                    onClick={onRetry}
                  >
                    Réessayer
                  </button>
                )}
                <button
                  type="button"
                  className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-[12px] text-[var(--navy-950)]"
                  onClick={onDownload}
                >
                  Télécharger le document
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-full place-items-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={title}
              onLoad={() => setLoading(false)}
              onError={() => {
                setError(true);
                setLoading(false);
              }}
              className="max-h-full max-w-full origin-center object-contain shadow-[0_8px_32px_rgba(0,0,0,.35)] transition-transform"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LegacyDocFallback({
  title,
  date,
  sizeLabel,
  onDownload,
}: {
  title: string;
  date: string;
  sizeLabel: string;
  onDownload?: () => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-[var(--surface-muted)] p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--slate-100)] text-[var(--navy-900)]">
          <FileText className="size-6" />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold text-[var(--navy-950)]">
          {title}
        </h3>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{date}</p>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          DOC{sizeLabel !== "—" ? ` · ${sizeLabel}` : ""}
        </p>
        <p className="mt-4 text-[13px] text-[var(--text)]">
          Ce document utilise l’ancien format Word.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[var(--navy-950)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--navy-900)]"
            onClick={onDownload}
          >
            <Download className="size-3.5" />
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}

function OfficeFallback({
  title,
  date,
  format,
  sizeLabel,
  onDownload,
}: {
  title: string;
  date: string;
  format: string;
  sizeLabel: string;
  url?: string | null;
  onDownload?: () => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-[var(--surface-muted)] p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--slate-100)] text-[var(--navy-900)]">
          <FileText className="size-6" />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold text-[var(--navy-950)]">
          {title}
        </h3>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{date}</p>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          {format}
          {sizeLabel !== "—" ? ` · ${sizeLabel}` : ""}
        </p>
        <p className="mt-4 text-[13px] text-[var(--text)]">
          L’aperçu n’est pas disponible pour ce format.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[var(--navy-950)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--navy-900)]"
            onClick={onDownload}
          >
            <Download className="size-3.5" />
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentPreviewModal({
  open,
  document: doc,
  url = null,
  contentUrl = null,
  loading = false,
  error = null,
  contextLine,
  onClose,
  onRetry,
  onDownload,
}: DocumentPreviewModalProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const title = useMemo(
    () => cleanDocumentTitle(doc?.title ?? "Document"),
    [doc?.title],
  );
  const kind = useMemo(
    () => detectPreviewKind(doc?.fileName, doc?.fileType),
    [doc?.fileName, doc?.fileType],
  );
  const format = formatFileFormat(doc?.fileName, doc?.fileType);
  const sizeLabel = formatFileSize(doc?.fileSize);
  const displayName =
    doc?.fileName && doc.fileName !== "—"
      ? doc.fileName
      : `${title}.${format.toLowerCase()}`;
  const dateLabel = formatDate(doc?.documentDate ?? doc?.date);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setFullscreen(false);
        onClose();
      }
    },
    [onClose],
  );

  const needsUrl = kind === "pdf" || kind === "image";
  const needsContent = kind === "docx";
  const showError =
    Boolean(error) ||
    (needsUrl && !url && !loading) ||
    (needsContent && !contentUrl && !loading);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--navy-950)]/45 data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            "file-preview-dialog fixed z-50 flex flex-col overflow-hidden border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(11,23,40,.18)] outline-none",
            fullscreen
              ? "inset-0 rounded-none"
              : [
                  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  "h-[min(90vh,calc(100vh-48px))] w-[min(1100px,calc(100vw-48px))]",
                  "max-md:h-[calc(100vh-32px)] max-md:w-[calc(100vw-32px)]",
                  "max-sm:inset-0 max-sm:h-full max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
                  "rounded-[var(--radius-lg)]",
                ].join(" "),
          )}
          aria-describedby={undefined}
        >
          <header className="file-preview-chrome flex min-h-[64px] shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 md:px-5">
            <div className="min-w-0 pr-2">
              <Dialog.Title className="truncate text-[15px] font-semibold leading-tight text-[var(--navy-950)]">
                {title}
              </Dialog.Title>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                {dateLabel}
              </p>
              {contextLine ? (
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {contextLine}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ToolbarButton
                label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
                onClick={() => setFullscreen((v) => !v)}
                className="max-sm:hidden"
              >
                {fullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </ToolbarButton>
              <Dialog.Close
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--slate-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-800)]/30"
                aria-label="Fermer"
                title="Fermer"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="grid flex-1 place-items-center bg-[#eceff3]">
                <div className="flex items-center gap-2 text-[13px] text-[var(--slate-700)]">
                  <Loader2 className="size-4 animate-spin" />
                  {kind === "docx"
                    ? "Chargement du document Word…"
                    : "Chargement du document…"}
                </div>
              </div>
            ) : showError ? (
              <div className="grid flex-1 place-items-center bg-[#3a3f46] p-6 text-center text-white/85">
                <div>
                  <p className="text-[14px]">
                    {kind === "docx"
                      ? "Impossible d’afficher ce document Word."
                      : "Impossible d’afficher ce document."}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    {onRetry && (
                      <button
                        type="button"
                        className="cursor-pointer rounded-md bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20"
                        onClick={onRetry}
                      >
                        Réessayer
                      </button>
                    )}
                    <button
                      type="button"
                      className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-[12px] text-[var(--navy-950)]"
                      onClick={onDownload}
                    >
                      Télécharger le document
                    </button>
                  </div>
                </div>
              </div>
            ) : kind === "pdf" && url ? (
              <PdfViewer key={url} url={url} onDownload={onDownload} onRetry={onRetry} />
            ) : kind === "image" && url ? (
              <ImageViewer
                key={url}
                url={url}
                title={title}
                onDownload={onDownload}
                onRetry={onRetry}
              />
            ) : kind === "docx" && contentUrl ? (
              <DocxViewer
                key={contentUrl}
                contentUrl={contentUrl}
                onDownload={onDownload}
                onRetry={onRetry}
              />
            ) : kind === "doc" ? (
              <LegacyDocFallback
                title={title}
                date={dateLabel}
                sizeLabel={sizeLabel}
                onDownload={onDownload}
              />
            ) : (
              <OfficeFallback
                title={title}
                date={dateLabel}
                format={format}
                sizeLabel={sizeLabel}
                onDownload={onDownload}
              />
            )}
          </div>

          <footer className="file-preview-chrome flex h-10 shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] bg-white px-4 text-[12px] text-[var(--text-muted)]">
            <span className="truncate">
              {displayName}
              {sizeLabel !== "—" ? ` · ${sizeLabel}` : ""}
            </span>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-[var(--navy-900)] hover:underline"
              onClick={onDownload}
            >
              <Download className="size-3.5" />
              Télécharger
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
