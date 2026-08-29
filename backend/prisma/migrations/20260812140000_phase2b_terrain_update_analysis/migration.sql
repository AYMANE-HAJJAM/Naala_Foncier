-- Phase 2B: extend AI analysis for existing terrain document updates

CREATE TYPE "AIAnalysisContextType" AS ENUM ('TERRAIN_CREATION', 'EXISTING_TERRAIN_UPDATE');

ALTER TYPE "AIAnalysisRunStatus" ADD VALUE IF NOT EXISTS 'NO_CHANGE';

ALTER TABLE "AIAnalysisRun" ADD COLUMN IF NOT EXISTS "contextType" "AIAnalysisContextType" NOT NULL DEFAULT 'TERRAIN_CREATION';
ALTER TABLE "AIAnalysisRun" ADD COLUMN IF NOT EXISTS "requisitionId" UUID;
ALTER TABLE "AIAnalysisRun" ADD COLUMN IF NOT EXISTS "documentId" UUID;
ALTER TABLE "AIAnalysisRun" ADD COLUMN IF NOT EXISTS "documentVersionId" UUID;

ALTER TABLE "AIAnalysisRun" ALTER COLUMN "draftId" DROP NOT NULL;

ALTER TABLE "AIExtraction" ADD COLUMN IF NOT EXISTS "analysisRunId" UUID;

CREATE INDEX IF NOT EXISTS "AIAnalysisRun_requisitionId_documentId_status_createdAt_idx"
  ON "AIAnalysisRun"("requisitionId", "documentId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "AIExtraction_analysisRunId_status_idx"
  ON "AIExtraction"("analysisRunId", "status");

ALTER TABLE "AIAnalysisRun"
  ADD CONSTRAINT "AIAnalysisRun_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAnalysisRun"
  ADD CONSTRAINT "AIAnalysisRun_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIExtraction"
  ADD CONSTRAINT "AIExtraction_analysisRunId_fkey"
  FOREIGN KEY ("analysisRunId") REFERENCES "AIAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
