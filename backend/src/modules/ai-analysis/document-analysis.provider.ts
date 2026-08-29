/**
 * Provider-agnostic document analysis boundary.
 * Real providers plug in here. Never invent legal facts.
 */
import { z } from "zod";

export type ProposedField<T = string> = {
  value: T | null;
  normalizedValue?: T | null;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  evidenceText?: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: "PROPOSED" | "CONFIRMED" | "REJECTED";
};

export type TerrainIdentityProposal = {
  requisitionReference: ProposedField;
  propertyName: ProposedField;
  location: ProposedField;
  surface: ProposedField;
  seller: ProposedField;
  buyer: ProposedField;
  linkedRequisition: ProposedField;
};

export type ProceduralFactsProposal = {
  courtMentioned: ProposedField<boolean>;
  courtCaseNumbers: ProposedField<string[]>;
  courtName: ProposedField;
  dates: ProposedField<string[]>;
  bornageMentioned: ProposedField<boolean>;
  oppositionsMentioned: ProposedField<boolean>;
  oppositionCount: ProposedField<number | null>;
  latestKnownFact: ProposedField;
};

export type ProposedCourtCase = {
  caseNumber: ProposedField;
  courtName: ProposedField;
  detectedStatus?: ProposedField;
  linkedRequisitionHint?: ProposedField;
  includeByDefault: boolean;
};

export type ProposedProceduralEvent = {
  eventType: string;
  title: ProposedField;
  shortDescription?: ProposedField;
  occurredAt?: ProposedField;
  rawDateText?: string | null;
  isScheduledHint?: boolean;
  includeByDefault: boolean;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type ProposedOppositionItem = {
  number?: string | null;
  opponentName?: ProposedField;
  type?: "TOTAL" | "PARTIAL" | "INDIVIDUAL_RIGHTS" | "INSTITUTIONAL" | "SERVITUDE" | "OTHER" | null;
  dateOrReference?: ProposedField;
  claimedSurface?: ProposedField;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type ProposedOppositions = {
  mentioned: ProposedField<boolean>;
  detectedCount: ProposedField<number | null>;
  typesDetected: string[];
  majorClaimedSurfaces?: string[];
  institutionalOppositionMentioned?: boolean;
  summary?: string | null;
  items: ProposedOppositionItem[];
};

export type ProposedBornage = {
  mentioned: ProposedField<boolean>;
  status?: ProposedField;
  knownDate?: ProposedField;
  blocked?: ProposedField<boolean>;
  completed?: ProposedField<boolean>;
  reason?: ProposedField;
  nextDate?: ProposedField;
};

export type FieldConflict = {
  field: string;
  severity: "REVIEW_REQUIRED" | "INFO";
  values: Array<{
    value: string;
    sourceDocumentId?: string | null;
    sourcePage?: number | null;
    sourceFilename?: string | null;
  }>;
};

export type InitialSituationProposal = {
  label: ProposedField;
  summary: ProposedField;
  lastKnownEvent?: ProposedField;
  lastKnownEventAt?: ProposedField;
};

export type PageText = {
  page: number;
  text: string;
};

export type PageImage = {
  page: number;
  mimeType: string;
  bytes: Buffer;
};

export type DocumentAnalysisInput = {
  documentId?: string;
  draftDocumentId?: string;
  category: string;
  customCategoryName?: string | null;
  originalFilename: string;
  mimeType: string;
  /** Optional local/temp text extract — providers may ignore */
  textExcerpt?: string;
  /** Text-based PDF pages with boundaries */
  pageTexts?: PageText[];
  /** Scanned PDF / image pages for multimodal input (never persisted) */
  pageImages?: PageImage[];
  /** True when PDF was treated as scanned imagery */
  isScannedPdf?: boolean;
  /** Private bytes fetched server-side — never log contents */
  bytes?: Buffer;
  pageHint?: number | null;
};

export type TerrainDocumentsAnalysisResult = {
  available: boolean;
  message?: string;
  terrainIdentity: TerrainIdentityProposal;
  proceduralFacts: ProceduralFactsProposal;
  courtCases?: ProposedCourtCase[];
  proceduralEvents?: ProposedProceduralEvent[];
  oppositions?: ProposedOppositions;
  bornage?: ProposedBornage;
  conflicts?: FieldConflict[];
  pointsToClarify?: string[];
  initialSituation?: InitialSituationProposal;
};

export interface DocumentAnalysisProvider {
  readonly name: string;
  isConfigured(): boolean;
  analyzeDocument(input: DocumentAnalysisInput): Promise<Partial<TerrainDocumentsAnalysisResult>>;
  analyzeTerrainDocuments(inputs: DocumentAnalysisInput[]): Promise<TerrainDocumentsAnalysisResult>;
}

export class DocumentAnalysisNotConfiguredError extends Error {
  readonly code = "AI_PROVIDER_NOT_CONFIGURED";
  constructor(message = "Analyse automatique indisponible. Vous pouvez compléter les informations manuellement.") {
    super(message);
    this.name = "DocumentAnalysisNotConfiguredError";
  }
}

export class DocumentAnalysisProviderError extends Error {
  constructor(
    readonly code:
      | "AI_PROVIDER_TIMEOUT"
      | "AI_PROVIDER_RATE_LIMIT"
      | "AI_INVALID_RESPONSE"
      | "AI_FILE_UNREADABLE"
      | "AI_ANALYSIS_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "DocumentAnalysisProviderError";
  }
}

export function emptyField<T = string>(value: T | null = null): ProposedField<T> {
  return {
    value,
    sourceDocumentId: null,
    sourcePage: null,
    evidenceText: null,
    confidence: "LOW",
    status: "PROPOSED",
  };
}

export function emptyProposal(message?: string): TerrainDocumentsAnalysisResult {
  return {
    available: false,
    message:
      message ??
      "Analyse automatique indisponible. Vous pouvez compléter les informations manuellement.",
    terrainIdentity: {
      requisitionReference: emptyField(),
      propertyName: emptyField(),
      location: emptyField(),
      surface: emptyField(),
      seller: emptyField(),
      buyer: emptyField(),
      linkedRequisition: emptyField(),
    },
    proceduralFacts: {
      courtMentioned: emptyField(false),
      courtCaseNumbers: emptyField<string[]>([]),
      courtName: emptyField(),
      dates: emptyField<string[]>([]),
      bornageMentioned: emptyField(false),
      oppositionsMentioned: emptyField(false),
      oppositionCount: emptyField<number | null>(null),
      latestKnownFact: emptyField(),
    },
    courtCases: [],
    proceduralEvents: [],
    oppositions: {
      mentioned: emptyField(false),
      detectedCount: emptyField<number | null>(null),
      typesDetected: [],
      items: [],
    },
    bornage: {
      mentioned: emptyField(false),
    },
    conflicts: [],
    pointsToClarify: [],
    initialSituation: {
      label: emptyField("Situation à confirmer"),
      summary: emptyField(),
    },
  };
}

const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const statusSchema = z.enum(["PROPOSED", "CONFIRMED", "REJECTED"]);

const proposedFieldSchema = z.object({
  value: z.any().nullable(),
  normalizedValue: z.any().nullable().optional(),
  sourceDocumentId: z.string().nullable().optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  evidenceText: z.string().max(500).nullable().optional(),
  confidence: confidenceSchema.default("LOW"),
  status: statusSchema.default("PROPOSED"),
});

export const terrainAnalysisResultSchema = z.object({
  available: z.boolean().default(true),
  message: z.string().optional(),
  terrainIdentity: z.object({
    requisitionReference: proposedFieldSchema,
    propertyName: proposedFieldSchema,
    location: proposedFieldSchema,
    surface: proposedFieldSchema,
    seller: proposedFieldSchema,
    buyer: proposedFieldSchema,
    linkedRequisition: proposedFieldSchema,
  }),
  proceduralFacts: z.object({
    courtMentioned: proposedFieldSchema,
    courtCaseNumbers: proposedFieldSchema,
    courtName: proposedFieldSchema,
    dates: proposedFieldSchema,
    bornageMentioned: proposedFieldSchema,
    oppositionsMentioned: proposedFieldSchema,
    oppositionCount: proposedFieldSchema,
    latestKnownFact: proposedFieldSchema,
  }),
  courtCases: z
    .array(
      z.object({
        caseNumber: proposedFieldSchema,
        courtName: proposedFieldSchema,
        detectedStatus: proposedFieldSchema.optional(),
        linkedRequisitionHint: proposedFieldSchema.optional(),
        includeByDefault: z.boolean().default(false),
      }),
    )
    .default([]),
  proceduralEvents: z
    .array(
      z.object({
        eventType: z.string(),
        title: proposedFieldSchema,
        shortDescription: proposedFieldSchema.optional(),
        occurredAt: proposedFieldSchema.optional(),
        rawDateText: z.string().nullable().optional(),
        isScheduledHint: z.boolean().optional(),
        includeByDefault: z.boolean().default(false),
        sourceDocumentId: z.string().nullable().optional(),
        sourcePage: z.number().nullable().optional(),
        confidence: confidenceSchema.default("LOW"),
      }),
    )
    .default([]),
  oppositions: z
    .object({
      mentioned: proposedFieldSchema,
      detectedCount: proposedFieldSchema,
      typesDetected: z.array(z.string()).default([]),
      majorClaimedSurfaces: z.array(z.string()).optional(),
      institutionalOppositionMentioned: z.boolean().optional(),
      summary: z.string().nullable().optional(),
      items: z
        .array(
          z.object({
            number: z.string().nullable().optional(),
            opponentName: proposedFieldSchema.optional(),
            type: z
              .enum([
                "TOTAL",
                "PARTIAL",
                "INDIVIDUAL_RIGHTS",
                "INSTITUTIONAL",
                "SERVITUDE",
                "OTHER",
              ])
              .nullable()
              .optional(),
            dateOrReference: proposedFieldSchema.optional(),
            claimedSurface: proposedFieldSchema.optional(),
            sourceDocumentId: z.string().nullable().optional(),
            sourcePage: z.number().nullable().optional(),
            confidence: confidenceSchema.default("LOW"),
          }),
        )
        .default([]),
    })
    .optional(),
  bornage: z
    .object({
      mentioned: proposedFieldSchema,
      status: proposedFieldSchema.optional(),
      knownDate: proposedFieldSchema.optional(),
      blocked: proposedFieldSchema.optional(),
      completed: proposedFieldSchema.optional(),
      reason: proposedFieldSchema.optional(),
      nextDate: proposedFieldSchema.optional(),
    })
    .optional(),
  conflicts: z
    .array(
      z.object({
        field: z.string(),
        severity: z.enum(["REVIEW_REQUIRED", "INFO"]).default("REVIEW_REQUIRED"),
        values: z.array(
          z.object({
            value: z.string(),
            sourceDocumentId: z.string().nullable().optional(),
            sourcePage: z.number().nullable().optional(),
            sourceFilename: z.string().nullable().optional(),
          }),
        ),
      }),
    )
    .default([]),
  pointsToClarify: z.array(z.string()).max(5).default([]),
  initialSituation: z
    .object({
      label: proposedFieldSchema,
      summary: proposedFieldSchema,
      lastKnownEvent: proposedFieldSchema.optional(),
      lastKnownEventAt: proposedFieldSchema.optional(),
    })
    .optional(),
});

export const documentFactSchema = z.object({
  category: z.string(),
  fieldKey: z.string(),
  value: z.union([z.string(), z.boolean(), z.number(), z.null()]),
  page: z.number().int().positive().nullable().optional(),
  evidenceText: z.string().max(500).nullable().optional(),
  confidence: confidenceSchema.default("LOW"),
});

export const documentFactsExtractionSchema = z.object({
  draftDocumentId: z.string(),
  facts: z.array(documentFactSchema).default([]),
  rawNotes: z.string().max(1000).optional(),
});

export type DocumentFactsExtraction = z.infer<typeof documentFactsExtractionSchema>;

export function validateDocumentFacts(raw: unknown): DocumentFactsExtraction {
  const parsed = documentFactsExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DocumentAnalysisProviderError(
      "AI_INVALID_RESPONSE",
      "La réponse du fournisseur d’analyse est invalide.",
    );
  }
  return parsed.data;
}

export function validateAnalysisResult(raw: unknown): TerrainDocumentsAnalysisResult {
  const parsed = terrainAnalysisResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DocumentAnalysisProviderError(
      "AI_INVALID_RESPONSE",
      "La réponse du fournisseur d’analyse est invalide.",
    );
  }
  return parsed.data;
}

/** Deterministic fingerprint of draft documents (no secrets). */
export function computeDraftFingerprint(
  docs: Array<{
    id: string;
    category: string;
    customCategoryName?: string | null;
    storageKey: string;
    sizeBytes: number | bigint;
  }>,
): string {
  const rows = [...docs]
    .map(
      (d) =>
        `${d.id}|${d.category}|${(d.customCategoryName ?? "").trim().toLowerCase()}|${d.storageKey}|${Number(d.sizeBytes)}`,
    )
    .sort();
  return rows.join("\n");
}
