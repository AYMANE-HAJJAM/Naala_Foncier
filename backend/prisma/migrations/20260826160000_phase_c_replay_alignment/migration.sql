-- AlterTable
ALTER TABLE "AIExtraction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "previewDocumentId" UUID;

-- AlterTable
ALTER TABLE "Requisition" ADD COLUMN IF NOT EXISTS "constraintsJson" JSONB,
ADD COLUMN IF NOT EXISTS "courtReached" TEXT,
ADD COLUMN IF NOT EXISTS "currentSituation" TEXT,
ADD COLUMN IF NOT EXISTS "dataFreshness" TEXT,
ADD COLUMN IF NOT EXISTS "eventResult" TEXT,
ADD COLUMN IF NOT EXISTS "judicialResult" TEXT,
ADD COLUMN IF NOT EXISTS "lastManuallyUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "latestJudicialEvent" TEXT,
ADD COLUMN IF NOT EXISTS "latestJudicialEventAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "latestKnownEvent" TEXT,
ADD COLUMN IF NOT EXISTS "latestKnownEventAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextScheduledEventAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pointsToClarifyJson" JSONB,
ADD COLUMN IF NOT EXISTS "resolutionStepsJson" JSONB,
ADD COLUMN IF NOT EXISTS "summarySourceMeta" JSONB;

-- AlterTable
ALTER TABLE "RequisitionStatusSnapshot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TerrainDraft" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TerrainEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_previewDocumentId_fkey"
    FOREIGN KEY ("previewDocumentId") REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
