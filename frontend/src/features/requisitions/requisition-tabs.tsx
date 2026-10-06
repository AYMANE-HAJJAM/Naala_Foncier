"use client";
import { useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileSearch,
  Pencil,
  Plus,
  Scale,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCompleteDocumentUploadSession,
  useCreateDocumentUploadSession,
  useGetRequisitionDocuments,
  useGetRequisitionOppositions,
  useRequestClearerDocumentCopy,
  useValidateDocument,
  getGetRequisitionDocumentsQueryKey,
  getGetRequisitionOppositionsQueryKey,
} from "@/generated/api/naala";
import {
  maxUploadBytes,
  mimeFromName,
  toDocumentCategory,
} from "@/lib/api/mappers";
import { uiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/providers/auth-provider";
import {
  createOpposition,
  deleteOpposition,
  updateOpposition,
} from "@/lib/api/phase-b";
import type { DocumentItem, Opposition, Requisition } from "@/types/domain";
import { Card, Dialog, Skeleton, StatusBadge } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import {
  cleanDocumentTitle,
  detectPreviewKind,
  formatFileFormat,
  formatFileSize,
} from "@/lib/documents";
import { getDocumentContentUrl } from "@/lib/api/binary";
import { DocumentCategoryCard } from "@/components/shared/primitives";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  DOCUMENT_CATEGORIES,
  customCategoryViewKey,
  matchesDocumentCategory as matchCategory,
  parseCustomCategoryView,
} from "@/lib/domain/document-categories";

export { OverviewTab } from "./overview-tab";

export function DocumentsTab({
  r,
  onAdd,
}: {
  r: Requisition;
  onAdd?: (categoryKey?: string) => void;
}) {
  const qc = useQueryClient();
  const { data } = useGetRequisitionDocuments(r.id);
  const docs = ((data?.data ?? []) as DocumentItem[]).filter(
    (d) => String(d.category ?? "").toUpperCase() !== "RAPPORTS",
  );
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tous");
  const [categoryView, setCategoryView] = useState<string | null>(null);
  const previewRequestId = useRef(0);
  const validateMutation = useValidateDocument();
  const clearerMutation = useRequestClearerDocumentCopy();
  const canMutate = Boolean(onAdd);
  const visible =
    filter === "Tous" ? docs : docs.filter((d) => d.status === filter);

  const openPreview = async (doc: DocumentItem) => {
    const requestId = ++previewRequestId.current;
    setPreview(doc);
    setPreviewUrl(null);
    setContentUrl(null);
    setPreviewError(null);
    if (doc.status === "Manquant") {
      setPreviewError("Document manquant — aucun fichier stocké");
      return;
    }

    const kind = detectPreviewKind(doc.fileName, doc.fileType);
    if (kind === "docx") {
      setContentUrl(getDocumentContentUrl(doc.id));
      setPreviewLoading(false);
      return;
    }
    if (kind === "doc") {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    try {
      const { getDocumentPreviewUrl } = await import("@/generated/api/naala");
      const response = await getDocumentPreviewUrl(doc.id);
      if (requestId !== previewRequestId.current) return;
      const url = (response.data as { url?: string } | undefined)?.url;
      if (!url) throw new Error("URL manquante");
      setPreviewUrl(url);
    } catch (error) {
      if (requestId !== previewRequestId.current) return;
      setPreviewError(uiErrorMessage(error, "Impossible d’afficher ce document."));
      toast.error("Impossible d’obtenir l’aperçu");
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

  const download = async (doc: DocumentItem) => {
    try {
      const { getDocumentDownloadUrl } = await import("@/generated/api/naala");
      const response = await getDocumentDownloadUrl(doc.id);
      const url = (response.data as { url?: string } | undefined)?.url;
      if (!url) throw new Error("URL manquante");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(uiErrorMessage(error, "Téléchargement impossible"));
    }
  };
  const catMeta = DOCUMENT_CATEGORIES.find((c) => c.key === categoryView);
  const customViewName = parseCustomCategoryView(categoryView);
  const customCategories = Array.from(
    new Set(
      docs
        .filter(
          (d) =>
            String(d.category).toUpperCase() === "AUTRE" &&
            Boolean(d.customCategoryName?.trim()),
        )
        .map((d) => d.customCategoryName!.trim()),
    ),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  const docsInView = (key: string | null) => {
    if (!key) return docs;
    const custom = parseCustomCategoryView(key);
    if (custom) {
      return docs.filter(
        (d) =>
          String(d.category).toUpperCase() === "AUTRE" &&
          (d.customCategoryName ?? "").trim().toLowerCase() ===
            custom.toLowerCase(),
      );
    }
    return docs.filter((d) => matchCategory(d.category, key));
  };

  return (
    <>
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-[var(--navy-950)]">
          Documents de {r.number}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {r.property}
        </p>
      </div>
      {!categoryView ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const inCat = docsInView(cat.key);
            const count = inCat.length;
            const latest = [...inCat].sort((a, b) =>
              b.date.localeCompare(a.date),
            )[0];
            return (
              <DocumentCategoryCard
                key={cat.key}
                code={cat.code}
                title={cat.label}
                description={cat.description}
                count={count}
                latestDate={latest ? formatDate(latest.date) : undefined}
                onOpen={() => setCategoryView(cat.key)}
              />
            );
          })}
          {customCategories.map((name, index) => {
            const key = customCategoryViewKey(name);
            const inCat = docsInView(key);
            const latest = [...inCat].sort((a, b) =>
              b.date.localeCompare(a.date),
            )[0];
            return (
              <DocumentCategoryCard
                key={key}
                code={String(9 + index).padStart(2, "0")}
                title={name}
                description="Catégorie spécifique à ce terrain"
                count={inCat.length}
                latestDate={latest ? formatDate(latest.date) : undefined}
                onOpen={() => setCategoryView(key)}
              />
            );
          })}
        </div>
      ) : (
        <Card className="nf-table-wrap overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <nav className="flex flex-wrap items-center gap-1 text-[12px] text-[var(--text-muted)]">
                <button
                  type="button"
                  className="hover:text-[var(--navy-900)]"
                  onClick={() => setCategoryView(null)}
                >
                  Documents
                </button>
                <span>/</span>
                <span className="text-[var(--text)]">{r.number}</span>
                <span>/</span>
                <span className="text-[var(--text)]">
                  {customViewName ?? catMeta?.label}
                </span>
              </nav>
              <h3 className="mt-2 text-[15px] font-semibold">
                {customViewName
                  ? customViewName
                  : `${catMeta?.code} — ${catMeta?.label}`}
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Les fichiers téléversés seront classés dans cette catégorie.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 overflow-x-auto">
                {[
                  "Tous",
                  "Disponible",
                  "Manquant",
                  "À actualiser",
                  "Validé",
                ].map((x) => (
                  <button
                    onClick={() => setFilter(x)}
                    className={`rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold ${filter === x ? "bg-[var(--navy-950)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              </div>
              {canMutate && (
                <Button
                  onClick={() => onAdd?.(categoryView ?? undefined)}
                  size="sm"
                >
                  <UploadCloud className="size-4" />
                  Téléverser
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-[var(--surface-muted)] text-[12px] font-medium text-[var(--text-muted)]">
                <tr>
                  {[
                    "Document",
                    "Format",
                    "Taille",
                    "Date",
                    "Ajouté par",
                    "Actions",
                  ].map((x) => (
                    <th className="px-4 py-2.5 font-medium" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible
                  .filter((d) =>
                    categoryView
                      ? docsInView(categoryView).some((x) => x.id === d.id)
                      : true,
                  )
                  .map((d) => (
                    <tr
                      key={d.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]/60"
                    >
                      <td className="px-4 py-3 font-semibold text-[var(--navy-950)]">
                        {cleanDocumentTitle(d.title)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {formatFileFormat(d.fileName, d.fileType)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {formatFileSize(d.fileSize)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(d.documentDate ?? d.date)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {d.uploadedBy}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            onClick={() => void openPreview(d)}
                            variant="ghost"
                            size="sm"
                          >
                            <Eye className="size-3.5" />
                            Ouvrir
                          </Button>
                          <Button
                            onClick={() => void download(d)}
                            variant="ghost"
                            size="sm"
                            aria-label="Télécharger"
                          >
                            <Download className="size-3.5" />
                          </Button>
                          {canMutate && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={
                                  validateMutation.isPending ||
                                  d.status === "Manquant"
                                }
                                onClick={async () => {
                                  try {
                                    await validateMutation.mutateAsync({
                                      id: d.id,
                                    });
                                    toast.success("Document validé");
                                    await qc.invalidateQueries({
                                      queryKey:
                                        getGetRequisitionDocumentsQueryKey(
                                          r.id,
                                        ),
                                    });
                                  } catch (error) {
                                    toast.error(uiErrorMessage(error, "Validation impossible"));
                                  }
                                }}
                                aria-label="Valider le document"
                                title="Valider (admin)"
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={clearerMutation.isPending}
                                onClick={async () => {
                                  try {
                                    await clearerMutation.mutateAsync({
                                      id: d.id,
                                      data: {
                                        notes:
                                          "Demande d’une copie plus lisible depuis l’interface.",
                                      },
                                    });
                                    toast.success(
                                      "Demande de copie plus claire envoyée",
                                    );
                                  } catch (error) {
                                    toast.error(uiErrorMessage(error, "Demande impossible"));
                                  }
                                }}
                                aria-label="Demander une copie claire"
                                title="Copie claire (admin)"
                              >
                                <FileSearch className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <DocumentPreviewModal
        open={!!preview}
        document={preview}
        url={previewUrl}
        contentUrl={contentUrl}
        loading={previewLoading}
        error={previewError}
        onClose={closePreview}
        onRetry={() => preview && void openPreview(preview)}
        onDownload={() => preview && void download(preview)}
      />
    </>
  );
}

export function OppositionsTab({ r }: { r: Requisition }) {
  const { isAdmin: admin } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useGetRequisitionOppositions(r.id);
  const documentsQuery = useGetRequisitionDocuments(r.id);
  const rows = (data?.data ?? []) as unknown as Opposition[];
  const documents = (documentsQuery.data?.data ??
    []) as unknown as DocumentItem[];
  const [editing, setEditing] = useState<Opposition | null | undefined>(
    undefined,
  );
  const refresh = () =>
    qc.invalidateQueries({
      queryKey: getGetRequisitionOppositionsQueryKey(r.id),
    });
  if (isLoading) return <Skeleton className="h-52" />;
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="nf-icon-box">
              <Scale className="size-4" />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold text-[var(--navy-950)]">
                Oppositions
              </h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Synthèse des oppositions connues et documentées.
              </p>
            </div>
          </div>
          {admin && (
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="size-4" /> Ajouter
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px border-b border-[var(--border)] bg-[var(--border)]">
          <div className="bg-[var(--surface-muted)] px-5 py-4">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Oppositions connues</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--navy-950)]">{r.oppositionCount ?? 0}</p>
          </div>
          <div className="bg-[var(--surface-muted)] px-5 py-4">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Détaillées dans la plateforme</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--navy-950)]">{rows.length}</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">
            Aucune opposition détaillée enregistrée.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm transition-colors hover:bg-[var(--surface-muted)] sm:px-6"
              >
                <div>
                  <b>
                    {o.number ? `N° ${o.number}` : "Sans numéro"}
                    {o.opponent ? ` · ${o.opponent}` : ""}
                  </b>
                  <p className="mt-1 text-xs text-slate-500">
                    {o.type}
                    {o.claimedSurface ? " · " + o.claimedSurface : ""}
                  </p>
                  {o.sourceDocument && (
                    <p className="mt-1 text-xs text-slate-500">
                      Source : {o.sourceDocument.title}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(o.courtStatus || o.ancfccStatus) && (
                    <StatusBadge
                      status={o.courtStatus || o.ancfccStatus || ""}
                    />
                  )}
                  {admin && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Modifier"
                        onClick={() => setEditing(o)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Supprimer"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              "Supprimer cette opposition détaillée ?",
                            )
                          )
                            return;
                          try {
                            await deleteOpposition(o.id);
                            await refresh();
                            toast.success("Opposition supprimée");
                          } catch (error) {
                            toast.error(uiErrorMessage(error, "Suppression impossible"));
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing !== undefined && (
        <OppositionDialog
          requisitionId={r.id}
          opposition={editing}
          documents={documents}
          close={() => setEditing(undefined)}
          saved={async () => {
            await refresh();
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

function OppositionDialog({
  requisitionId,
  opposition,
  documents,
  close,
  saved,
}: {
  requisitionId: string;
  opposition: Opposition | null;
  documents: DocumentItem[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    number: opposition?.number?.toString() ?? "",
    opponent: opposition?.opponent ?? "",
    type: opposition?.type ?? "A_QUALIFIER",
    hectares: "",
    ares: "",
    centiares: "",
    status: opposition?.courtStatus ?? opposition?.ancfccStatus ?? "",
    impact: opposition?.impact ?? "",
    notes: opposition?.notes ?? "",
    sourceDocumentId: opposition?.sourceDocument?.id ?? "",
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      title={opposition ? "Modifier l’opposition" : "Ajouter une opposition"}
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const body = {
            requisitionId,
            oppositionNumber: form.number ? Number(form.number) : undefined,
            opponentName: form.opponent || undefined,
            type: form.type,
            claimedSurfaceHectares: form.hectares
              ? Number(form.hectares)
              : undefined,
            claimedSurfaceAres: form.ares ? Number(form.ares) : undefined,
            claimedSurfaceCentiares: form.centiares
              ? Number(form.centiares)
              : undefined,
            courtStatus: form.status || undefined,
            impact: form.impact || undefined,
            notes: form.notes || undefined,
            sourceDocumentId: form.sourceDocumentId || undefined,
          };
          try {
            if (opposition) await updateOpposition(opposition.id, body);
            else await createOpposition(body);
            await saved();
            toast.success(
              opposition ? "Opposition modifiée" : "Opposition ajoutée",
            );
          } catch (error) {
            toast.error(uiErrorMessage(error, "Enregistrement impossible"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="text-xs font-medium">
          Numéro
          <input
            type="number"
            min="1"
            className="nf-input mt-1"
            value={form.number}
            onChange={(e) => set("number", e.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Opposant
          <input
            className="nf-input mt-1"
            value={form.opponent}
            onChange={(e) => set("opponent", e.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Type
          <select
            className="nf-input mt-1"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            {[
              ["TOTALE", "Totale"],
              ["PARTIELLE", "Partielle"],
              ["DROITS_INDIVIS", "Droits individuels"],
              ["INSTITUTIONNELLE", "Institutionnelle"],
              ["SERVITUDE", "Servitude"],
              ["OTHER", "Autre"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Statut
          <input
            className="nf-input mt-1"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <label className="text-xs font-medium">
            Ha
            <input
              type="number"
              min="0"
              className="nf-input mt-1"
              value={form.hectares}
              onChange={(e) => set("hectares", e.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            Ares
            <input
              type="number"
              min="0"
              className="nf-input mt-1"
              value={form.ares}
              onChange={(e) => set("ares", e.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            Ca
            <input
              type="number"
              min="0"
              className="nf-input mt-1"
              value={form.centiares}
              onChange={(e) => set("centiares", e.target.value)}
            />
          </label>
        </div>
        <label className="text-xs font-medium sm:col-span-2">
          Source
          <select
            className="nf-input mt-1"
            value={form.sourceDocumentId}
            onChange={(e) => set("sourceDocumentId", e.target.value)}
          >
            <option value="">Source inconnue</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Impact
          <input
            className="nf-input mt-1"
            value={form.impact}
            onChange={(e) => set("impact", e.target.value)}
          />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Notes
          <textarea
            className="nf-input mt-1 min-h-20"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button disabled={busy} type="submit">
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DocumentUploadDialog({
  r,
  open,
  close,
  lockedCategory,
}: {
  r: Requisition;
  open: boolean;
  close: () => void;
  lockedCategory?: string;
}) {
  const qc = useQueryClient();
  const lockedCustom = parseCustomCategoryView(lockedCategory ?? null);
  const [unlockedCategory, setUnlockedCategory] = useState("");
  const [unlockedCustomName, setUnlockedCustomName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const createSession = useCreateDocumentUploadSession();
  const completeSession = useCompleteDocumentUploadSession();

  const category = lockedCustom
    ? "AUTRE"
    : lockedCategory && !lockedCategory.startsWith("CUSTOM:")
      ? lockedCategory
      : unlockedCategory;
  const customCategoryName = lockedCustom ?? unlockedCustomName;

  const reset = () => {
    setUnlockedCategory("");
    setUnlockedCustomName("");
    setFile(null);
    setFileError(null);
    setProgress(0);
    setUploading(false);
  };

  const categoryMeta = DOCUMENT_CATEGORIES.find(
    (c) => c.key === (lockedCustom ? "" : category),
  );
  const selectedCategory = category;
  const isAutre = selectedCategory === "AUTRE";
  const customName = customCategoryName.trim().replace(/\s+/g, " ");
  const categoryReady = Boolean(selectedCategory && (!isAutre || customName));
  const canSubmit = Boolean(file && categoryReady && !uploading && !fileError);

  const titleFromFile = (name: string) => {
    const base = name.replace(/\.[^.]+$/, "").trim();
    return base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || name;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const validateFile = (next: File | null): string | null => {
    if (!next) return null;
    const ext = next.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = [
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "doc",
      "docx",
    ] as const;
    if (!allowed.includes(ext as (typeof allowed)[number])) {
      return "Type de fichier non pris en charge";
    }
    if (next.size > maxUploadBytes) {
      return "Le fichier dépasse la taille maximale de 25 Mo";
    }
    return null;
  };

  const pickFile = (next: File | null) => {
    const err = validateFile(next);
    setFileError(err);
    setFile(err ? null : next);
  };

  const upload = async () => {
    if (!file) return;
    if (!categoryReady) {
      toast.error("La catégorie est obligatoire");
      return;
    }
    const err = validateFile(file);
    if (err) {
      setFileError(err);
      toast.error(err);
      return;
    }

    const selected = category;
    if (selected === "AUTRE" && !customName) {
      toast.error("Le nom de la catégorie est obligatoire");
      return;
    }
    setUploading(true);
    setProgress(5);
    try {
      const sessionResponse = await createSession.mutateAsync({
        data: {
          requisitionId: r.id,
          title: titleFromFile(file.name),
          category: toDocumentCategory(selected) as never,
          customCategoryName: selected === "AUTRE" ? customName : undefined,
          originalFilename: file.name,
          mimeType: file.type || mimeFromName(file.name),
          sizeBytes: file.size,
        } as never,
      });
      const session = sessionResponse.data as unknown as {
        id: string;
        uploadUrl: string;
        method?: string;
        headers?: Record<string, string>;
        fields?: Record<string, string>;
      };
      setProgress(20);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(session.method || "POST", session.uploadUrl);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setProgress(20 + Math.round((event.loaded / event.total) * 70));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Échec upload (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Erreur réseau pendant l’upload"));
        xhr.onabort = () => reject(new Error("Upload annulé"));

        if (session.method === "POST" || session.fields) {
          const form = new FormData();
          Object.entries(session.fields ?? {}).forEach(([key, value]) => {
            form.append(key, value);
          });
          form.append("file", file);
          xhr.send(form);
        } else {
          Object.entries(session.headers ?? {}).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
          xhr.send(file);
        }
      });
      setProgress(95);
      await completeSession.mutateAsync({
        id: session.id,
        data: {},
      });
      setProgress(100);
      toast.success("Document ajouté avec succès");
      await qc.invalidateQueries({
        queryKey: getGetRequisitionDocumentsQueryKey(r.id),
      });
      reset();
      close();
    } catch (error) {
      toast.error(uiErrorMessage(error, "Impossible de téléverser le document"));
      setUploading(false);
    }
  };

  const fileExt = file
    ? (file.name.split(".").pop()?.toUpperCase() ?? "—")
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !uploading) {
          reset();
          close();
        }
      }}
      title="Ajouter un document"
    >
      <p className="text-[13px] text-[var(--text-muted)]">
        {r.number} — {r.property}
      </p>

      {lockedCategory && (
        <p className="mt-3 text-[13px] text-[var(--text)]">
          Destination :{" "}
          <span className="font-semibold">
            {lockedCustom ?? categoryMeta?.label ?? lockedCategory}
          </span>
        </p>
      )}

      {!lockedCategory ? (
        <label className="mt-4 block text-[12px] text-[var(--text-muted)]">
          Catégorie
          <select
            className="nf-input mt-1"
            value={unlockedCategory}
            disabled={uploading}
            onChange={(e) => {
              setUnlockedCategory(e.target.value);
              if (e.target.value !== "AUTRE") setUnlockedCustomName("");
            }}
          >
            <option value="">Choisir…</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.code} — {c.label}
              </option>
            ))}
            <option value="AUTRE">Autre</option>
          </select>
        </label>
      ) : null}

      {(isAutre || lockedCustom) && !lockedCustom ? (
        <label className="mt-3 block text-[12px] text-[var(--text-muted)]">
          Nom de la catégorie
          <input
            className="nf-input mt-1"
            value={unlockedCustomName}
            maxLength={80}
            placeholder="Procuration, Expertise, Convention…"
            disabled={uploading}
            onChange={(e) => setUnlockedCustomName(e.target.value)}
          />
        </label>
      ) : null}
      {!file ? (
        <label
          className="mt-5 flex cursor-pointer flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-8 text-center transition-colors hover:border-[var(--slate-300)]"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (uploading) return;
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <UploadCloud className="size-7 text-[var(--text-faint)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--text)]">
            Glissez un fichier ici
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            ou sélectionner un fichier
          </p>
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX · 25 Mo max.
          </p>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            disabled={uploading}
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text)]">
              {file.name}
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              {fileExt} · {formatBytes(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => pickFile(null)}
          >
            <X className="size-3.5" />
            Retirer
          </Button>
        </div>
      )}

      {fileError && (
        <p className="mt-2 text-[12px] font-medium text-[var(--critical)]">
          {fileError}
        </p>
      )}

      {uploading && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--slate-100)]">
            <div
              className="h-full bg-[var(--navy-900)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Téléversement… {progress}%
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => {
            reset();
            close();
          }}
        >
          Annuler
        </Button>
        <Button disabled={!canSubmit} onClick={() => void upload()}>
          {uploading ? "Téléversement…" : "Téléverser le document"}
        </Button>
      </div>
    </Dialog>
  );
}
