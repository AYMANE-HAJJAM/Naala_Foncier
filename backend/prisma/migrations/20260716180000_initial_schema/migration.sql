-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('CRITIQUE', 'ELEVE_CRITIQUE', 'ELEVE', 'MOYEN', 'FAIBLE', 'A_CONFIRMER', 'CRITIQUE_OPERATIONNEL');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('EN_COURS', 'AU_TRIBUNAL', 'AUDIENCE_PROGRAMMEE', 'DELIBERE', 'BORNAGE_BLOQUE', 'DOCUMENTS_INCOMPLETS', 'ACTION_REQUISE', 'A_CONFIRMER', 'CLOTURE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('FICHE_SYNTHESE', 'ANCFCC', 'ACTES_PROPRIETE', 'OPPOSITIONS', 'TRIBUNAL', 'TOPOGRAPHIE', 'TERRAIN', 'CORRESPONDANCES', 'RAPPORTS', 'AUTRE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DISPONIBLE', 'MANQUANT', 'INCOMPLET', 'ILLISIBLE', 'A_ACTUALISER', 'VALIDE');

-- CreateEnum
CREATE TYPE "DocumentConfidentiality" AS ENUM ('INTERNE', 'CONFIDENTIEL', 'RESTREINT');

-- CreateEnum
CREATE TYPE "SourceQuality" AS ENUM ('BONNE', 'MOYENNE', 'FAIBLE');

-- CreateEnum
CREATE TYPE "DocumentRequestPriority" AS ENUM ('URGENTE', 'HAUTE', 'NORMALE', 'FAIBLE');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('A_DEMANDER', 'DEMANDE', 'RELANCE', 'RECU', 'ANNULE');

-- CreateEnum
CREATE TYPE "OppositionIdentityStatus" AS ENUM ('DEMONSTRATION_NON_VERIFIEE', 'A_CONFIRMER', 'VERIFIEE');

-- CreateEnum
CREATE TYPE "OppositionType" AS ENUM ('TOTALE', 'PARTIELLE', 'DROITS_INDIVIS', 'SERVITUDE', 'INSTITUTIONNELLE', 'ISSUE_DU_BORNAGE', 'HORS_DELAI', 'A_QUALIFIER');

-- CreateEnum
CREATE TYPE "OppositionStrategy" AS ENUM ('CONTESTER', 'NEGOCIER', 'ISOLER', 'REGULARISER', 'ANALYSER', 'DEMANDER_DES_PIECES');

-- CreateEnum
CREATE TYPE "HearingEventType" AS ENUM ('DEPOT', 'AUDIENCE', 'REPORT', 'MEMOIRE_DEPOSE', 'MOUDAWALA', 'JUGEMENT', 'APPEL', 'BORNAGE', 'RELANCE', 'REUNION', 'ECHEANCE_DOCUMENTAIRE');

-- CreateEnum
CREATE TYPE "HearingStatus" AS ENUM ('PLANIFIE', 'REALISE', 'SUIVI_REQUIS', 'ANNULE', 'REPORTE', 'A_CONFIRMER');

-- CreateEnum
CREATE TYPE "ActionCategory" AS ENUM ('JURIDIQUE', 'ANCFCC', 'TOPOGRAPHIE', 'TERRAIN', 'DOCUMENTATION', 'COORDINATION');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('URGENTE', 'HAUTE', 'NORMALE', 'FAIBLE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('A_FAIRE', 'EN_COURS', 'EN_ATTENTE', 'BLOQUEE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('BROUILLON', 'A_VALIDER', 'VALIDE', 'REJETE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ECHEC', 'PROVIDER_NON_CONFIGURE');

-- CreateEnum
CREATE TYPE "HumanValidationStatus" AS ENUM ('NON_COMMENCEE', 'A_VALIDER', 'PARTIELLE', 'VALIDEE');

-- CreateEnum
CREATE TYPE "DocumentAnalysisStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ECHEC');

-- CreateEnum
CREATE TYPE "FactConfidence" AS ENUM ('ELEVEE', 'MOYENNE', 'FAIBLE');

-- CreateEnum
CREATE TYPE "FactValidationStatus" AS ENUM ('A_VERIFIER', 'CONFIRME', 'CORRIGE', 'REJETE');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('CREATED', 'UPLOADED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "surfaceHectares" INTEGER NOT NULL,
    "surfaceAres" INTEGER NOT NULL,
    "surfaceCentiares" INTEGER NOT NULL,
    "sellerName" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "mainStatus" "RequisitionStatus" NOT NULL,
    "mainStatusLabel" TEXT,
    "mainIssue" TEXT NOT NULL,
    "summary" TEXT,
    "oppositionCount" INTEGER,
    "nextAction" TEXT,
    "criticalDetails" JSONB,
    "priorityRank" INTEGER,
    "importantDate" TIMESTAMP(3),
    "eventLabel" TEXT,
    "responsibleUserId" UUID,
    "createdById" UUID NOT NULL,
    "lastUpdatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionRelation" (
    "id" UUID NOT NULL,
    "sourceRequisitionId" UUID NOT NULL,
    "targetRequisitionId" UUID NOT NULL,
    "relationType" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "RequisitionRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "confidentiality" "DocumentConfidentiality" NOT NULL DEFAULT 'INTERNE',
    "currentVersionId" UUID,
    "createdById" UUID NOT NULL,
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256Checksum" TEXT,
    "pageCount" INTEGER,
    "sourceQuality" "SourceQuality" NOT NULL DEFAULT 'MOYENNE',
    "uploadedById" UUID NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "documentId" UUID,
    "requestedDocumentTitle" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "priority" "DocumentRequestPriority" NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL,
    "requestedFrom" TEXT,
    "assignedToId" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opposition" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "oppositionNumber" INTEGER,
    "opponentName" TEXT NOT NULL,
    "identityStatus" "OppositionIdentityStatus" NOT NULL DEFAULT 'DEMONSTRATION_NON_VERIFIEE',
    "type" "OppositionType" NOT NULL,
    "scope" TEXT NOT NULL,
    "claimedSurfaceHectares" INTEGER,
    "claimedSurfaceAres" INTEGER,
    "claimedSurfaceCentiares" INTEGER,
    "legalBasis" TEXT,
    "description" TEXT NOT NULL,
    "ancfccStatus" TEXT NOT NULL,
    "courtStatus" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "strategy" "OppositionStrategy" NOT NULL,
    "responsibleUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Opposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OppositionDocument" (
    "oppositionId" UUID NOT NULL,
    "documentId" UUID NOT NULL,

    CONSTRAINT "OppositionDocument_pkey" PRIMARY KEY ("oppositionId","documentId")
);

-- CreateTable
CREATE TABLE "LegalCase" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "courtName" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "currentPhase" TEXT NOT NULL,
    "lawyerUserId" UUID,
    "opposingParties" TEXT NOT NULL,
    "outcomeStatus" TEXT,
    "latestEventAt" TIMESTAMP(3),
    "nextEventAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hearing" (
    "id" UUID NOT NULL,
    "legalCaseId" UUID,
    "requisitionId" UUID NOT NULL,
    "eventType" "HearingEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "HearingStatus" NOT NULL,
    "result" TEXT,
    "minutesDocumentId" UUID,
    "responsibleUserId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" UUID NOT NULL,
    "requisitionId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ActionCategory" NOT NULL,
    "priority" "ActionPriority" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'A_FAIRE',
    "responsibleUserId" UUID,
    "createdById" UUID NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "blockage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionComment" (
    "id" UUID NOT NULL,
    "actionItemId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "requisitionId" UUID,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "requisitionId" UUID,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'BROUILLON',
    "currentVersionId" UUID,
    "createdById" UUID NOT NULL,
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportVersion" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "contentJson" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ReportVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysisJob" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "status" "AIJobStatus" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "requestedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "humanValidationStatus" "HumanValidationStatus" NOT NULL DEFAULT 'NON_COMMENCEE',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysisDocument" (
    "aiAnalysisJobId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,

    CONSTRAINT "AIAnalysisDocument_pkey" PRIMARY KEY ("aiAnalysisJobId","documentVersionId")
);

-- CreateTable
CREATE TABLE "DocumentAnalysis" (
    "id" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "status" "DocumentAnalysisStatus" NOT NULL,
    "extractedText" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "DocumentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedFact" (
    "id" UUID NOT NULL,
    "documentAnalysisId" UUID NOT NULL,
    "factType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "sourcePage" INTEGER,
    "confidence" "FactConfidence" NOT NULL,
    "validationStatus" "FactValidationStatus" NOT NULL DEFAULT 'A_VERIFIER',
    "correctedValue" TEXT,
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "ExtractedFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "documentId" UUID,
    "requestedById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_deletedAt_idx" ON "User"("isActive", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_revokedAt_idx" ON "RefreshToken"("expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_reference_key" ON "Requisition"("reference");

-- CreateIndex
CREATE INDEX "Requisition_riskLevel_mainStatus_idx" ON "Requisition"("riskLevel", "mainStatus");

-- CreateIndex
CREATE INDEX "Requisition_location_idx" ON "Requisition"("location");

-- CreateIndex
CREATE INDEX "Requisition_buyerName_idx" ON "Requisition"("buyerName");

-- CreateIndex
CREATE INDEX "Requisition_deletedAt_idx" ON "Requisition"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionRelation_sourceRequisitionId_targetRequisitionId_key" ON "RequisitionRelation"("sourceRequisitionId", "targetRequisitionId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentVersionId_key" ON "Document"("currentVersionId");

-- CreateIndex
CREATE INDEX "Document_requisitionId_category_status_idx" ON "Document"("requisitionId", "category", "status");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_dueDate_idx" ON "DocumentRequest"("status", "dueDate");

-- CreateIndex
CREATE INDEX "DocumentRequest_requisitionId_priority_idx" ON "DocumentRequest"("requisitionId", "priority");

-- CreateIndex
CREATE INDEX "Opposition_type_riskLevel_idx" ON "Opposition"("type", "riskLevel");

-- CreateIndex
CREATE INDEX "Opposition_deletedAt_idx" ON "Opposition"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opposition_requisitionId_oppositionNumber_key" ON "Opposition"("requisitionId", "oppositionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LegalCase_caseNumber_key" ON "LegalCase"("caseNumber");

-- CreateIndex
CREATE INDEX "LegalCase_currentPhase_nextEventAt_idx" ON "LegalCase"("currentPhase", "nextEventAt");

-- CreateIndex
CREATE INDEX "LegalCase_deletedAt_idx" ON "LegalCase"("deletedAt");

-- CreateIndex
CREATE INDEX "Hearing_scheduledAt_status_idx" ON "Hearing"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "Hearing_requisitionId_eventType_idx" ON "Hearing"("requisitionId", "eventType");

-- CreateIndex
CREATE INDEX "ActionItem_status_dueDate_idx" ON "ActionItem"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ActionItem_responsibleUserId_status_idx" ON "ActionItem"("responsibleUserId", "status");

-- CreateIndex
CREATE INDEX "ActionItem_deletedAt_idx" ON "ActionItem"("deletedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_currentVersionId_key" ON "Report"("currentVersionId");

-- CreateIndex
CREATE INDEX "Report_status_requisitionId_idx" ON "Report"("status", "requisitionId");

-- CreateIndex
CREATE INDEX "Report_deletedAt_idx" ON "Report"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportVersion_reportId_versionNumber_key" ON "ReportVersion"("reportId", "versionNumber");

-- CreateIndex
CREATE INDEX "AIAnalysisJob_status_createdAt_idx" ON "AIAnalysisJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_storageKey_key" ON "UploadSession"("storageKey");

-- CreateIndex
CREATE INDEX "UploadSession_status_expiresAt_idx" ON "UploadSession"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionRelation" ADD CONSTRAINT "RequisitionRelation_sourceRequisitionId_fkey" FOREIGN KEY ("sourceRequisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionRelation" ADD CONSTRAINT "RequisitionRelation_targetRequisitionId_fkey" FOREIGN KEY ("targetRequisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opposition" ADD CONSTRAINT "Opposition_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opposition" ADD CONSTRAINT "Opposition_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OppositionDocument" ADD CONSTRAINT "OppositionDocument_oppositionId_fkey" FOREIGN KEY ("oppositionId") REFERENCES "Opposition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OppositionDocument" ADD CONSTRAINT "OppositionDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCase" ADD CONSTRAINT "LegalCase_lawyerUserId_fkey" FOREIGN KEY ("lawyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_legalCaseId_fkey" FOREIGN KEY ("legalCaseId") REFERENCES "LegalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_minutesDocumentId_fkey" FOREIGN KEY ("minutesDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionComment" ADD CONSTRAINT "ActionComment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionComment" ADD CONSTRAINT "ActionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ReportVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportVersion" ADD CONSTRAINT "ReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysisJob" ADD CONSTRAINT "AIAnalysisJob_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysisJob" ADD CONSTRAINT "AIAnalysisJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysisDocument" ADD CONSTRAINT "AIAnalysisDocument_aiAnalysisJobId_fkey" FOREIGN KEY ("aiAnalysisJobId") REFERENCES "AIAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysisDocument" ADD CONSTRAINT "AIAnalysisDocument_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysis" ADD CONSTRAINT "DocumentAnalysis_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_documentAnalysisId_fkey" FOREIGN KEY ("documentAnalysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
