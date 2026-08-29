-- Phase 2A: draft AI analysis runs + extended proposal persistence
CREATE TYPE "AIAnalysisRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'STALE');

ALTER TABLE "TerrainDraft" ADD COLUMN IF NOT EXISTS "proposedAnalysisJson" JSONB;
ALTER TABLE "TerrainDraft" ADD COLUMN IF NOT EXISTS "analysisFingerprint" TEXT;
ALTER TABLE "TerrainDraft" ADD COLUMN IF NOT EXISTS "latestAnalysisRunId" UUID;

CREATE TABLE IF NOT EXISTS "AIAnalysisRun" (
  "id" UUID NOT NULL,
  "draftId" UUID NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "status" "AIAnalysisRunStatus" NOT NULL DEFAULT 'PENDING',
  "fingerprint" TEXT NOT NULL,
  "phase" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIAnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AIAnalysisRun_draftId_status_createdAt_idx" ON "AIAnalysisRun"("draftId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AIAnalysisRun_fingerprint_idx" ON "AIAnalysisRun"("fingerprint");

DO $$ BEGIN
  ALTER TABLE "AIAnalysisRun" ADD CONSTRAINT "AIAnalysisRun_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "TerrainDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
