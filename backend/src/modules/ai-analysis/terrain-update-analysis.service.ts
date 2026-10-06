import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { toPrismaJsonObject } from "../../shared/database/prisma-json.js";
import { StorageService } from "../../shared/storage/storage.service.js";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import { DocumentAnalysisNotConfiguredError, DocumentAnalysisProviderError } from "./document-analysis.provider.js";
import { prepareAnalysisInputs } from "./document-input.preparer.js";
import { TerrainOfficialContextBuilder } from "./terrain-official-context.builder.js";
import {
  computeDocumentAnalysisFingerprint,
  type TerrainUpdateAnalysisResult,
} from "./terrain-update-analysis.provider.js";
import {
  confidenceToFactConfidence,
  dedupeAndNormalizeProposals,
  mapConflictsToProposals,
} from "./terrain-update-dedupe.js";
import { ConfigurableTerrainUpdateAnalysisProvider } from "./terrain-update-providers.js";
import { NotificationsService } from "../notifications/notifications.service.js";

@Injectable()
export class TerrainUpdateAnalysisService {
  private readonly logger = new Logger(TerrainUpdateAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly analysis: ConfigurableTerrainUpdateAnalysisProvider,
    private readonly contextBuilder: TerrainOfficialContextBuilder,
    private readonly config: ConfigService,
    private readonly access: AccessScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  async triggerAfterUpload(
    requisitionId: string,
    documentId: string,
    documentVersionId: string,
    userId: string,
  ) {
    const fingerprint = computeDocumentAnalysisFingerprint(documentId, documentVersionId);

    const existing = await this.prisma.aIAnalysisRun.findFirst({
      where: {
        contextType: "EXISTING_TERRAIN_UPDATE",
        documentId,
        documentVersionId,
        status: { in: ["COMPLETED", "NO_CHANGE", "PROCESSING", "PENDING"] },
        fingerprint,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.status !== "FAILED") {
      return { analysisRunId: existing.id, status: existing.status, reused: true };
    }

    const run = await this.prisma.aIAnalysisRun.create({
      data: {
        contextType: "EXISTING_TERRAIN_UPDATE",
        requisitionId,
        documentId,
        documentVersionId,
        provider: this.analysis.name,
        model: this.config.get<string>("AI_MODEL") || null,
        status: this.analysis.isConfigured() ? "PENDING" : "FAILED",
        fingerprint,
        phase: "prepare",
        ...(this.analysis.isConfigured()
          ? {}
          : {
              startedAt: new Date(),
              completedAt: new Date(),
              errorCode: "AI_PROVIDER_NOT_CONFIGURED",
              errorMessage:
                "Analyse automatique indisponible. Vous pouvez continuer sans analyse automatique.",
            }),
      },
    });

    if (!this.analysis.isConfigured()) {
      return {
        analysisRunId: run.id,
        status: run.status,
        reused: false,
        errorCode: "AI_PROVIDER_NOT_CONFIGURED",
      };
    }

    void this.processRun(run.id, userId);
    return { analysisRunId: run.id, status: "PENDING" as const, reused: false };
  }

  async retryAnalysis(requisitionId: string, documentId: string, user: AuthUser) {
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "AI_RETRY_FORBIDDEN",
        message: "Seul un administrateur peut relancer l’analyse.",
      });
    }
    await this.access.assertCanAccessRequisition(user, requisitionId);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, requisitionId, deletedAt: null },
      include: { currentVersion: true },
    });
    if (!doc?.currentVersion) throw new NotFoundException("Document introuvable.");
    return this.triggerAfterUpload(
      requisitionId,
      documentId,
      doc.currentVersion.id,
      user.id,
    );
  }

  async getDocumentAnalysisStatus(
    requisitionId: string,
    documentId: string,
    user: AuthUser,
  ) {
    await this.access.assertCanAccessRequisition(user, requisitionId);
    const run = await this.prisma.aIAnalysisRun.findFirst({
      where: {
        contextType: "EXISTING_TERRAIN_UPDATE",
        requisitionId,
        documentId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        extractions: {
          where: { status: "PROPOSED" },
        },
      },
    });
    if (!run) {
      return {
        analysisRunId: null,
        status: null,
        proposalCount: 0,
        errorCode: null,
        errorMessage: null,
        noChange: false,
      };
    }

    const proposalCount = run.extractions.length;
    const isAdmin = this.access.isAdmin(user);

    return {
      analysisRunId: run.id,
      status: run.status,
      phase: run.phase,
      proposalCount: isAdmin ? proposalCount : proposalCount > 0 ? 1 : 0,
      pendingReview: proposalCount > 0,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      noChange: run.status === "NO_CHANGE",
      completedAt: run.completedAt?.toISOString() ?? null,
      ...(isAdmin
        ? {}
        : {
            userMessage:
              run.status === "PROCESSING" || run.status === "PENDING"
                ? "Analyse automatique en cours"
                : run.status === "NO_CHANGE"
                  ? "Aucune nouvelle information détectée"
                  : proposalCount > 0
                    ? "Document analysé — mise à jour en attente de validation"
                    : run.status === "FAILED"
                      ? "Analyse automatique indisponible"
                      : null,
          }),
    };
  }

  private async processRun(runId: string, userId: string) {
    const run = await this.prisma.aIAnalysisRun.findUnique({
      where: { id: runId },
      include: {
        document: {
          include: { currentVersion: true, requisition: { select: { reference: true } } },
        },
      },
    });
    if (!run?.document?.currentVersion || !run.requisitionId) return;

    try {
      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: { status: "PROCESSING", phase: "download", startedAt: new Date() },
      });

      const version = run.document.currentVersion;
      const bytes = await this.storage.fetchObjectBytes(
        version.cloudinaryPublicId ?? version.storageKey,
        {
          resourceType: version.cloudinaryResourceType ?? undefined,
          format: version.format ?? undefined,
        },
      );
      const buffer = Buffer.isBuffer(bytes.buffer) ? bytes.buffer : Buffer.from(bytes.buffer);

      const [prepared] = await prepareAnalysisInputs([
        {
          id: run.documentId!,
          category: run.document.category,
          customCategoryName: run.document.customCategoryName,
          originalFilename: version.originalFilename,
          mimeType: version.mimeType,
          storageKey: version.storageKey,
          bytes: buffer,
        },
      ]);

      const officialContext = await this.contextBuilder.build(run.requisitionId);

      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: { phase: "analyze" },
      });

      let result: TerrainUpdateAnalysisResult;
      try {
        result = await this.analysis.analyzeDocumentUpdate({
          requisitionId: run.requisitionId,
          documentId: run.documentId!,
          category: run.document.category,
          customCategoryName: run.document.customCategoryName,
          originalFilename: version.originalFilename,
          mimeType: version.mimeType,
          textExcerpt: prepared.textExcerpt,
          pageTexts: prepared.pageTexts,
          pageImages: prepared.pageImages,
          bytes: prepared.bytes,
          officialContext,
        });
      } catch (err) {
        if (err instanceof DocumentAnalysisNotConfiguredError) {
          await this.failRun(runId, "AI_PROVIDER_NOT_CONFIGURED", err.message);
          return;
        }
        throw err;
      }

      const conflictProposals = mapConflictsToProposals(result.conflicts ?? []);
      let proposals = dedupeAndNormalizeProposals(
        [...(result.detectedUpdates ?? []), ...conflictProposals],
        officialContext,
      );

      proposals = proposals.filter((p) => p.proposalType !== "NO_ACTION");

      const noChange =
        result.noChange || (!proposals.length && !(result.pointsToClarify?.length));

      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: {
          phase: "persist",
          resultJson: toPrismaJsonObject(result),
          status: noChange ? "NO_CHANGE" : "COMPLETED",
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });

      if (!noChange) {
        for (const p of proposals) {
          await this.prisma.aIExtraction.create({
            data: {
              requisitionId: run.requisitionId,
              documentId: run.documentId,
              analysisRunId: runId,
              extractionType: `TERRAIN_UPDATE.${p.proposalType}`,
              payloadJson: toPrismaJsonObject({
                ...p,
                sourceDocumentId: run.documentId,
                sourceFilename: version.originalFilename,
              }),
              confidence: confidenceToFactConfidence(p.confidence),
              status: "PROPOSED",
              createdById: userId,
            },
          });
        }

        await this.notifications.notifyAdminsOfTerrainUpdateProposals(
          run.requisitionId,
          run.document.requisition.reference,
          proposals.length,
          run.documentId!,
        );
      }
    } catch (err) {
      const code =
        err instanceof DocumentAnalysisProviderError ? err.code : "AI_ANALYSIS_FAILED";
      const message =
        err instanceof DocumentAnalysisProviderError ? err.message : "L’analyse automatique n’a pas pu être terminée.";
      this.logger.error(`Terrain update analysis ${runId} failed: ${code}`);
      await this.failRun(runId, code, message);
    }
  }

  private async failRun(runId: string, code: string, message: string) {
    await this.prisma.aIAnalysisRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorCode: code,
        errorMessage: message,
      },
    });
  }
}
