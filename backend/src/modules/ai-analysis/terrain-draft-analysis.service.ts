import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { StorageService } from "../../shared/storage/storage.service.js";
import {
  DocumentAnalysisNotConfiguredError,
  DocumentAnalysisProviderError,
  computeDraftFingerprint,
  emptyProposal,
  type TerrainDocumentsAnalysisResult,
} from "./document-analysis.provider.js";
import { prepareAnalysisInputs } from "./document-input.preparer.js";
import { ConfigurableDocumentAnalysisProvider } from "./providers.js";

@Injectable()
export class TerrainDraftAnalysisService {
  private readonly logger = new Logger(TerrainDraftAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly analysis: ConfigurableDocumentAnalysisProvider,
    private readonly config: ConfigService,
  ) {}

  async startAnalysis(draftId: string, user: AuthUser, force = false) {
    const draft = await this.getOwnedDraft(draftId, user);
    if (!draft.documents.length) {
      throw new BadRequestException({
        code: "NO_DOCUMENTS",
        message: "Ajoutez au moins un document avant l’analyse.",
      });
    }

    const fingerprint = computeDraftFingerprint(draft.documents);

    if (!force) {
      const latest = draft.latestAnalysisRunId
        ? await this.prisma.aIAnalysisRun.findUnique({
            where: { id: draft.latestAnalysisRunId },
          })
        : await this.prisma.aIAnalysisRun.findFirst({
            where: { draftId, status: "COMPLETED", fingerprint },
            orderBy: { createdAt: "desc" },
          });
      if (
        latest?.status === "COMPLETED" &&
        latest.fingerprint === fingerprint &&
        latest.resultJson
      ) {
        return {
          analysisRunId: latest.id,
          status: latest.status,
          reused: true,
          stale: false,
        };
      }
    }

    if (!this.analysis.isConfigured()) {
      const run = await this.prisma.aIAnalysisRun.create({
        data: {
          draftId,
          provider: this.analysis.name,
          model: this.config.get<string>("AI_MODEL") || null,
          status: "FAILED",
          fingerprint,
          phase: "provider",
          startedAt: new Date(),
          completedAt: new Date(),
          errorCode: "AI_PROVIDER_NOT_CONFIGURED",
          errorMessage:
            "Analyse automatique indisponible. Vous pouvez compléter les informations manuellement.",
          resultJson: emptyProposal(),
        },
      });
      await this.prisma.terrainDraft.update({
        where: { id: draftId },
        data: {
          status: "READY_FOR_REVIEW",
          latestAnalysisRunId: run.id,
          analysisFingerprint: fingerprint,
          analysisMessage: run.errorMessage,
          proposedAnalysisJson: emptyProposal(),
        },
      });
      return {
        analysisRunId: run.id,
        status: run.status,
        reused: false,
        stale: false,
        errorCode: "AI_PROVIDER_NOT_CONFIGURED",
      };
    }

    const run = await this.prisma.aIAnalysisRun.create({
      data: {
        draftId,
        provider: this.analysis.name,
        model: this.config.get<string>("AI_MODEL") || null,
        status: "PENDING",
        fingerprint,
        phase: "prepare",
      },
    });
    await this.prisma.terrainDraft.update({
      where: { id: draftId },
      data: {
        status: "ANALYZING",
        latestAnalysisRunId: run.id,
        analysisFingerprint: fingerprint,
      },
    });

    // Fire-and-forget background processing (Nest request lifecycle independent).
    void this.processRun(run.id, user.id);

    return {
      analysisRunId: run.id,
      status: "PENDING" as const,
      reused: false,
      stale: false,
    };
  }

  async getAnalysis(draftId: string, user: AuthUser) {
    const draft = await this.getOwnedDraft(draftId, user);
    const fingerprint = computeDraftFingerprint(draft.documents);
    const run = draft.latestAnalysisRunId
      ? await this.prisma.aIAnalysisRun.findUnique({
          where: { id: draft.latestAnalysisRunId },
        })
      : await this.prisma.aIAnalysisRun.findFirst({
          where: { draftId },
          orderBy: { createdAt: "desc" },
        });

    if (!run) {
      return {
        analysisRunId: null,
        status: null,
        phase: null,
        stale: false,
        currentFingerprint: fingerprint,
        result: null,
        errorCode: null,
        errorMessage: null,
      };
    }

    const stale =
      run.status === "COMPLETED" && run.fingerprint !== fingerprint;

    return {
      analysisRunId: run.id,
      status: stale ? "STALE" : run.status,
      phase: run.phase,
      stale,
      currentFingerprint: fingerprint,
      result: (run.resultJson as TerrainDocumentsAnalysisResult | null) ?? null,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      provider: run.provider,
      model: run.model,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }

  private async processRun(runId: string, userId: string) {
    const run = await this.prisma.aIAnalysisRun.findUnique({
      where: { id: runId },
      include: {
        draft: { include: { documents: { orderBy: { uploadedAt: "asc" } } } },
      },
    });
    if (!run || !run.draft) return;

    const draftId = run.draftId;
    if (!draftId) return;

    try {
      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: { status: "PROCESSING", phase: "download", startedAt: new Date() },
      });

      const preparedDocs: Array<{
        id: string;
        category: string;
        customCategoryName?: string | null;
        originalFilename: string;
        mimeType: string;
        storageKey: string;
        bytes: Buffer;
      }> = [];

      for (const d of run.draft.documents) {
        try {
          const obj = await this.storage.fetchObjectBytes(d.storageKey);
          preparedDocs.push({
            id: d.id,
            category: d.category,
            customCategoryName: d.customCategoryName,
            originalFilename: d.originalFilename,
            mimeType: d.mimeType,
            storageKey: d.storageKey,
            bytes: Buffer.isBuffer(obj.buffer)
              ? obj.buffer
              : Buffer.from(obj.buffer),
          });
        } catch (err) {
          this.logger.warn(
            `Failed to fetch draft document ${d.id}: ${(err as Error).message}`,
          );
          throw new DocumentAnalysisProviderError(
            "AI_FILE_UNREADABLE",
            `Impossible de lire le fichier « ${d.originalFilename} ».`,
          );
        }
      }

      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: { phase: "read" },
      });

      const inputs = await prepareAnalysisInputs(preparedDocs);

      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: { phase: "crosscheck" },
      });

      let result: TerrainDocumentsAnalysisResult;
      try {
        result = await this.analysis.analyzeTerrainDocuments(inputs);
      } catch (err) {
        if (err instanceof DocumentAnalysisNotConfiguredError) {
          result = emptyProposal(err.message);
          await this.fail(runId, draftId, "AI_PROVIDER_NOT_CONFIGURED", err.message, result);
          return;
        }
        throw err;
      }

      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: { phase: "prepare_form" },
      });

      await this.prisma.aIExtraction.create({
        data: {
          draftId,
          extractionType: "TERRAIN_WIZARD",
          payloadJson: result,
          confidence: "MOYENNE",
          status: "PROPOSED",
          createdById: userId,
        },
      });

      // Per-field audit rows for identity (compact).
      for (const [fieldKey, field] of Object.entries(result.terrainIdentity)) {
        await this.prisma.aIExtraction.create({
          data: {
            draftId,
            extractionType: `IDENTITY.${fieldKey}`,
            payloadJson: field,
            confidence:
              field.confidence === "HIGH"
                ? "ELEVEE"
                : field.confidence === "MEDIUM"
                  ? "MOYENNE"
                  : "FAIBLE",
            status: "PROPOSED",
            createdById: userId,
          },
        });
      }

      await this.prisma.aIAnalysisRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          phase: "done",
          completedAt: new Date(),
          resultJson: result,
          errorCode: null,
          errorMessage: null,
        },
      });

      await this.prisma.terrainDraft.update({
        where: { id: draftId },
        data: {
          status: "READY_FOR_REVIEW",
          analysisMessage: result.message ?? null,
          proposedIdentityJson: result.terrainIdentity,
          proposedProceduralJson: result.proceduralFacts,
          proposedAnalysisJson: result,
          latestAnalysisRunId: runId,
        },
      });
    } catch (err) {
      const code =
        err instanceof DocumentAnalysisProviderError
          ? err.code
          : "AI_ANALYSIS_FAILED";
      const message =
        err instanceof Error
          ? err.message
          : "L’analyse automatique n’a pas pu être terminée.";
      this.logger.error(`Analysis run ${runId} failed: ${message}`);
      await this.fail(runId, draftId, code, message, emptyProposal(message));
    }
  }

  private async fail(
    runId: string,
    draftId: string,
    code: string,
    message: string,
    result: TerrainDocumentsAnalysisResult,
  ) {
    await this.prisma.aIAnalysisRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorCode: code,
        errorMessage: message,
        resultJson: result,
      },
    });
    await this.prisma.terrainDraft.update({
      where: { id: draftId },
      data: {
        status: "READY_FOR_REVIEW",
        analysisMessage: message,
        proposedAnalysisJson: result,
        latestAnalysisRunId: runId,
      },
    });
  }

  private async getOwnedDraft(id: string, user: AuthUser) {
    const draft = await this.prisma.terrainDraft.findUnique({
      where: { id },
      include: { documents: { orderBy: { uploadedAt: "desc" } } },
    });
    if (!draft) {
      throw new NotFoundException({
        code: "DRAFT_NOT_FOUND",
        message: "Brouillon de terrain introuvable.",
      });
    }
    if (draft.createdById !== user.id && !user.roles.includes("ADMIN")) {
      throw new ForbiddenException({
        code: "DRAFT_FORBIDDEN",
        message: "Ce brouillon ne vous appartient pas.",
      });
    }
    return draft;
  }
}
