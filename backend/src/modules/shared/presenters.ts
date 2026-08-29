import type { ActionItem, Document, DocumentVersion, Notification, Requisition, User } from "../../generated/prisma/client.js";
const docStatus: Record<string, string> = { DISPONIBLE: "Disponible", MANQUANT: "Manquant", INCOMPLET: "Incomplet", ILLISIBLE: "Illisible", A_ACTUALISER: "À actualiser", VALIDE: "Validé" };
const quality: Record<string, string> = { BONNE: "Bonne", MOYENNE: "Moyenne", FAIBLE: "Faible" };
const actionCategory: Record<string, string> = {
  JURIDIQUE: "Juridique",
  ANCFCC: "ANCFCC",
  TOPOGRAPHIE: "Topographie",
  TERRAIN: "Terrain",
  DOCUMENTATION: "Documentation",
  COORDINATION: "Coordination",
};
const actionStatus: Record<string, string> = { A_FAIRE: "À faire", EN_COURS: "En cours", EN_ATTENTE: "En attente", BLOQUEE: "Bloquée", TERMINEE: "Terminée" };
const actionPriority: Record<string, string> = { URGENTE: "Urgente", HAUTE: "Haute", NORMALE: "Normale", FAIBLE: "Faible" };
type Doc = Document & { currentVersion: DocumentVersion | null; createdBy: User; requisition: Requisition };
type Action = ActionItem & { responsibleUser: User | null; requisition: Requisition | null };
export function presentDocument(d: Doc) {
  return {
    id: d.id,
    requisitionId: d.requisitionId,
    title: d.title,
    category: d.category,
    customCategoryName: (d).customCategoryName ?? null,
    visibility: (d).visibility ?? "PARTAGE",
    description: (d).description ?? undefined,
    documentDate: (d).documentDate?.toISOString().slice(0, 10),
    fileName: d.currentVersion?.originalFilename ?? "—",
    fileType: d.currentVersion?.mimeType ?? "—",
    fileSize: d.currentVersion ? Number(d.currentVersion.sizeBytes) : 0,
    version: d.currentVersion ? `v${d.currentVersion.versionNumber}` : "—",
    date: (
      (d).documentDate ??
      d.currentVersion?.uploadedAt ??
      d.createdAt
    )
      .toISOString()
      .slice(0, 10),
    uploadedBy: `${d.createdBy.firstName} ${d.createdBy.lastName}`,
    status: docStatus[d.status] ?? d.status,
    analysis: "Non analysé",
    quality: quality[d.currentVersion?.sourceQuality ?? "MOYENNE"] ?? "Moyenne",
  };
}
export function presentAction(a: Action) { return { id: a.id, requisitionId: a.requisitionId ?? "", title: a.title, category: actionCategory[a.category] ?? a.category, priority: actionPriority[a.priority] ?? a.priority, responsible: a.responsibleUser ? `${a.responsibleUser.firstName} ${a.responsibleUser.lastName}` : "Non renseigné", dueDate: a.dueDate?.toISOString().slice(0, 10) ?? "", status: actionStatus[a.status] ?? a.status, progress: a.progress, blockage: a.blockage ?? undefined }; }
export function presentNotification(n: Notification) {
  const type = n.type.toUpperCase();
  return {
    id: n.id,
    requisitionId: n.requisitionId ?? undefined,
    title: n.title,
    description: n.message,
    read: Boolean(n.readAt),
    createdAt: n.createdAt.toISOString(),
    level: type.includes("CRITICAL")
      ? "critical"
      : type.includes("WARNING")
        ? "warning"
        : "info",
  };
}
