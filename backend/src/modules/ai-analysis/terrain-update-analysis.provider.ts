/**
 * Phase 2B — AI comparison against current official terrain state.
 */
import { z } from "zod";
import { DocumentAnalysisProviderError } from "./document-analysis.provider.js";

export const TERRAIN_UPDATE_PROPOSAL_TYPES = [
  "NEW_EVENT",
  "UPDATE_EVENT",
  "NEW_COURT_CASE",
  "UPDATE_COURT_CASE",
  "NEW_HEARING",
  "HEARING_POSTPONED",
  "COURT_DECISION",
  "NEW_OPPOSITION",
  "UPDATE_OPPOSITION",
  "BORNAGE_UPDATE",
  "ANCFCC_UPDATE",
  "IDENTITY_CONFLICT",
  "PROCEDURAL_UPDATE",
  "NEW_DATE",
  "DOCUMENT_INFORMATION",
  "NO_ACTION",
] as const;

export type TerrainUpdateProposalType = (typeof TERRAIN_UPDATE_PROPOSAL_TYPES)[number];

const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const terrainUpdateProposalSchema = z.object({
  proposalType: z.enum(TERRAIN_UPDATE_PROPOSAL_TYPES),
  title: z.string().max(200),
  summary: z.string().max(500).optional(),
  proposedData: z.record(z.string(), z.unknown()),
  sourcePage: z.number().int().positive().nullable().optional(),
  evidenceText: z.string().max(500).nullable().optional(),
  confidence: confidenceSchema.default("LOW"),
  rawDateText: z.string().max(120).nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  isScheduled: z.boolean().optional(),
  eventType: z.string().nullable().optional(),
  duplicateOfExisting: z.boolean().optional(),
});

export const terrainUpdateAnalysisResultSchema = z.object({
  documentSummary: z
    .object({
      categoryHint: z.string().optional(),
      shortSummary: z.string().max(500).optional(),
    })
    .optional(),
  detectedUpdates: z.array(terrainUpdateProposalSchema).default([]),
  conflicts: z
    .array(
      z.object({
        field: z.string(),
        currentValue: z.string().nullable(),
        documentValue: z.string().nullable(),
        sourcePage: z.number().int().positive().nullable().optional(),
        evidenceText: z.string().max(500).nullable().optional(),
        confidence: confidenceSchema.default("MEDIUM"),
      }),
    )
    .default([]),
  newDates: z
    .array(
      z.object({
        label: z.string(),
        rawDateText: z.string(),
        normalizedDate: z.string().nullable().optional(),
        isFuture: z.boolean().optional(),
        sourcePage: z.number().int().positive().nullable().optional(),
      }),
    )
    .default([]),
  pointsToClarify: z.array(z.string().max(300)).max(5).default([]),
  noChange: z.boolean().default(false),
});

export type TerrainUpdateAnalysisResult = z.infer<typeof terrainUpdateAnalysisResultSchema>;
export type TerrainUpdateProposal = z.infer<typeof terrainUpdateProposalSchema>;

export type TerrainOfficialContext = {
  requisitionId: string;
  reference: string;
  identity: {
    propertyName: string;
    location: string | null;
    surface: string | null;
    seller: string | null;
    buyer: string | null;
    linkedRequisitions: string[];
  };
  proceduralStatus: {
    currentStage: string | null;
    currentLabel: string | null;
    latestKnownEvent: string | null;
    latestKnownEventAt: string | null;
    nextScheduledEventAt: string | null;
    judicialState: string | null;
  };
  courtCases: Array<{
    id: string;
    caseNumber: string;
    courtName: string | null;
    currentStage: string | null;
    nextEventAt: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    type: string;
    title: string;
    occurredAt: string;
    scheduledAt: string | null;
    isScheduled: boolean;
    legalCaseId: string | null;
  }>;
  oppositions: Array<{
    id: string;
    number: number | null;
    opponentName: string | null;
    type: string;
    claimedSurface: string | null;
    referenceDate: string | null;
  }>;
  upcomingDates: Array<{
    label: string;
    at: string;
    sourceType: string;
  }>;
};

export type TerrainUpdateAnalysisInput = {
  requisitionId: string;
  documentId: string;
  category: string;
  customCategoryName?: string | null;
  originalFilename: string;
  mimeType: string;
  textExcerpt?: string;
  pageTexts?: Array<{ page: number; text: string }>;
  pageImages?: Array<{ page: number; mimeType: string; bytes: Buffer }>;
  bytes?: Buffer;
  officialContext: TerrainOfficialContext;
};

export interface TerrainUpdateAnalysisProvider {
  readonly name: string;
  isConfigured(): boolean;
  analyzeDocumentUpdate(input: TerrainUpdateAnalysisInput): Promise<TerrainUpdateAnalysisResult>;
}

export function validateTerrainUpdateAnalysisResult(raw: unknown): TerrainUpdateAnalysisResult {
  const parsed = terrainUpdateAnalysisResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DocumentAnalysisProviderError(
      "AI_INVALID_RESPONSE",
      "La réponse du fournisseur d’analyse est invalide.",
    );
  }
  return parsed.data;
}

export function computeDocumentAnalysisFingerprint(
  documentId: string,
  documentVersionId: string,
): string {
  return `${documentId}|${documentVersionId}`;
}
