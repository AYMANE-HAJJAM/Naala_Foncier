-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PARTAGE', 'INTERNE');

-- CreateEnum
CREATE TYPE "CourtStage" AS ENUM (
  'NON_TRANSMIS',
  'TRANSMISSION_EN_COURS',
  'TRANSMIS_AU_TRIBUNAL',
  'ENREGISTRE_AU_TRIBUNAL',
  'EN_ATTENTE_AUDIENCE',
  'AUDIENCE_PROGRAMMEE',
  'AUDIENCE_TENUE',
  'REPORTE',
  'MEMOIRE_A_DEPOSER',
  'EN_DELIBERE',
  'DECISION_RENDUE',
  'APPEL_EN_COURS',
  'CLOTURE',
  'A_CONFIRMER'
);

-- CreateEnum
CREATE TYPE "ReportScope" AS ENUM ('REQUISITION', 'PORTFOLIO');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PARTAGE';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "documentDate" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- AlterTable LegalCase
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "courtCity" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "currentStage" "CourtStage" NOT NULL DEFAULT 'A_CONFIRMER';
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "currentStatus" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "registrationDate" TIMESTAMP(3);
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "generalObservation" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "externalSource" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "externalReference" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "lastExternalCheckAt" TIMESTAMP(3);
ALTER TABLE "LegalCase" ADD COLUMN IF NOT EXISTS "externalPayloadHash" TEXT;

-- AlterTable Hearing
ALTER TABLE "Hearing" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Hearing" ADD COLUMN IF NOT EXISTS "nextAction" TEXT;
ALTER TABLE "Hearing" ADD COLUMN IF NOT EXISTS "nextDate" TIMESTAMP(3);
ALTER TABLE "Hearing" ADD COLUMN IF NOT EXISTS "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PARTAGE';
ALTER TABLE "Hearing" ADD COLUMN IF NOT EXISTS "createdById" UUID;

-- AlterTable Report
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "scope" "ReportScope" NOT NULL DEFAULT 'REQUISITION';
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reportDate" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "documentId" UUID;

-- CreateTable NotificationReminder
CREATE TABLE IF NOT EXISTS "NotificationReminder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requisitionId" UUID,
    "hearingId" UUID,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationReminder_dedupeKey_key" ON "NotificationReminder"("dedupeKey");
CREATE INDEX IF NOT EXISTS "NotificationReminder_dueAt_sentAt_idx" ON "NotificationReminder"("dueAt", "sentAt");
CREATE INDEX IF NOT EXISTS "NotificationReminder_userId_kind_idx" ON "NotificationReminder"("userId", "kind");

CREATE INDEX IF NOT EXISTS "Document_requisitionId_visibility_idx" ON "Document"("requisitionId", "visibility");
CREATE INDEX IF NOT EXISTS "LegalCase_currentStage_nextEventAt_idx" ON "LegalCase"("currentStage", "nextEventAt");
CREATE INDEX IF NOT EXISTS "LegalCase_caseNumber_idx" ON "LegalCase"("caseNumber");
CREATE INDEX IF NOT EXISTS "Hearing_nextDate_status_idx" ON "Hearing"("nextDate", "status");
CREATE INDEX IF NOT EXISTS "Report_scope_requisitionId_idx" ON "Report"("scope", "requisitionId");

ALTER TABLE "Hearing" DROP CONSTRAINT IF EXISTS "Hearing_createdById_fkey";
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_documentId_fkey";
ALTER TABLE "Report" ADD CONSTRAINT "Report_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationReminder" DROP CONSTRAINT IF EXISTS "NotificationReminder_userId_fkey";
ALTER TABLE "NotificationReminder" ADD CONSTRAINT "NotificationReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationReminder" DROP CONSTRAINT IF EXISTS "NotificationReminder_hearingId_fkey";
ALTER TABLE "NotificationReminder" ADD CONSTRAINT "NotificationReminder_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "Hearing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only restrict highly confidential docs; default remains PARTAGE for operational sharing
UPDATE "Document" SET "visibility" = 'INTERNE' WHERE "confidentiality" IN ('CONFIDENTIEL', 'RESTREINT');
