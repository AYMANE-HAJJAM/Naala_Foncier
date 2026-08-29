-- Phase 1 foundation: TerrainEvent, status snapshot, AIExtraction, terrain drafts, court link, ACTES category

-- DocumentCategory: add ACTES (keep ACTES_PROPRIETE for compatibility)
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'ACTES';

-- New enums
DO $$ BEGIN
  CREATE TYPE "TerrainEventType" AS ENUM (
    'GENERAL_UPDATE',
    'COURT_TRANSMISSION',
    'COURT_CASE_CREATED',
    'COURT_HEARING_SCHEDULED',
    'COURT_HEARING_POSTPONED',
    'COURT_HEARING_HELD',
    'COURT_DELIBERATION',
    'COURT_DECISION',
    'BORNAGE_SCHEDULED',
    'BORNAGE_ATTEMPTED',
    'BORNAGE_BLOCKED',
    'BORNAGE_COMPLETED',
    'OPPOSITION_ADDED',
    'OPPOSITION_UPDATED',
    'DOCUMENT_RECEIVED',
    'ANCFCC_STATUS_UPDATED',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TerrainEventSource" AS ENUM (
    'MANUAL', 'DOCUMENT', 'AI_PROPOSAL', 'IMPORT', 'SYSTEM', 'HEARING_MIRROR'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TerrainEventValidationStatus" AS ENUM (
    'PROPOSED', 'CONFIRMED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DataFreshnessCode" AS ENUM (
    'CONFIRMED', 'TO_CONFIRM', 'OUTDATED', 'AI_SUGGESTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AIExtractionStatus" AS ENUM (
    'PROPOSED', 'CONFIRMED', 'REJECTED', 'SUPERSEDED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TerrainDraftStatus" AS ENUM (
    'DRAFT', 'ANALYZING', 'READY_FOR_REVIEW', 'CONFIRMED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- LegalCase linked requisition
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "linkedRequisitionId" UUID;
CREATE INDEX IF NOT EXISTS "LegalCase_linkedRequisitionId_idx" ON "LegalCase"("linkedRequisitionId");
DO $$ BEGIN
  ALTER TABLE "LegalCase"
    ADD CONSTRAINT "LegalCase_linkedRequisitionId_fkey"
    FOREIGN KEY ("linkedRequisitionId") REFERENCES "Requisition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Opposition Phase 1 fields
ALTER TABLE "Opposition" ADD COLUMN IF NOT EXISTS "referenceDate" TIMESTAMP(3);
ALTER TABLE "Opposition" ADD COLUMN IF NOT EXISTS "impact" TEXT;
ALTER TABLE "Opposition" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Opposition" ADD COLUMN IF NOT EXISTS "sourceDocumentId" UUID;
DO $$ BEGIN
  ALTER TABLE "Opposition"
    ADD CONSTRAINT "Opposition_sourceDocumentId_fkey"
    FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Requisition_isPrincipal_idx" ON "Requisition"("isPrincipal");

-- TerrainEvent
CREATE TABLE IF NOT EXISTS "TerrainEvent" (
  "id" UUID NOT NULL,
  "requisitionId" UUID NOT NULL,
  "type" "TerrainEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "shortDescription" TEXT,
  "source" "TerrainEventSource" NOT NULL DEFAULT 'MANUAL',
  "sourceDocumentId" UUID,
  "hearingId" UUID,
  "legalCaseId" UUID,
  "createdByUserId" UUID,
  "validatedByUserId" UUID,
  "validationStatus" "TerrainEventValidationStatus" NOT NULL DEFAULT 'CONFIRMED',
  "isScheduled" BOOLEAN NOT NULL DEFAULT false,
  "scheduledAt" TIMESTAMP(3),
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerrainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TerrainEvent_requisitionId_occurredAt_idx" ON "TerrainEvent"("requisitionId", "occurredAt");
CREATE INDEX IF NOT EXISTS "TerrainEvent_requisitionId_validationStatus_occurredAt_idx" ON "TerrainEvent"("requisitionId", "validationStatus", "occurredAt");
CREATE INDEX IF NOT EXISTS "TerrainEvent_scheduledAt_isScheduled_idx" ON "TerrainEvent"("scheduledAt", "isScheduled");
CREATE INDEX IF NOT EXISTS "TerrainEvent_type_idx" ON "TerrainEvent"("type");

DO $$ BEGIN
  ALTER TABLE "TerrainEvent" ADD CONSTRAINT "TerrainEvent_requisitionId_fkey"
    FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TerrainEvent" ADD CONSTRAINT "TerrainEvent_sourceDocumentId_fkey"
    FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TerrainEvent" ADD CONSTRAINT "TerrainEvent_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TerrainEvent" ADD CONSTRAINT "TerrainEvent_validatedByUserId_fkey"
    FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- RequisitionStatusSnapshot
CREATE TABLE IF NOT EXISTS "RequisitionStatusSnapshot" (
  "id" UUID NOT NULL,
  "requisitionId" UUID NOT NULL,
  "currentStage" TEXT,
  "currentLabel" TEXT NOT NULL,
  "latestKnownEventId" UUID,
  "latestKnownEventAt" TIMESTAMP(3),
  "nextScheduledEventAt" TIMESTAMP(3),
  "judicialState" TEXT,
  "dataFreshness" "DataFreshnessCode" NOT NULL DEFAULT 'TO_CONFIRM',
  "lastVerifiedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequisitionStatusSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RequisitionStatusSnapshot_requisitionId_key" ON "RequisitionStatusSnapshot"("requisitionId");
CREATE INDEX IF NOT EXISTS "RequisitionStatusSnapshot_nextScheduledEventAt_idx" ON "RequisitionStatusSnapshot"("nextScheduledEventAt");
CREATE INDEX IF NOT EXISTS "RequisitionStatusSnapshot_dataFreshness_idx" ON "RequisitionStatusSnapshot"("dataFreshness");

DO $$ BEGIN
  ALTER TABLE "RequisitionStatusSnapshot" ADD CONSTRAINT "RequisitionStatusSnapshot_requisitionId_fkey"
    FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TerrainDraft
CREATE TABLE IF NOT EXISTS "TerrainDraft" (
  "id" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "status" "TerrainDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "proposedIdentityJson" JSONB,
  "proposedProceduralJson" JSONB,
  "analysisMessage" TEXT,
  "resultingRequisitionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerrainDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TerrainDraft_createdById_status_idx" ON "TerrainDraft"("createdById", "status");

DO $$ BEGIN
  ALTER TABLE "TerrainDraft" ADD CONSTRAINT "TerrainDraft_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "TerrainDraftDocument" (
  "id" UUID NOT NULL,
  "draftId" UUID NOT NULL,
  "category" "DocumentCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "documentDate" TIMESTAMP(3),
  "storageProvider" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "cloudinaryPublicId" TEXT,
  "cloudinaryAssetId" TEXT,
  "cloudinaryResourceType" TEXT,
  "cloudinaryDeliveryType" TEXT,
  "format" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerrainDraftDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TerrainDraftDocument_storageKey_key" ON "TerrainDraftDocument"("storageKey");
CREATE INDEX IF NOT EXISTS "TerrainDraftDocument_draftId_category_idx" ON "TerrainDraftDocument"("draftId", "category");

DO $$ BEGIN
  ALTER TABLE "TerrainDraftDocument" ADD CONSTRAINT "TerrainDraftDocument_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "TerrainDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AIExtraction
CREATE TABLE IF NOT EXISTS "AIExtraction" (
  "id" UUID NOT NULL,
  "requisitionId" UUID,
  "documentId" UUID,
  "draftId" UUID,
  "extractionType" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "confidence" "FactConfidence" NOT NULL DEFAULT 'MOYENNE',
  "status" "AIExtractionStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdById" UUID,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIExtraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AIExtraction_requisitionId_status_idx" ON "AIExtraction"("requisitionId", "status");
CREATE INDEX IF NOT EXISTS "AIExtraction_draftId_status_idx" ON "AIExtraction"("draftId", "status");
CREATE INDEX IF NOT EXISTS "AIExtraction_documentId_idx" ON "AIExtraction"("documentId");

DO $$ BEGIN
  ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_requisitionId_fkey"
    FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "TerrainDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Soft-map existing ACTES_PROPRIETE documents presentation remains valid;
-- optional copy into ACTES for new uploads only (no forced rewrite of historical rows).
