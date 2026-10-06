export const DOCUMENT_CATEGORIES = [
  { key: "FICHE_SYNTHESE", code: "01", label: "Fiche synthèse", short: "Fiche synthèse", description: "Informations générales et notes de synthèse" },
  { key: "ANCFCC", code: "02", label: "ANCFCC", short: "ANCFCC", description: "Certificats, statuts et notifications ANCFCC" },
  { key: "ACTES", code: "03", label: "Actes", short: "Actes", description: "Actes d’achat, de vente et origine de propriété" },
  { key: "OPPOSITIONS", code: "04", label: "Oppositions", short: "Oppositions", description: "Copies d’oppositions et pièces adverses" },
  { key: "TRIBUNAL", code: "05", label: "Tribunal", short: "Tribunal", description: "Convocations, audiences et pièces judiciaires" },
  { key: "TOPOGRAPHIE", code: "06", label: "Topographie", short: "Topographie", description: "Plans, bornages et rapports de géomètre" },
  { key: "TERRAIN", code: "07", label: "Terrain", short: "Terrain", description: "Photos, PV de terrain et constats" },
  { key: "CORRESPONDANCES", code: "08", label: "Correspondances", short: "Correspondances", description: "Courriers, e-mails et relances" },
] as const;

export type StandardDocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["key"];
export type DocumentCategoryCode = StandardDocumentCategory | "RAPPORTS" | "AUTRE";

const CATEGORY_ALIASES: Record<string, DocumentCategoryCode> = {
  FICHE_SYNTHESE: "FICHE_SYNTHESE",
  ANCFCC: "ANCFCC",
  ACTES: "ACTES",
  ACTES_PROPRIETE: "ACTES",
  OPPOSITIONS: "OPPOSITIONS",
  TRIBUNAL: "TRIBUNAL",
  TOPOGRAPHIE: "TOPOGRAPHIE",
  TERRAIN: "TERRAIN",
  CORRESPONDANCES: "CORRESPONDANCES",
  RAPPORTS: "RAPPORTS",
  AUTRE: "AUTRE",
};

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function documentCategoryMeta(key: string) {
  return DOCUMENT_CATEGORIES.find((category) => category.key === key);
}

export function documentCategoryLabel(key: string, customName?: string | null): string {
  if (key === "AUTRE") return normalizeCategoryName(customName ?? "") || "Autre";
  return documentCategoryMeta(key)?.label ?? key;
}

export function documentCategoryNumberedLabel(key: string, customName?: string | null): string {
  if (key === "AUTRE") return documentCategoryLabel(key, customName);
  const category = documentCategoryMeta(key);
  return category ? `${category.code} — ${category.label}` : key;
}

export function documentCategoryShortLabel(key: string, customName?: string | null): string {
  if (key === "AUTRE") return normalizeCategoryName(customName ?? "") || "Autre";
  return documentCategoryMeta(key)?.short ?? key;
}

export function toDocumentCategoryCode(value: string): DocumentCategoryCode {
  const normalized = value.trim().toUpperCase().replace(/[ÉÈÊ]/g, "E").replace(/\s+/g, "_");
  if (normalized === "FICHE_SYNTHÈSE" || normalized === "FICHE_SYNTHESE") return "FICHE_SYNTHESE";
  if (normalized === "ACTES_ET_PROPRIÉTÉ" || normalized === "ACTES_ET_PROPRIETE") return "ACTES";
  return CATEGORY_ALIASES[normalized] ?? "AUTRE";
}

export function matchesDocumentCategory(value: string, category: string): boolean {
  if (category.startsWith("CUSTOM:") || value.toUpperCase() === "AUTRE") return false;
  return toDocumentCategoryCode(value) === toDocumentCategoryCode(category);
}

export function customCategoryViewKey(name: string): string {
  return `CUSTOM:${normalizeCategoryName(name)}`;
}

export function parseCustomCategoryView(key?: string | null): string | null {
  if (!key?.startsWith("CUSTOM:")) return null;
  return normalizeCategoryName(key.slice("CUSTOM:".length)) || null;
}
