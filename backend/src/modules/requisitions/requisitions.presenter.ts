import type { Prisma } from "../../generated/prisma/client.js";
import type { RequisitionStatus, RiskLevel } from "../../generated/prisma/enums.js";
import { futureDateOnly, isoDateOnly } from "../../shared/date/date-rules.js";

export type RequisitionRecord = Prisma.RequisitionGetPayload<{
  include: {
    responsibleUser: true;
    documents: true;
    documentRequests: true;
    legalCases: true;
    statusSnapshot: true;
    outgoingRelations: { include: { target: true } };
  };
}>;

const risks: Record<RiskLevel, string> = {
  CRITIQUE: "Critique",
  ELEVE_CRITIQUE: "Élevé / Critique",
  ELEVE: "Élevé",
  MOYEN: "Moyen",
  FAIBLE: "Faible",
  A_CONFIRMER: "À confirmer",
  CRITIQUE_OPERATIONNEL: "Critique opérationnel",
};

const statuses: Record<RequisitionStatus, string> = {
  EN_COURS: "En cours",
  AU_TRIBUNAL: "Au tribunal",
  AUDIENCE_PROGRAMMEE: "Audience programmée",
  DELIBERE: "Délibéré",
  BORNAGE_BLOQUE: "Bornage bloqué",
  DOCUMENTS_INCOMPLETS: "Documents incomplets",
  ACTION_REQUISE: "Action requise",
  A_CONFIRMER: "À confirmer",
  CLOTURE: "Clôturé",
};

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function courtReachedLabel(value: string | null | undefined, hasCases: boolean): string {
  if (value === "Oui" || (!value && hasCases)) return "Oui";
  if (value === "Non") return "Non";
  return "Transmission à confirmer";
}

export function presentRequisition(r: RequisitionRecord) {
  const x = r;
  const pointsToClarify = stringList(
    x.pointsToClarifyJson ?? x.constraintsJson ?? r.criticalDetails,
  );
  const resolutionSteps = stringList(x.resolutionStepsJson);
  const currentSituation =
    x.currentSituation ?? r.summary ?? r.mainIssue;
  const latestKnownEvent =
    (r.statusSnapshot?.latestKnownEventId ? r.statusSnapshot.currentLabel : null) ??
    x.latestKnownEvent ??
    r.eventLabel ??
    undefined;
  const latestKnownEventAt = isoDateOnly(
    r.statusSnapshot?.latestKnownEventAt ?? x.latestKnownEventAt,
  );
  const nextScheduledEventAt = futureDateOnly(
    r.statusSnapshot?.nextScheduledEventAt ?? x.nextScheduledEventAt,
  );
  const hasCases = r.legalCases.length > 0;
  const courtReached = courtReachedLabel(x.courtReached, hasCases);
  const isPrincipal =
    x.isPrincipal !== false && r.reference !== "R 16605/31";

  const mainConstraint = pointsToClarify[0] ?? undefined;
  const cardNextAction = r.nextAction ?? "À confirmer";

  const dataFreshness =
    x.dataFreshness ??
    (hasCases
      ? "Situation à actualiser"
      : "Aucun événement judiciaire confirmé");

  return {
    id: r.id,
    number: r.reference,
    property: r.propertyName,
    location: `${r.location} — ${r.province}`,
    surface: `${r.surfaceHectares} ha ${String(r.surfaceAres).padStart(2, "0")} a ${String(r.surfaceCentiares).padStart(2, "0")} ca`,
    seller: r.sellerName,
    buyer: r.buyerName,
    risk: risks[r.riskLevel],
    status: r.statusSnapshot?.currentLabel ?? r.mainStatusLabel ?? statuses[r.mainStatus],
    issue: r.mainIssue,
    currentSituation,
    /** @deprecated Prefer pointsToClarify */
    constraints: pointsToClarify,
    pointsToClarify,
    resolutionSteps,
    mainConstraint,
    courtReached,
    latestKnownEvent,
    latestKnownEventAt,
    eventResult: x.eventResult ?? null,
    latestJudicialEvent: x.latestJudicialEvent ?? null,
    latestJudicialEventAt: isoDateOnly(x.latestJudicialEventAt),
    judicialResult: x.judicialResult ?? null,
    nextScheduledEventAt,
    dataFreshness,
    oppositionCount: r.oppositionCount,
    tribunalCases: r.legalCases.map((c) => c.caseNumber),
    importantDate: nextScheduledEventAt ?? undefined,
    event: latestKnownEvent,
    linkedRequisition: r.outgoingRelations[0]?.target.reference,
    availableDocuments: r.documents
      .filter(
        (d) =>
          d.status !== "MANQUANT" && d.category !== "RAPPORTS" && !d.deletedAt,
      )
      .map((d) => d.title),
    documentCount: r.documents.filter(
      (d) => d.status !== "MANQUANT" && d.category !== "RAPPORTS" && !d.deletedAt,
    ).length,
    missingDocuments: r.documentRequests
      .filter((d) => d.status !== "RECU" && d.status !== "ANNULE")
      .map((d) => d.requestedDocumentTitle),
    criticalDetails: pointsToClarify.length
      ? pointsToClarify
      : stringList(r.criticalDetails),
    nextAction: r.nextAction ?? cardNextAction,
    cardNextAction,
    responsible: r.responsibleUser
      ? `${r.responsibleUser.firstName} ${r.responsibleUser.lastName}`
      : "Non renseigné",
    lastUpdate: r.updatedAt.toISOString(),
    lastManuallyUpdatedAt: isoDateOnly(x.lastManuallyUpdatedAt),
    rank: r.priorityRank ?? 99,
    isPrincipal,
  };
}

export { risks, statuses };
