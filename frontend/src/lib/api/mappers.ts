export type ActionCategoryCode =
  | "JURIDIQUE"
  | "ANCFCC"
  | "TOPOGRAPHIE"
  | "TERRAIN"
  | "DOCUMENTATION"
  | "COORDINATION";
export type ActionPriorityCode = "URGENTE" | "HAUTE" | "NORMALE" | "FAIBLE";
export type DocumentCategoryCode =
  | "FICHE_SYNTHESE"
  | "ANCFCC"
  | "ACTES"
  | "ACTES_PROPRIETE"
  | "OPPOSITIONS"
  | "TRIBUNAL"
  | "TOPOGRAPHIE"
  | "TERRAIN"
  | "CORRESPONDANCES"
  | "RAPPORTS"
  | "AUTRE";

const actionCategories: Record<string, ActionCategoryCode> = {
  Juridique: "JURIDIQUE",
  JURIDIQUE: "JURIDIQUE",
  ANCFCC: "ANCFCC",
  Topographie: "TOPOGRAPHIE",
  TOPOGRAPHIE: "TOPOGRAPHIE",
  Terrain: "TERRAIN",
  TERRAIN: "TERRAIN",
  Documentation: "DOCUMENTATION",
  DOCUMENTATION: "DOCUMENTATION",
  Coordination: "COORDINATION",
  COORDINATION: "COORDINATION",
};

const actionPriorities: Record<string, ActionPriorityCode> = {
  Urgente: "URGENTE",
  URGENTE: "URGENTE",
  Haute: "HAUTE",
  HAUTE: "HAUTE",
  Normale: "NORMALE",
  NORMALE: "NORMALE",
  Faible: "FAIBLE",
  FAIBLE: "FAIBLE",
};

const documentCategories: Record<string, DocumentCategoryCode> = {
  "Fiche synthèse": "FICHE_SYNTHESE",
  FICHE_SYNTHESE: "FICHE_SYNTHESE",
  ANCFCC: "ANCFCC",
  Actes: "ACTES",
  ACTES: "ACTES",
  "Actes et propriété": "ACTES",
  ACTES_PROPRIETE: "ACTES",
  Oppositions: "OPPOSITIONS",
  OPPOSITIONS: "OPPOSITIONS",
  Tribunal: "TRIBUNAL",
  TRIBUNAL: "TRIBUNAL",
  Topographie: "TOPOGRAPHIE",
  TOPOGRAPHIE: "TOPOGRAPHIE",
  Terrain: "TERRAIN",
  TERRAIN: "TERRAIN",
  Correspondances: "CORRESPONDANCES",
  CORRESPONDANCES: "CORRESPONDANCES",
  Rapports: "RAPPORTS",
  RAPPORTS: "RAPPORTS",
  Autre: "AUTRE",
  AUTRE: "AUTRE",
};

export function toActionCategory(value: string): ActionCategoryCode {
  return actionCategories[value] ?? "COORDINATION";
}

export function toActionPriority(value: string): ActionPriorityCode {
  return actionPriorities[value] ?? "NORMALE";
}

export function toDocumentCategory(value: string): DocumentCategoryCode {
  return documentCategories[value] ?? "AUTRE";
}

export function mimeFromName(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export const allowedUploadExtensions = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const maxUploadBytes = 25 * 1024 * 1024;
