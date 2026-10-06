"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/documents";
import { mimeFromName, maxUploadBytes } from "@/lib/api/mappers";
import { uiErrorMessage as errorMessage } from "@/lib/api/error-message";
import {
  DOCUMENT_CATEGORIES as CATEGORIES,
  documentCategoryNumberedLabel as categoryLabel,
  documentCategoryShortLabel as categoryShort,
  normalizeCategoryName as normalizeCustomName,
  type StandardDocumentCategory as StandardCategoryKey,
} from "@/lib/domain/document-categories";
import {
  analyzeTerrainDraft,
  cancelTerrainDraft,
  completeDraftUpload,
  confirmTerrainDraft,
  createDraftUploadSession,
  createTerrainDraft,
  getTerrainDraft,
  getTerrainDraftAnalysis,
  removeDraftDocument,
  renameDraftCustomCategory,
  skipTerrainDraftAnalysis,
  uploadFileToCloudinary,
  type TerrainAnalysisResultDto,
  type TerrainDraftDto,
  type TerrainIdentityForm,
} from "@/lib/api/phase1";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CUSTOM_CATEGORY_MAX = 80;

type CategoryKey = StandardCategoryKey | "AUTRE";

const ACCEPT =
  ".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function sectionKey(section: { category: string; customCategoryName: string }) {
  if (section.category === "AUTRE") {
    return `AUTRE:${normalizeCustomName(section.customCategoryName).toLowerCase()}`;
  }
  return section.category;
}

let sectionSeq = 0;
function newSectionId() {
  sectionSeq += 1;
  return `sec_${sectionSeq}`;
}

let pendingSeq = 0;
function newPendingId() {
  pendingSeq += 1;
  return `up_${pendingSeq}`;
}

function isAllowedFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["pdf", "docx", "jpg", "jpeg", "png"].includes(ext);
}

type CategorySection = {
  id: string;
  category: CategoryKey | "";
  customCategoryName: string;
};

function docsForSection(
  docs: TerrainDraftDto["documents"],
  section: CategorySection,
) {
  if (!section.category) return [];
  if (section.category === "AUTRE") {
    const name = normalizeCustomName(section.customCategoryName).toLowerCase();
    if (!name) return [];
    return docs.filter(
      (d) =>
        d.category === "AUTRE" &&
        normalizeCustomName(d.customCategoryName ?? "").toLowerCase() === name,
    );
  }
  return docs.filter((d) => d.category === section.category);
}

type PendingUpload = {
  id: string;
  sectionId: string;
  category: string;
  customCategoryName?: string;
  filename: string;
  sizeBytes: number;
  status: "uploading" | "error";
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (terrain: { id: string; reference: string }) => void;
};

export function NouveauTerrainWizard({ open, onOpenChange, onCreated }: Props) {
  const analysisPollGeneration = useRef(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<TerrainDraftDto | null>(null);
  const [sections, setSections] = useState<CategorySection[]>([
    { id: newSectionId(), category: "", customCategoryName: "" },
  ]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TerrainAnalysisResultDto | null>(null);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [staleAnalysis, setStaleAnalysis] = useState(false);
  const [includedCourts, setIncludedCourts] = useState<Record<number, boolean>>({});
  const [includedEvents, setIncludedEvents] = useState<Record<number, boolean>>({});
  const [identity, setIdentity] = useState<TerrainIdentityForm>({
    requisitionReference: "",
    propertyName: "",
    location: "",
    surface: "",
    seller: "",
    buyer: "",
    linkedRequisition: "",
  });
  const [situation, setSituation] = useState("Situation à confirmer");
  const [situationSummary, setSituationSummary] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [courtName, setCourtName] = useState("");
  const [courtConfirmed, setCourtConfirmed] = useState(false);
  const [oppositionCount, setOppositionCount] = useState("");
  const [oppositionSummary, setOppositionSummary] = useState("");
  const [pointsToClarify, setPointsToClarify] = useState<string[]>([]);
  const [conflictChoices, setConflictChoices] = useState<Record<string, string>>({});

  const reset = useCallback(() => {
    analysisPollGeneration.current += 1;
    setStep(1);
    setDraft(null);
    setSections([{ id: newSectionId(), category: "", customCategoryName: "" }]);
    setPending([]);
    setBusy(false);
    setAnalyzing(false);
    setAnalysisPhase(null);
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisNote(null);
    setStaleAnalysis(false);
    setIncludedCourts({});
    setIncludedEvents({});
    setIdentity({
      requisitionReference: "",
      propertyName: "",
      location: "",
      surface: "",
      seller: "",
      buyer: "",
      linkedRequisition: "",
    });
    setSituation("Situation à confirmer");
    setSituationSummary("");
    setCourtNumber("");
    setCourtName("");
    setCourtConfirmed(false);
    setOppositionCount("");
    setOppositionSummary("");
    setPointsToClarify([]);
    setConflictChoices({});
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const created = await createTerrainDraft();
        if (!cancelled) {
          setDraft(created);
          setSections([
            { id: newSectionId(), category: "", customCategoryName: "" },
          ]);
          setPending([]);
          setStep(1);
        }
      } catch (e) {
        toast.error(errorMessage(e));
        if (!cancelled) onOpenChange(false);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      analysisPollGeneration.current += 1;
    };
  }, [open, onOpenChange]);

  const usedStandardCategories = useMemo(
    () =>
      new Set(
        sections
          .map((s) => s.category)
          .filter((c): c is StandardCategoryKey => Boolean(c) && c !== "AUTRE"),
      ),
    [sections],
  );

  /** Standard cats once each; Autre can be added repeatedly (distinct names). */
  const canAddCategory = true;

  const hasUploadedDocs = (draft?.documents.length ?? 0) > 0;
  const hasPendingUploads = pending.some((p) => p.status === "uploading");
  const canContinue = hasUploadedDocs && !hasPendingUploads && !busy;

  const close = async (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    analysisPollGeneration.current += 1;
    if (draft && draft.status !== "CONFIRMED") {
      try {
        await cancelTerrainDraft(draft.id);
      } catch {
        /* ignore cancel failures on close */
      }
    }
    reset();
    onOpenChange(false);
  };

  const setSectionCategory = (sectionId: string, category: CategoryKey | "") => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              category,
              customCategoryName: category === "AUTRE" ? s.customCategoryName : "",
            }
          : s,
      ),
    );
  };

  const setSectionCustomName = (sectionId: string, raw: string) => {
    const name = raw.slice(0, CUSTOM_CATEGORY_MAX);
    const normalized = normalizeCustomName(name).toLowerCase();
    if (normalized) {
      const duplicate = sections.some(
        (s) =>
          s.id !== sectionId &&
          s.category === "AUTRE" &&
          normalizeCustomName(s.customCategoryName).toLowerCase() === normalized,
      );
      if (duplicate) {
        toast.error("Cette catégorie personnalisée existe déjà sur ce brouillon");
        return;
      }
    }
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, customCategoryName: name } : s,
      ),
    );
  };

  const addCategorySection = () => {
    const next = CATEGORIES.find((c) => !usedStandardCategories.has(c.key));
    setSections((prev) => [
      ...prev,
      {
        id: newSectionId(),
        category: next?.key ?? "AUTRE",
        customCategoryName: "",
      },
    ]);
  };

  const uploadFilesForCategory = async (
    sectionId: string,
    category: string,
    customCategoryName: string | undefined,
    files: FileList | File[],
  ) => {
    if (!draft) {
      toast.error("[DRAFT_NOT_FOUND] Brouillon non initialisé");
      return;
    }
    if (!category) {
      toast.error("Choisissez une catégorie avant d’ajouter des fichiers");
      return;
    }
    const custom =
      category === "AUTRE" ? normalizeCustomName(customCategoryName ?? "") : "";
    if (category === "AUTRE" && !custom) {
      toast.error("Indiquez le nom de la catégorie avant d’ajouter des fichiers");
      return;
    }

    const list = Array.from(files);
    if (!list.length) return;

    const queue: { file: File; pendingId: string }[] = [];
    const pendingRows: PendingUpload[] = [];
    for (const file of list) {
      if (!isAllowedFile(file)) {
        toast.error(`[UNSUPPORTED_FILE_TYPE] ${file.name}`);
        continue;
      }
      if (file.size > maxUploadBytes) {
        toast.error(`[FILE_TOO_LARGE] ${file.name} (max 25 Mo)`);
        continue;
      }
      const pendingId = newPendingId();
      queue.push({ file, pendingId });
      pendingRows.push({
        id: pendingId,
        sectionId,
        category,
        customCategoryName: custom || undefined,
        filename: file.name,
        sizeBytes: file.size,
        status: "uploading",
      });
    }

    if (!queue.length) return;
    setPending((prev) => [...prev, ...pendingRows]);

    let latest = draft;
    try {
      for (const { file, pendingId } of queue) {
        try {
          const session = await createDraftUploadSession(latest.id, {
            category,
            customCategoryName: custom || undefined,
            originalFilename: file.name,
            mimeType: file.type || mimeFromName(file.name),
            sizeBytes: file.size,
          });
          const cloud = await uploadFileToCloudinary(session, file);
          latest = await completeDraftUpload(latest.id, {
            publicId: session.publicId,
            originalFilename: file.name,
            mimeType: file.type || mimeFromName(file.name),
            sizeBytes: file.size,
            category: session.category || category,
            customCategoryName:
              (session.customCategoryName ?? custom) || undefined,
            cloudinaryResourceType:
              cloud.resource_type ?? session.resourceType ?? undefined,
            cloudinaryAssetId: cloud.asset_id,
            format: cloud.format,
          });
          setDraft(latest);
          setPending((prev) => prev.filter((p) => p.id !== pendingId));
        } catch (e) {
          const msg = errorMessage(e);
          setPending((prev) =>
            prev.map((p) =>
              p.id === pendingId
                ? { ...p, status: "error", error: msg }
                : p,
            ),
          );
          toast.error(msg);
        }
      }
    } catch {
      /* per-file errors already handled */
    }
  };

  const removeDoc = async (documentId: string) => {
    if (!draft) return;
    setBusy(true);
    try {
      const updated = await removeDraftDocument(draft.id, documentId);
      setDraft(updated);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const dismissPending = (pendingId: string) => {
    setPending((prev) => prev.filter((p) => p.id !== pendingId));
  };

  const removeCategorySection = async (section: CategorySection) => {
    if (!draft) return;
    const docs = docsForSection(draft.documents, section);
    const pendingInSection = pending.filter(
      (p) => p.sectionId === section.id && p.status === "uploading",
    );
    if (pendingInSection.length) {
      toast.error("Attendez la fin des uploads en cours pour cette catégorie");
      return;
    }

    if (docs.length > 0) {
      const ok = window.confirm(
        `Cette catégorie contient ${docs.length} document${docs.length > 1 ? "s" : ""}. Les supprimer du brouillon ?`,
      );
      if (!ok) return;
      setBusy(true);
      try {
        let latest = draft;
        for (const d of docs) {
          latest = await removeDraftDocument(latest.id, d.id);
        }
        setDraft(latest);
        setPending((prev) => prev.filter((p) => p.sectionId !== section.id));
        setSections((prev) => {
          const next = prev.filter((s) => s.id !== section.id);
          return next.length
            ? next
            : [{ id: newSectionId(), category: "", customCategoryName: "" }];
        });
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    setPending((prev) => prev.filter((p) => p.sectionId !== section.id));
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== section.id);
      return next.length
        ? next
        : [{ id: newSectionId(), category: "", customCategoryName: "" }];
    });
  };

  const renameCustomCategory = async (section: CategorySection, nextRaw: string) => {
    if (!draft || section.category !== "AUTRE") return;
    const fromName = normalizeCustomName(section.customCategoryName);
    const toName = normalizeCustomName(nextRaw);
    if (!toName) {
      toast.error("Le nom de la catégorie est obligatoire");
      return;
    }
    if (toName.length > CUSTOM_CATEGORY_MAX) {
      toast.error(`Maximum ${CUSTOM_CATEGORY_MAX} caractères`);
      return;
    }
    if (fromName.toLowerCase() === toName.toLowerCase()) {
      setSectionCustomName(section.id, toName);
      return;
    }
    const duplicate = sections.some(
      (s) =>
        s.id !== section.id &&
        s.category === "AUTRE" &&
        normalizeCustomName(s.customCategoryName).toLowerCase() ===
          toName.toLowerCase(),
    );
    if (duplicate) {
      toast.error("Cette catégorie personnalisée existe déjà sur ce brouillon");
      return;
    }
    const hasDocs = docsForSection(draft.documents, section).length > 0;
    if (!hasDocs) {
      setSectionCustomName(section.id, toName);
      return;
    }
    setBusy(true);
    try {
      const updated = await renameDraftCustomCategory(draft.id, {
        fromName,
        toName,
      });
      setDraft(updated);
      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id ? { ...s, customCategoryName: toName } : s,
        ),
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const applyAnalysisToForm = (result: TerrainAnalysisResultDto | null | undefined, draftNext: TerrainDraftDto) => {
    const identitySrc = result?.terrainIdentity ?? draftNext.proposedIdentity;
    const pick = (key: string) => {
      const f = identitySrc?.[key];
      if (!f || typeof f !== "object") return "";
      const v = "value" in f ? f.value : null;
      return typeof v === "string" ? v : v == null ? "" : String(v);
    };
    for (const c of result?.conflicts ?? []) {
      if (c.field && conflictChoices[c.field] == null && c.values[0]?.value) {
        setConflictChoices((prev) => ({ ...prev, [c.field]: c.values[0].value }));
      }
    }
    setIdentity({
      requisitionReference: pick("requisitionReference"),
      propertyName: pick("propertyName"),
      location: pick("location"),
      surface: conflictChoices.surface || pick("surface"),
      seller: pick("seller"),
      buyer: pick("buyer"),
      linkedRequisition: pick("linkedRequisition"),
    });
    const sit = result?.initialSituation;
    setSituation(
      (typeof sit?.label?.value === "string" && sit.label.value) ||
        "Situation à confirmer",
    );
    setSituationSummary(
      (typeof sit?.summary?.value === "string" && sit.summary.value) || "",
    );
    const courts = result?.courtCases ?? [];
    const courtMap: Record<number, boolean> = {};
    courts.forEach((c, i) => {
      courtMap[i] = Boolean(c.includeByDefault);
    });
    setIncludedCourts(courtMap);
    const firstIncluded = courts.findIndex((c) => c.includeByDefault);
    const first = courts[firstIncluded >= 0 ? firstIncluded : 0];
    setCourtNumber(
      typeof first?.caseNumber?.value === "string" ? first.caseNumber.value : "",
    );
    setCourtName(
      typeof first?.courtName?.value === "string" ? first.courtName.value : "",
    );
    setCourtConfirmed(firstIncluded >= 0);
    const events = result?.proceduralEvents ?? [];
    const evMap: Record<number, boolean> = {};
    events.forEach((e, i) => {
      evMap[i] = Boolean(e.includeByDefault);
    });
    setIncludedEvents(evMap);
    const oppCount = result?.oppositions?.detectedCount?.value;
    setOppositionCount(
      typeof oppCount === "number" ? String(oppCount) : "",
    );
    setOppositionSummary(result?.oppositions?.summary ?? "");
    setPointsToClarify(result?.pointsToClarify ?? []);
    setAnalysis(result ?? null);
    setAnalysisNote(
      result?.message ??
        draftNext.analysisMessage ??
        null,
    );
  };

  const pollAnalysis = async (draftId: string) => {
    const generation = ++analysisPollGeneration.current;
    const started = Date.now();
    while (
      generation === analysisPollGeneration.current &&
      Date.now() - started < 180_000
    ) {
      const status = await getTerrainDraftAnalysis(draftId);
      if (generation !== analysisPollGeneration.current) return;
      setAnalysisPhase(status.phase ?? status.status);
      if (status.status === "COMPLETED") {
        const refreshed = await getTerrainDraft(draftId);
        setDraft(refreshed);
        applyAnalysisToForm(status.result ?? refreshed.proposedAnalysis, refreshed);
        setAnalyzing(false);
        setAnalysisError(null);
        setStaleAnalysis(false);
        setStep(2);
        return;
      }
      if (status.status === "FAILED" || status.status === "STALE") {
        setAnalyzing(false);
        if (status.errorCode === "AI_PROVIDER_RATE_LIMIT") {
          setAnalysisError(
            "Limite temporaire du service d’analyse atteinte. Réessayez plus tard ou continuez sans analyse automatique.",
          );
        } else {
          setAnalysisError(
            status.errorMessage ||
              "L’analyse automatique n’a pas pu être terminée.",
          );
        }
        setStaleAnalysis(status.status === "STALE");
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (generation !== analysisPollGeneration.current) return;
    setAnalyzing(false);
    setAnalysisError("L’analyse automatique n’a pas pu être terminée.");
  };

  const goToReview = async (withAnalysis: boolean, force = false) => {
    if (!draft?.documents.length) {
      toast.error("Ajoutez au moins un document");
      return;
    }
    setAnalysisError(null);
    if (!withAnalysis) {
      setBusy(true);
      try {
        const next = await skipTerrainDraftAnalysis(draft.id);
        setDraft(next);
        applyAnalysisToForm(null, next);
        setStep(2);
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    setAnalyzing(true);
    setAnalysisPhase("prepare");
    setBusy(true);
    try {
      const started = await analyzeTerrainDraft(draft.id, force);
      if (started.errorCode === "AI_PROVIDER_NOT_CONFIGURED") {
        setAnalyzing(false);
        setAnalysisError(
          "Analyse automatique indisponible. Vous pouvez continuer manuellement.",
        );
        return;
      }
      if (started.errorCode === "AI_PROVIDER_RATE_LIMIT") {
        setAnalyzing(false);
        setAnalysisError(
          "Limite temporaire du service d’analyse atteinte. Réessayez plus tard ou continuez sans analyse automatique.",
        );
        return;
      }
      if (started.reused && started.status === "COMPLETED") {
        const status = await getTerrainDraftAnalysis(draft.id);
        const refreshed = await getTerrainDraft(draft.id);
        setDraft(refreshed);
        applyAnalysisToForm(status.result ?? refreshed.proposedAnalysis, refreshed);
        setAnalyzing(false);
        setStep(2);
        return;
      }
      await pollAnalysis(draft.id);
    } catch (e) {
      setAnalyzing(false);
      setAnalysisError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const createTerrain = async () => {
    if (!draft) return;
    if (!identity.requisitionReference.trim() || !identity.propertyName.trim()) {
      toast.error("Réquisition et propriété sont obligatoires");
      return;
    }
    setBusy(true);
    try {
      const courts =
        analysis?.courtCases?.map((c, i) => ({
          caseNumber:
            typeof c.caseNumber?.value === "string" ? c.caseNumber.value : "",
          courtName:
            typeof c.courtName?.value === "string" ? c.courtName.value : "",
          confirmed: Boolean(includedCourts[i]),
        })) ??
        (courtNumber
          ? [
              {
                caseNumber: courtNumber,
                courtName: courtName || undefined,
                confirmed: courtConfirmed,
              },
            ]
          : []);

      const confirmedEvents =
        analysis?.proceduralEvents
          ?.map((ev, i) => {
            if (!includedEvents[i]) return null;
            const occurred =
              typeof ev.occurredAt?.value === "string"
                ? ev.occurredAt.value
                : null;
            if (!occurred) return null;
            return {
              type: ev.eventType,
              occurredAt: occurred,
              title:
                typeof ev.title?.value === "string"
                  ? ev.title.value
                  : ev.eventType,
              shortDescription:
                typeof ev.shortDescription?.value === "string"
                  ? ev.shortDescription.value
                  : undefined,
              isScheduled: Boolean(ev.isScheduledHint),
            };
          })
          .filter(Boolean) ?? [];

      const result = await confirmTerrainDraft(draft.id, {
        identity: {
          ...identity,
          surface: conflictChoices.surface || identity.surface,
        },
        initialSituationLabel: situation,
        initialSituationSummary: situationSummary || undefined,
        pointsToClarify,
        courtMentioned: courts.some((c) => c.confirmed && c.caseNumber),
        courts,
        court: courtNumber
          ? {
              caseNumber: courtNumber,
              courtName: courtName || undefined,
              confirmed: courtConfirmed,
            }
          : undefined,
        oppositionCount: oppositionCount ? Number(oppositionCount) : undefined,
        oppositionSummary: oppositionSummary || undefined,
        confirmedEvents: confirmedEvents as Array<{
          type: string;
          occurredAt: string;
          title: string;
          shortDescription?: string;
          isScheduled?: boolean;
        }>,
        initialEvents: [
          {
            type: "GENERAL_UPDATE",
            occurredAt: new Date().toISOString(),
            title: situation || "Terrain créé",
            shortDescription: situationSummary || "Création via wizard ADMIN",
          },
        ],
        reviewAudit: {
          analysisAvailable: Boolean(analysis?.available),
          conflictChoices,
          includedCourts,
          includedEvents,
        },
      });
      onCreated(result);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Rebuild category sections from draft when returning from Step 2. */
  const backToStep1 = () => {
    if (draft?.documents.length) {
      const seen = new Set<string>();
      const rebuilt: CategorySection[] = [];
      for (const d of draft.documents) {
        const section: CategorySection = {
          id: newSectionId(),
          category: (d.category === "AUTRE" ? "AUTRE" : d.category) as CategoryKey,
          customCategoryName: d.customCategoryName ?? "",
        };
        const key = sectionKey(section);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rebuilt.push(section);
      }
      if (rebuilt.length) setSections(rebuilt);
    }
    setStep(1);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => void close(v)}
      title="Nouveau terrain"
      description={
        step === 1
          ? "Ajoutez les pièces disponibles. Elles serviront à préparer la fiche du terrain."
          : "Vérification des informations extraites ou saisies."
      }
      size="wizard"
    >
      <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] p-2 text-[12px] font-semibold">
        <span
          className={cn(
            "flex items-center justify-center rounded-[var(--radius-md)] px-3 py-2.5",
            step === 1
              ? "bg-[var(--navy-950)] text-white"
              : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
          )}
        >
          1. Pièces sources
        </span>
        <span className="h-px w-5 bg-[var(--border-strong)]" />
        <span
          className={cn(
            "flex items-center justify-center rounded-[var(--radius-md)] px-3 py-2.5",
            step === 2
              ? "bg-[var(--navy-950)] text-white"
              : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
          )}
        >
          2. Vérification
        </span>
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--navy-950)]">
              Pièces sources
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              Classez les documents par catégorie avant de poursuivre.
            </p>
          </div>

          <div className="space-y-3">
            {sections.map((section) => (
              <CategorySectionBlock
                key={section.id}
                section={section}
                usedStandardCategories={usedStandardCategories}
                documents={docsForSection(draft?.documents ?? [], section)}
                pending={pending.filter((p) => p.sectionId === section.id)}
                disabled={busy || !draft}
                onCategoryChange={(cat) => setSectionCategory(section.id, cat)}
                onCustomNameChange={(name) =>
                  setSectionCustomName(section.id, name)
                }
                onCustomNameCommit={(name) =>
                  void renameCustomCategory(section, name)
                }
                onFiles={(files) => {
                  if (!section.category) return;
                  void uploadFilesForCategory(
                    section.id,
                    section.category,
                    section.customCategoryName,
                    files,
                  );
                }}
                onRemoveFile={(id) => void removeDoc(id)}
                onDismissPending={dismissPending}
                onRemoveSection={() => void removeCategorySection(section)}
              />
            ))}
          </div>

          {canAddCategory ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-white px-3.5 text-[13px] font-semibold text-[var(--navy-900)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50"
              disabled={busy || !draft}
              onClick={addCategorySection}
            >
              <Plus className="size-3.5" />
              Ajouter une catégorie
            </button>
          ) : null}

          {analyzing ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 text-[13px] shadow-[var(--shadow-xs)]">
              <p className="font-semibold text-[var(--navy-950)]">
                Analyse des documents
              </p>
              <ul className="mt-3 space-y-1.5 text-[var(--text-muted)]">
                <li>✓ {draft?.documents.length ?? 0} documents préparés</li>
                <li>
                  {analysisPhase === "download" || analysisPhase === "prepare"
                    ? "●"
                    : analysisPhase
                      ? "✓"
                      : "○"}{" "}
                  Lecture des pièces…
                </li>
                <li>
                  {analysisPhase === "crosscheck" || analysisPhase === "read"
                    ? "●"
                    : analysisPhase === "prepare_form" ||
                        analysisPhase === "done"
                      ? "✓"
                      : "○"}{" "}
                  Croisement des informations
                </li>
                <li>
                  {analysisPhase === "prepare_form" || analysisPhase === "done"
                    ? "●"
                    : "○"}{" "}
                  Préparation de la fiche
                </li>
              </ul>
            </div>
          ) : null}

          {analysisError ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-3 text-[13px]">
              <p className="font-medium text-[var(--navy-950)]">
                L’analyse automatique n’a pas pu être terminée.
              </p>
              <p className="mt-1 text-[var(--text-muted)]">{analysisError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void goToReview(true, true)}
                >
                  Réessayer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void goToReview(false)}
                >
                  Continuer sans analyse
                </Button>
              </div>
            </div>
          ) : null}

          {staleAnalysis ? (
            <p className="text-[13px] text-[var(--text-muted)]">
              Les documents ont changé depuis la dernière analyse.{" "}
              <button
                type="button"
                className="font-medium text-[var(--navy-900)] underline"
                onClick={() => void goToReview(true, true)}
              >
                Relancer l’analyse
              </button>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              variant="ghost"
              disabled={!canContinue || analyzing}
              onClick={() => void goToReview(false)}
            >
              Continuer sans analyse automatique
            </Button>
            <Button
              disabled={!canContinue || analyzing}
              onClick={() => void goToReview(true)}
            >
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : null}
              Analyser et continuer
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="nf-review-stack space-y-5">
          {analysisNote ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[13px]">
              {analysisNote}
            </p>
          ) : null}

          {(analysis?.conflicts?.length ?? 0) > 0 ? (
            <section className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50/40 px-4 py-3">
              <h3 className="text-[13px] font-semibold text-[var(--navy-950)]">
                Informations à vérifier
              </h3>
              <div className="mt-3 space-y-3">
                {analysis!.conflicts!.map((c) => (
                  <div key={c.field} className="text-[13px]">
                    <p className="font-medium capitalize">{c.field}</p>
                    <div className="mt-1 space-y-1">
                      {c.values.map((v) => (
                        <label
                          key={`${c.field}-${v.value}`}
                          className="flex items-start gap-2"
                        >
                          <input
                            type="radio"
                            name={`conflict-${c.field}`}
                            checked={
                              (conflictChoices[c.field] || identity[c.field as keyof TerrainIdentityForm] || "") ===
                              v.value
                            }
                            onChange={() => {
                              setConflictChoices((prev) => ({
                                ...prev,
                                [c.field]: v.value,
                              }));
                              if (c.field in identity) {
                                setIdentity((prev) => ({
                                  ...prev,
                                  [c.field]: v.value,
                                }));
                              }
                            }}
                          />
                          <span>
                            {v.value}
                            <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                              Source: {v.sourceFilename || v.sourceDocumentId || "—"}
                              {v.sourcePage ? ` — page ${v.sourcePage}` : ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
              Identité du terrain
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["requisitionReference", "Réquisition"],
                  ["propertyName", "Propriété"],
                  ["location", "Localisation"],
                  ["surface", "Superficie"],
                  ["seller", "Vendeur"],
                  ["buyer", "Acquéreur"],
                  ["linkedRequisition", "Réquisition liée"],
                ] as const
              ).map(([key, label]) => {
                const meta = analysis?.terrainIdentity?.[key];
                const srcDoc = draft?.documents.find(
                  (d) => d.id === meta?.sourceDocumentId,
                );
                return (
                  <label key={key} className="text-[12px] text-[var(--text-muted)]">
                    {label}
                    <input
                      className="nf-input mt-1"
                      value={identity[key]}
                      onChange={(e) =>
                        setIdentity((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                    {meta?.sourceDocumentId || meta?.confidence ? (
                      <span className="mt-1 block text-[11px] text-[var(--text-faint)]">
                        {srcDoc?.originalFilename || "Source AI"}
                        {meta.sourcePage ? ` — page ${meta.sourcePage}` : ""}
                        {meta.confidence
                          ? ` · Confiance ${
                              meta.confidence === "HIGH"
                                ? "élevée"
                                : meta.confidence === "MEDIUM"
                                  ? "moyenne"
                                  : "faible"
                            }`
                          : ""}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
              Situation initiale
            </h3>
            <input
              className="nf-input mt-2"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="Ex. bornage bloqué, dossier au tribunal…"
            />
            <textarea
              className="nf-input mt-2 min-h-[72px]"
              value={situationSummary}
              onChange={(e) => setSituationSummary(e.target.value)}
              placeholder="Résumé factuel proposé…"
            />
          </section>

          {(analysis?.courtCases?.length ?? 0) > 0 ? (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
                Situation judiciaire
              </h3>
              {analysis!.courtCases!.map((c, i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-[13px]"
                >
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(includedCourts[i])}
                      onChange={(e) =>
                        setIncludedCourts((prev) => ({
                          ...prev,
                          [i]: e.target.checked,
                        }))
                      }
                    />
                    Inclure ce dossier judiciaire
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-[12px] text-[var(--text-muted)]">
                      N° de dossier
                      <input
                        className="nf-input mt-1"
                        value={
                          typeof c.caseNumber?.value === "string"
                            ? c.caseNumber.value
                            : ""
                        }
                        readOnly
                      />
                    </label>
                    <label className="text-[12px] text-[var(--text-muted)]">
                      Tribunal
                      <input
                        className="nf-input mt-1"
                        value={
                          typeof c.courtName?.value === "string"
                            ? c.courtName.value
                            : ""
                        }
                        readOnly
                      />
                    </label>
                  </div>
                </div>
              ))}
            </section>
          ) : (
          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
              Situation judiciaire
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] text-[var(--text-muted)]">
                N° de dossier
                <input
                  className="nf-input mt-1"
                  value={courtNumber}
                  onChange={(e) => setCourtNumber(e.target.value)}
                />
              </label>
              <label className="text-[12px] text-[var(--text-muted)]">
                Tribunal
                <input
                  className="nf-input mt-1"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={courtConfirmed}
                onChange={(e) => setCourtConfirmed(e.target.checked)}
              />
              Confirmer la création du dossier tribunal (données confirmées uniquement)
            </label>
          </section>
          )}

          {(analysis?.proceduralEvents?.length ?? 0) > 0 ? (
            <section className="space-y-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
                Événements proposés
              </h3>
              {analysis!.proceduralEvents!.map((ev, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2 text-[13px]"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(includedEvents[i])}
                    onChange={(e) =>
                      setIncludedEvents((prev) => ({
                        ...prev,
                        [i]: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {typeof ev.title?.value === "string"
                      ? ev.title.value
                      : ev.eventType}
                    <span className="block text-[11px] text-[var(--text-muted)]">
                      {ev.eventType}
                      {typeof ev.occurredAt?.value === "string"
                        ? ` · ${ev.occurredAt.value}`
                        : ""}
                      {ev.confidence ? ` · ${ev.confidence}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </section>
          ) : null}

          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
              Oppositions détectées
            </h3>
            <label className="mt-2 block text-[12px] text-[var(--text-muted)]">
              Nombre (à confirmer)
              <input
                className="nf-input mt-1 max-w-xs"
                value={oppositionCount}
                onChange={(e) => setOppositionCount(e.target.value)}
                inputMode="numeric"
              />
            </label>
            {oppositionSummary ? (
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                {oppositionSummary}
              </p>
            ) : null}
          </section>

          {pointsToClarify.length ? (
            <section>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
                Points à clarifier
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
                {pointsToClarify.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--navy-800)]">
              Documents ajoutés
            </h3>
            <ul className="mt-2 space-y-1 text-[13px]">
              {draft?.documents.map((d) => (
                <li key={d.id}>
                  {d.originalFilename}{" "}
                  <span className="text-[var(--text-muted)]">
                    — {categoryLabel(d.category, d.customCategoryName)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-4">
            <Button variant="ghost" disabled={busy} onClick={backToStep1}>
              <ArrowLeft className="size-4" />
              Retour
            </Button>
            <Button disabled={busy} onClick={() => void createTerrain()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Créer le terrain
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function CategorySectionBlock({
  section,
  usedStandardCategories,
  documents,
  pending,
  disabled,
  onCategoryChange,
  onCustomNameChange,
  onCustomNameCommit,
  onFiles,
  onRemoveFile,
  onDismissPending,
  onRemoveSection,
}: {
  section: CategorySection;
  usedStandardCategories: Set<string>;
  documents: TerrainDraftDto["documents"];
  pending: PendingUpload[];
  disabled: boolean;
  onCategoryChange: (category: CategoryKey | "") => void;
  onCustomNameChange: (name: string) => void;
  onCustomNameCommit: (name: string) => void;
  onFiles: (files: FileList | File[]) => void;
  onRemoveFile: (documentId: string) => void;
  onDismissPending: (pendingId: string) => void;
  onRemoveSection: () => void;
}) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAutre = section.category === "AUTRE";
  const customReady = !isAutre || Boolean(normalizeCustomName(section.customCategoryName));
  const hasCategory = Boolean(section.category);
  const hasFiles = documents.length > 0 || pending.length > 0;
  const canUpload = hasCategory && customReady && !disabled;
  const options = CATEGORIES.filter(
    (c) => c.key === section.category || !usedStandardCategories.has(c.key),
  );
  const headerLabel = categoryShort(
    section.category,
    section.customCategoryName,
  );

  const openPicker = () => {
    if (!canUpload) {
      if (isAutre && !customReady) {
        toast.error("Indiquez le nom de la catégorie avant d’ajouter des fichiers");
      }
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-strong)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        {hasCategory && hasFiles && (!isAutre || customReady) ? (
          isAutre ? (
            <input
              className="nf-input h-8 max-w-[min(100%,280px)] py-1 text-[13px] font-semibold"
              value={section.customCategoryName}
              maxLength={CUSTOM_CATEGORY_MAX}
              disabled={disabled}
              title="Renommer la catégorie"
              aria-label="Nom de la catégorie"
              onChange={(e) => onCustomNameChange(e.target.value)}
              onBlur={(e) => onCustomNameCommit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <h4 className="min-w-0 truncate text-[13px] font-semibold text-[var(--navy-950)]">
              {headerLabel}
            </h4>
          )
        ) : (
          <select
            className="nf-input h-8 max-w-[min(100%,280px)] py-1 text-[13px]"
            value={section.category}
            disabled={disabled || (hasFiles && hasCategory)}
            onChange={(e) =>
              onCategoryChange((e.target.value || "") as CategoryKey | "")
            }
            aria-label="Catégorie"
          >
            <option value="">Choisir une catégorie…</option>
            {options.map((c) => (
              <option key={c.key} value={c.key}>
                {c.code} — {c.label}
              </option>
            ))}
            <option value="AUTRE">Autre</option>
          </select>
        )}
        <button
          type="button"
          className="shrink-0 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
          disabled={disabled}
          onClick={onRemoveSection}
        >
          Supprimer
        </button>
      </div>

      <div className="px-4 py-3">
        {isAutre && !hasFiles ? (
          <label className="mb-2 block text-[12px] text-[var(--text-muted)]">
            Nom de la catégorie
            <input
              className="nf-input mt-1"
              value={section.customCategoryName}
              maxLength={CUSTOM_CATEGORY_MAX}
              placeholder="Procuration, Expertise, Convention…"
              disabled={disabled}
              onChange={(e) => onCustomNameChange(e.target.value)}
              onBlur={(e) => {
                const n = normalizeCustomName(e.target.value);
                if (n) onCustomNameChange(n);
              }}
            />
          </label>
        ) : null}

        {documents.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 border-b border-[var(--border)]/70 py-2 last:border-b-0"
          >
            <FileText className="size-4 shrink-0 text-[var(--navy-800)]" />
            <p
              className="min-w-0 flex-1 truncate text-[13px] font-medium"
              title={d.originalFilename}
            >
              {d.originalFilename}
            </p>
            <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">
              {d.sizeBytes ? formatFileSize(d.sizeBytes) : "—"}
            </span>
            <Check
              className="size-3.5 shrink-0 text-emerald-600"
              aria-label="Téléversé"
            />
            <button
              type="button"
              className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--danger)] disabled:opacity-50"
              disabled={disabled}
              aria-label={`Retirer ${d.originalFilename}`}
              onClick={() => onRemoveFile(d.id)}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        {pending.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 border-b border-[var(--border)]/70 py-2 last:border-b-0"
          >
            <FileText className="size-4 shrink-0 text-[var(--navy-800)]" />
            <p
              className="min-w-0 flex-1 truncate text-[13px] font-medium"
              title={p.filename}
            >
              {p.filename}
            </p>
            <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">
              {formatFileSize(p.sizeBytes)}
            </span>
            {p.status === "uploading" ? (
              <Loader2
                className="size-3.5 shrink-0 animate-spin text-[var(--navy-800)]"
                aria-label="Envoi…"
              />
            ) : (
              <>
                <span
                  className="max-w-[120px] truncate text-[11px] text-[var(--danger)]"
                  title={p.error}
                >
                  Échec
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  aria-label="Retirer"
                  onClick={() => onDismissPending(p.id)}
                >
                  <X className="size-3.5" />
                </button>
              </>
            )}
          </div>
        ))}

        {hasCategory ? (
          <div
            className={cn(
              "mt-1 rounded-[var(--radius-md)] border border-dashed px-3 py-2.5 transition",
              dragOver
                ? "border-[var(--navy-800)] bg-[var(--surface-muted)]/60"
                : "border-[var(--border)] bg-[var(--surface-muted)]/25",
              (!canUpload || disabled) && "opacity-50",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (canUpload) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!canUpload) {
                if (isAutre && !customReady) {
                  toast.error(
                    "Indiquez le nom de la catégorie avant d’ajouter des fichiers",
                  );
                }
                return;
              }
              if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              className="hidden"
              accept={ACCEPT}
              multiple
              disabled={!canUpload}
              onChange={(e) => {
                if (e.target.files?.length) onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--navy-900)] hover:underline disabled:opacity-50"
              disabled={!canUpload}
              onClick={openPicker}
            >
              <Plus className="size-3.5" />
              Ajouter des fichiers
            </button>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              {isAutre && !customReady
                ? "Saisissez le nom de la catégorie pour activer le dépôt."
                : "PDF, JPG, PNG, DOCX — plusieurs fichiers autorisés"}
            </p>
          </div>
        ) : (
          <p className="py-1 text-[12px] text-[var(--text-muted)]">
            Sélectionnez une catégorie pour y déposer des fichiers.
          </p>
        )}
      </div>
    </section>
  );
}
