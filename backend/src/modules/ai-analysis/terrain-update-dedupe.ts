import type { TerrainOfficialContext, TerrainUpdateProposal } from "./terrain-update-analysis.provider.js";

function normalizeDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : value.trim().toLowerCase();
}

function normalizeCaseNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, "").toLowerCase();
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

export function dedupeAndNormalizeProposals(
  proposals: TerrainUpdateProposal[],
  context: TerrainOfficialContext,
): TerrainUpdateProposal[] {
  const out: TerrainUpdateProposal[] = [];

  for (const proposal of proposals) {
    let p = { ...proposal };

    if (p.proposalType === "NEW_COURT_CASE") {
      const caseNumber = textValue(p.proposedData.caseNumber);
      const num = normalizeCaseNumber(caseNumber);
      if (num && context.courtCases.some((c) => normalizeCaseNumber(c.caseNumber) === num)) {
        p = {
          ...p,
          proposalType: "DOCUMENT_INFORMATION",
          title: `Affaire déjà connue (${caseNumber})`,
          summary: "Le numéro d'affaire existe déjà dans le dossier.",
          duplicateOfExisting: true,
        };
      }
    }

    if (p.proposalType === "NEW_HEARING" || p.proposalType === "NEW_EVENT") {
      const eventType = textValue(p.eventType ?? p.proposedData.eventType);
      const dateKey = normalizeDateKey(p.occurredAt ?? p.scheduledAt ?? null);
      const caseNum = normalizeCaseNumber(textValue(p.proposedData.caseNumber));
      const duplicate = context.recentEvents.some((e) => {
        const sameType = !eventType || e.type === eventType;
        const sameDate =
          !dateKey ||
          normalizeDateKey(e.occurredAt) === dateKey ||
          normalizeDateKey(e.scheduledAt) === dateKey;
        const sameTitle =
          p.title && e.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 12));
        return sameType && sameDate && (sameTitle || !eventType);
      });
      if (duplicate) {
        p = {
          ...p,
          proposalType: "DOCUMENT_INFORMATION",
          title: p.title || "Événement déjà connu",
          summary: "Cet événement semble déjà présent dans l'historique validé.",
          duplicateOfExisting: true,
        };
      }
      if (
        caseNum &&
        context.courtCases.some((c) => normalizeCaseNumber(c.caseNumber) === caseNum) &&
        p.proposalType === "NEW_COURT_CASE"
      ) {
        p.proposalType = "DOCUMENT_INFORMATION";
      }
    }

    if (p.proposalType === "NEW_OPPOSITION") {
      const num = p.proposedData.oppositionNumber;
      const name = textValue(p.proposedData.opponentName).trim().toLowerCase();
      const exists = context.oppositions.some(
        (o) =>
          (num != null && o.number === Number(num)) ||
          (name && o.opponentName?.toLowerCase().includes(name)),
      );
      if (exists) {
        p = {
          ...p,
          proposalType: "DOCUMENT_INFORMATION",
          title: "Opposition déjà enregistrée",
          duplicateOfExisting: true,
        };
      }
    }

    if (p.proposalType === "NO_ACTION") continue;
    out.push(p);
  }

  return out;
}

export function mapConflictsToProposals(
  conflicts: Array<{
    field: string;
    currentValue: string | null;
    documentValue: string | null;
    sourcePage?: number | null;
    evidenceText?: string | null;
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }>,
): TerrainUpdateProposal[] {
  return conflicts.map((c) => ({
    proposalType: "IDENTITY_CONFLICT" as const,
    title: `Conflit — ${c.field}`,
    summary: `Valeur officielle: ${c.currentValue ?? "—"} · Document: ${c.documentValue ?? "—"}`,
    proposedData: {
      field: c.field,
      currentValue: c.currentValue,
      documentValue: c.documentValue,
    },
    sourcePage: c.sourcePage ?? null,
    evidenceText: c.evidenceText ?? null,
    confidence: c.confidence,
  }));
}

export function confidenceToFactConfidence(
  c: "HIGH" | "MEDIUM" | "LOW",
): "ELEVEE" | "MOYENNE" | "FAIBLE" {
  if (c === "HIGH") return "ELEVEE";
  if (c === "MEDIUM") return "MOYENNE";
  return "FAIBLE";
}
