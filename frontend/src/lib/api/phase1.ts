import { customFetcher, ApiError } from "./fetcher";

export type TerrainEventDto = {
  id: string;
  requisitionId: string;
  type: string;
  occurredAt: string;
  title: string;
  shortDescription?: string | null;
  source: string;
  validationStatus: string;
  isScheduled: boolean;
  scheduledAt?: string | null;
  requisitionReference?: string;
  propertyName?: string;
  calendarAt?: string;
};

export type TerrainDraftDocumentDto = {
  id: string;
  category: string;
  customCategoryName?: string | null;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  documentDate?: string | null;
  uploadedAt: string;
};

export type ProposedFieldDto = {
  value?: string | number | boolean | string[] | null;
  confidence?: string;
  status?: string;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  evidenceText?: string | null;
};

export type AnalysisConflictDto = {
  field: string;
  severity?: string;
  values: Array<{
    value: string;
    sourceDocumentId?: string | null;
    sourcePage?: number | null;
    sourceFilename?: string | null;
  }>;
};

export type TerrainAnalysisResultDto = {
  available?: boolean;
  message?: string;
  terrainIdentity?: Record<string, ProposedFieldDto>;
  proceduralFacts?: Record<string, ProposedFieldDto>;
  courtCases?: Array<{
    caseNumber?: ProposedFieldDto;
    courtName?: ProposedFieldDto;
    includeByDefault?: boolean;
  }>;
  proceduralEvents?: Array<{
    eventType: string;
    title?: ProposedFieldDto;
    shortDescription?: ProposedFieldDto;
    occurredAt?: ProposedFieldDto;
    rawDateText?: string | null;
    isScheduledHint?: boolean;
    includeByDefault?: boolean;
    confidence?: string;
  }>;
  oppositions?: {
    mentioned?: ProposedFieldDto;
    detectedCount?: ProposedFieldDto;
    typesDetected?: string[];
    summary?: string | null;
    items?: unknown[];
  };
  conflicts?: AnalysisConflictDto[];
  pointsToClarify?: string[];
  initialSituation?: {
    label?: ProposedFieldDto;
    summary?: ProposedFieldDto;
    lastKnownEvent?: ProposedFieldDto;
    lastKnownEventAt?: ProposedFieldDto;
  };
};

export type TerrainDraftAnalysisStatusDto = {
  analysisRunId: string | null;
  status: string | null;
  phase?: string | null;
  stale?: boolean;
  result?: TerrainAnalysisResultDto | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  provider?: string | null;
  model?: string | null;
};

export type TerrainDraftDto = {
  id: string;
  status: string;
  analysisMessage?: string | null;
  proposedIdentity?: Record<
    string,
    { value?: string | null; confidence?: string; status?: string; sourceDocumentId?: string | null; sourcePage?: number | null; evidenceText?: string | null }
  > | null;
  proposedProcedural?: Record<string, unknown> | null;
  proposedAnalysis?: TerrainAnalysisResultDto | null;
  analysisFingerprint?: string | null;
  latestAnalysisRunId?: string | null;
  resultingRequisitionId?: string | null;
  documents: TerrainDraftDocumentDto[];
};

export type TerrainIdentityForm = {
  requisitionReference: string;
  propertyName: string;
  location: string;
  surface: string;
  seller: string;
  buyer: string;
  linkedRequisition: string;
};

export type DraftUploadSession = {
  draftId: string;
  uploadUrl: string;
  method: string;
  fields: Record<string, string>;
  publicId: string;
  headers?: Record<string, string>;
  resourceType?: string;
  category: string;
  customCategoryName?: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
  expiresAt?: string;
};

/** customFetcher wraps the Nest body as `{ data, status, headers }`. */
function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function getRequisitionEvents(requisitionId: string) {
  const res = await customFetcher(`/api/requisitions/${requisitionId}/events`);
  return unwrap<TerrainEventDto[]>(res);
}

export async function createTerrainEvent(body: {
  requisitionId: string;
  type: string;
  occurredAt: string;
  title: string;
  shortDescription?: string;
  isScheduled?: boolean;
  scheduledAt?: string;
}) {
  const res = await customFetcher(`/api/terrain-events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return unwrap(res);
}

export async function getCalendarEvents(from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await customFetcher(`/api/calendar/events?${q.toString()}`);
  return unwrap<TerrainEventDto[]>(res);
}

export async function getUpcomingEvents(days = 30) {
  const res = await customFetcher(`/api/calendar/upcoming?days=${days}`);
  return unwrap<TerrainEventDto[]>(res);
}

export async function createTerrainDraft() {
  const res = await customFetcher(`/api/terrain-drafts`, {
    method: "POST",
    body: "{}",
  });
  return unwrap<TerrainDraftDto>(res);
}

export async function getTerrainDraft(id: string) {
  const res = await customFetcher(`/api/terrain-drafts/${id}`);
  return unwrap<TerrainDraftDto>(res);
}

export async function createDraftUploadSession(
  draftId: string,
  body: {
    category: string;
    customCategoryName?: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  },
) {
  const res = await customFetcher(
    `/api/terrain-drafts/${draftId}/upload-sessions`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  const session = unwrap<DraftUploadSession>(res);
  if (!session?.uploadUrl || !session?.publicId) {
    throw new ApiError(502, {
      code: "CLOUDINARY_UPLOAD_FAILED",
      message:
        "Session d’upload invalide (uploadUrl manquant). Vérifiez la configuration Cloudinary.",
    });
  }
  return session;
}

export async function completeDraftUpload(
  draftId: string,
  body: {
    publicId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    customCategoryName?: string;
    cloudinaryResourceType?: string;
    cloudinaryAssetId?: string;
    format?: string;
  },
) {
  const res = await customFetcher(`/api/terrain-drafts/${draftId}/documents`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return unwrap<TerrainDraftDto>(res);
}

export async function removeDraftDocument(draftId: string, documentId: string) {
  const res = await customFetcher(
    `/api/terrain-drafts/${draftId}/documents/${documentId}`,
    { method: "DELETE" },
  );
  return unwrap<TerrainDraftDto>(res);
}

export async function renameDraftCustomCategory(
  draftId: string,
  body: { fromName: string; toName: string },
) {
  const res = await customFetcher(
    `/api/terrain-drafts/${draftId}/custom-category`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  return unwrap<TerrainDraftDto>(res);
}

export async function analyzeTerrainDraft(draftId: string, force = false) {
  const res = await customFetcher(`/api/terrain-drafts/${draftId}/analyze`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });
  return unwrap<{
    analysisRunId: string;
    status: string;
    reused?: boolean;
    stale?: boolean;
    errorCode?: string;
  }>(res);
}

export async function getTerrainDraftAnalysis(draftId: string) {
  const res = await customFetcher(`/api/terrain-drafts/${draftId}/analysis`);
  return unwrap<TerrainDraftAnalysisStatusDto>(res);
}

export async function skipTerrainDraftAnalysis(draftId: string) {
  const res = await customFetcher(`/api/terrain-drafts/${draftId}/skip-analysis`, {
    method: "POST",
    body: "{}",
  });
  return unwrap<TerrainDraftDto>(res);
}

export async function confirmTerrainDraft(
  draftId: string,
  body: {
    identity: TerrainIdentityForm;
    initialSituationLabel?: string;
    initialSituationSummary?: string;
    pointsToClarify?: string[];
    courtMentioned?: boolean;
    court?: { caseNumber?: string; courtName?: string; confirmed?: boolean };
    courts?: Array<{ caseNumber?: string; courtName?: string; confirmed?: boolean }>;
    oppositionCount?: number;
    oppositionSummary?: string;
    confirmedEvents?: Array<{
      type: string;
      occurredAt: string;
      title: string;
      shortDescription?: string;
      isScheduled?: boolean;
      scheduledAt?: string;
    }>;
    initialEvents?: Array<{
      type: string;
      occurredAt: string;
      title: string;
      shortDescription?: string;
    }>;
    reviewAudit?: Record<string, unknown>;
  },
) {
  const res = await customFetcher(`/api/terrain-drafts/${draftId}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return unwrap<{ id: string; reference: string }>(res);
}

export async function cancelTerrainDraft(draftId: string) {
  const res = await customFetcher(`/api/terrain-drafts/${draftId}/cancel`, {
    method: "POST",
    body: "{}",
  });
  return unwrap<{ ok: boolean }>(res);
}

export async function getRequisitionAccess(requisitionId: string) {
  const res = await customFetcher(`/api/requisitions/${requisitionId}/access`);
  return unwrap<
    Array<{
      userId: string;
      user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }>
  >(res);
}

export async function grantRequisitionAccess(
  requisitionId: string,
  userId: string,
) {
  return customFetcher(`/api/requisitions/${requisitionId}/access`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function revokeRequisitionAccess(
  requisitionId: string,
  userId: string,
) {
  return customFetcher(
    `/api/requisitions/${requisitionId}/access/${userId}`,
    { method: "DELETE" },
  );
}

/** Upload a file to Cloudinary using a signed session; returns parsed Cloudinary JSON. */
export async function uploadFileToCloudinary(
  session: DraftUploadSession,
  file: File,
): Promise<{ public_id?: string; asset_id?: string; format?: string; resource_type?: string }> {
  const form = new FormData();
  Object.entries(session.fields ?? {}).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);

  const uploadRes = await fetch(session.uploadUrl, {
    method: session.method || "POST",
    body: form,
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await uploadRes.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON error page */
  }

  if (!uploadRes.ok) {
    const message =
      typeof body.error === "object" &&
      body.error &&
      "message" in (body.error as object)
        ? String((body.error as { message: string }).message)
        : typeof body.message === "string"
          ? body.message
          : `Upload Cloudinary échoué (HTTP ${uploadRes.status})`;
    throw new ApiError(uploadRes.status, {
      code: "CLOUDINARY_UPLOAD_FAILED",
      message,
      details: body,
    });
  }

  return body as {
    public_id?: string;
    asset_id?: string;
    format?: string;
    resource_type?: string;
  };
}

export type TerrainUpdateProposalDto = {
  id: string;
  requisitionId: string | null;
  documentId: string | null;
  proposalType: string;
  title: string;
  summary: string | null;
  proposedData: Record<string, unknown>;
  confidence: string;
  sourcePage: number | null;
  evidenceText: string | null;
  sourceFilename: string | null;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
};

export type DocumentAnalysisStatusDto = {
  analysisRunId: string | null;
  status: string | null;
  phase?: string | null;
  proposalCount: number;
  pendingReview?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  noChange?: boolean;
  userMessage?: string | null;
  completedAt?: string | null;
};

export async function getRequisitionAiProposals(requisitionId: string) {
  const res = await customFetcher<TerrainUpdateProposalDto[]>(
    `/api/requisitions/${requisitionId}/ai-proposals`,
  );
  return unwrap<TerrainUpdateProposalDto[]>(res);
}

export async function confirmRequisitionAiProposal(
  requisitionId: string,
  proposalId: string,
  body?: {
    resolution?: "KEEP_CURRENT" | "USE_PROPOSED" | "MANUAL_VALUE";
    manualValue?: string;
  },
) {
  const res = await customFetcher<{ proposal: TerrainUpdateProposalDto }>(
    `/api/requisitions/${requisitionId}/ai-proposals/${proposalId}/confirm`,
    { method: "POST", body: JSON.stringify(body ?? {}) },
  );
  return unwrap(res);
}

export async function rejectRequisitionAiProposal(
  requisitionId: string,
  proposalId: string,
) {
  const res = await customFetcher<TerrainUpdateProposalDto>(
    `/api/requisitions/${requisitionId}/ai-proposals/${proposalId}/reject`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return unwrap(res);
}

export async function getDocumentAnalysisStatus(
  requisitionId: string,
  documentId: string,
) {
  const res = await customFetcher<DocumentAnalysisStatusDto>(
    `/api/requisitions/${requisitionId}/documents/${documentId}/analysis-status`,
  );
  return unwrap<DocumentAnalysisStatusDto>(res);
}

export async function retryDocumentAnalysis(
  requisitionId: string,
  documentId: string,
) {
  const res = await customFetcher<{ analysisRunId: string; status: string }>(
    `/api/requisitions/${requisitionId}/documents/${documentId}/analyze`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return unwrap(res);
}

export async function getPendingAiProposalsCount() {
  const res = await customFetcher<{ count: number }>(
    `/api/admin/ai-proposals/pending-count`,
  );
  return unwrap<{ count: number }>(res);
}
