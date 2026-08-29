export type Risk = "Critique" | "Élevé / Critique" | "Critique à confirmer" | "Critique opérationnel" | "Élevé" | "Moyen" | "Faible" | "À confirmer";
export type ActionStatus = "À faire" | "En cours" | "En attente" | "Bloquée" | "Terminée";

export interface DocumentItem {
  id: string;
  requisitionId: string;
  title: string;
  category: string;
  customCategoryName?: string | null;
  version: string;
  date: string;
  uploadedBy: string;
  status: "Disponible" | "Manquant" | "Incomplet" | "Illisible" | "À actualiser" | "Validé";
  analysis: string;
  quality: "Bonne" | "Moyenne" | "Faible";
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  documentDate?: string;
  visibility?: string;
  description?: string;
}

export interface ActionItem {
  id: string; requisitionId: string; title: string; category: string; priority: "Urgente" | "Haute" | "Normale" | "Faible";
  responsible: string; dueDate: string; status: ActionStatus; progress: number; blockage?: string;
}

export interface Requisition {
  id: string;
  number: string;
  property: string;
  location: string;
  surface: string;
  seller: string;
  buyer: string;
  risk: Risk;
  status: string;
  issue: string;
  currentSituation?: string;
  constraints?: string[];
  pointsToClarify?: string[];
  resolutionSteps?: string[];
  mainConstraint?: string;
  courtReached?: string;
  latestKnownEvent?: string;
  latestKnownEventAt?: string;
  eventResult?: string | null;
  latestJudicialEvent?: string | null;
  latestJudicialEventAt?: string | null;
  judicialResult?: string | null;
  nextScheduledEventAt?: string;
  dataFreshness?: string;
  lastManuallyUpdatedAt?: string | null;
  oppositionCount: number | null;
  tribunalCases: string[];
  importantDate?: string;
  event?: string;
  linkedRequisition?: string;
  availableDocuments: string[];
  documentCount?: number;
  missingDocuments: string[];
  criticalDetails: string[];
  nextAction: string;
  cardNextAction?: string;
  responsible: string;
  lastUpdate: string;
  rank: number;
  isPrincipal?: boolean;
}

export interface Opposition {
  id: string; requisitionId: string; number: number | null; opponent: string | null; type: string; scope: string | null;
  claimedSurface: string | null; legalBasis: string | null; description?: string | null; ancfccStatus: string | null; courtStatus: string | null;
  risk: Risk | null; strategy: string | null; responsible: string; lastUpdate: string;
  documents?: string | null;
  referenceDate?: string | null; impact?: string | null; notes?: string | null;
  sourceDocument?: { id: string; title: string } | null;
}

export interface CourtCase {
  id: string; requisitionId: string; number: string; court: string; phase: string; lawyer: string;
  latestEvent: string; nextEvent: string; outcome: string; missingDocuments: number;
}

export interface AgendaEvent {
  id: string; requisitionId: string; date: string | null; type: string; title: string; status: string; responsible: string;
}

export interface NotificationItem {
  id: string; requisitionId?: string; title: string; description: string; read: boolean; createdAt: string; level: "critical" | "warning" | "info";
}

export interface UserItem { id: string; name: string; firstName?: string; lastName?: string; role: string; roleKey?: "ADMIN" | "USER"; email: string; initials: string; status: "Actif" | "Désactivé"; isActive?: boolean; }

export interface ReportItem {
  id: string;
  reportId?: string;
  requisitionId: string;
  title: string;
  version: string;
  status: string;
  statusCode?: "BROUILLON" | "A_VALIDER" | "VALIDE" | "PUBLIE" | "REJETE" | "ARCHIVE";
  publishedAt?: string | null;
  generatedBy: string;
  generatedAt: string;
  sources: number;
  validator: string;
  scope?: string;
  reportType?: string;
  reportDate?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  documentId?: string | null;
  sourceDocumentId?: string | null;
  previewDocumentId?: string | null;
  openDocumentId?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  format?: string;
  canPreview?: boolean;
  canDownload?: boolean;
  hasFile?: boolean;
}
