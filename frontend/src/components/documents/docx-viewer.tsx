"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { renderAsync } from "docx-preview";
import {
  Download,
  Loader2,
  Minus,
  Plus,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBinary } from "@/lib/api/binary";

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

type DocxViewerProps = {
  contentUrl: string;
  onDownload?: () => void;
  onRetry?: () => void;
};

export function DocxViewer({ contentUrl, onDownload, onRetry }: DocxViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    try {
      const buffer = await fetchBinary(contentUrl, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const host = hostRef.current;
      if (!host) return;
      host.innerHTML = "";
      await renderAsync(buffer, host, undefined, {
        className: "docx-naala",
        inWrapper: true,
        hideWrapperOnPrint: true,
        ignoreWidth: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true,
      });
      if (!controller.signal.aborted) setLoading(false);
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        return;
      }
      setError(true);
      setLoading(false);
    }
  }, [contentUrl]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [load, reloadKey]);

  const handlePrint = () => {
    const host = hostRef.current;
    if (!host) return;
    document.body.classList.add("printing-docx");
    const cleanup = () => {
      document.body.classList.remove("printing-docx");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Fallback if afterprint is delayed
    window.setTimeout(cleanup, 1000);
  };

  const displayScale = fitWidth ? 1 : scale;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="file-preview-chrome flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5">
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
          {Math.round(displayScale * 100)}%
        </span>
        <ToolbarButton
          label="Zoom avant"
          onClick={() => {
            setFitWidth(false);
            setScale((s) => Math.min(2, Math.round((s + 0.1) * 10) / 10));
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
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton label="Imprimer" onClick={handlePrint}>
          <Printer className="size-3.5" />
          <span className="hidden sm:inline">Imprimer</span>
        </ToolbarButton>
        <ToolbarButton label="Télécharger l’original" onClick={onDownload}>
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Télécharger</span>
        </ToolbarButton>
      </div>

      <div
        ref={scrollRef}
        className="docx-viewer-scroll relative min-h-0 flex-1 overflow-auto bg-[#eceff3]"
      >
        {loading && !error && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#eceff3]/92">
            <div className="flex items-center gap-2 text-[13px] text-[var(--slate-700)]">
              <Loader2 className="size-4 animate-spin" />
              Chargement du document Word…
            </div>
          </div>
        )}
        {error ? (
          <div className="grid h-full place-items-center p-6 text-center text-[var(--slate-700)]">
            <div>
              <p className="text-[14px]">Impossible d’afficher ce document Word.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] hover:bg-[var(--surface-muted)]"
                  onClick={() => {
                    if (onRetry) onRetry();
                    else setReloadKey((k) => k + 1);
                  }}
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-md bg-[var(--navy-950)] px-3 py-1.5 text-[12px] text-white"
                  onClick={onDownload}
                >
                  Télécharger le rapport
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center p-4 sm:p-6">
            <div
              className="docx-print-root origin-top transition-transform"
              style={{
                transform: `scale(${displayScale})`,
                width: fitWidth ? "min(100%, 816px)" : "816px",
              }}
            >
              <div
                ref={hostRef}
                className="docx-host [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx]:mb-6 [&_.docx]:shadow-[0_8px_28px_rgba(15,23,42,.18)]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
