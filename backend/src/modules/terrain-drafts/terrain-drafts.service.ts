import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { toPrismaJsonObject } from "../../shared/database/prisma-json.js";
import { categoryFolderSegment } from "../../shared/storage/cloudinary-storage.service.js";
import { StorageService } from "../../shared/storage/storage.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StatusSnapshotService } from "../events/status-snapshot.service.js";
import { emptyProposal } from "../ai-analysis/document-analysis.provider.js";
import { TerrainDraftAnalysisService } from "../ai-analysis/terrain-draft-analysis.service.js";
import { titleFromOriginalFilename } from "../documents/documents.service.js";
import type {
  ConfirmTerrainDraftDto,
  CreateDraftUploadSessionDto,
  UpdateTerrainDraftReviewDto,
} from "./dto/terrain-draft.dto.js";

const WIZARD_CATEGORIES = new Set([
  "FICHE_SYNTHESE",
  "ANCFCC",
  "ACTES",
  "ACTES_PROPRIETE",
  "OPPOSITIONS",
  "TRIBUNAL",
  "TOPOGRAPHIE",
  "TERRAIN",
  "CORRESPONDANCES",
  "AUTRE",
]);

const CUSTOM_CATEGORY_MAX = 80;

function normalizeCustomCategoryName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

function assertCustomCategoryName(raw: string | null | undefined): string {
  const name = normalizeCustomCategoryName(raw);
  if (!name) {
    throw new BadRequestException({
      code: "CUSTOM_CATEGORY_REQUIRED",
      message: "Le nom de la catégorie personnalisée est obligatoire.",
    });
  }
  if (name.length > CUSTOM_CATEGORY_MAX) {
    throw new BadRequestException({
      code: "CUSTOM_CATEGORY_TOO_LONG",
      message: `Le nom de catégorie ne peut pas dépasser ${CUSTOM_CATEGORY_MAX} caractères.`,
    });
  }
  return name;
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 25 * 1024 * 1024;

function parseSurface(surface?: string | null) {
  if (!surface) return { surfaceHectares: 0, surfaceAres: 0, surfaceCentiares: 0 };
  const m = surface.match(/(\d+)\s*ha.*?(\d+)\s*a.*?(\d+)\s*ca/i);
  if (!m) return { surfaceHectares: 0, surfaceAres: 0, surfaceCentiares: 0 };
  return {
    surfaceHectares: Number(m[1]),
    surfaceAres: Number(m[2]),
    surfaceCentiares: Number(m[3]),
  };
}

@Injectable()
export class TerrainDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly draftAnalysis: TerrainDraftAnalysisService,
    private readonly snapshots: StatusSnapshotService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (!user.roles.includes("ADMIN") && !user.permissions.includes("requisition.create")) {
      throw new ForbiddenException({
        code: "DRAFT_FORBIDDEN",
        message: "Création de terrain réservée à l’administration.",
      });
    }
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

  present(draft: Awaited<ReturnType<TerrainDraftsService["getOwnedDraft"]>>) {
    return {
      id: draft.id,
      status: draft.status,
      analysisMessage: draft.analysisMessage,
      proposedIdentity: draft.proposedIdentityJson,
      proposedProcedural: draft.proposedProceduralJson,
      proposedAnalysis: draft.proposedAnalysisJson,
      analysisFingerprint: draft.analysisFingerprint,
      latestAnalysisRunId: draft.latestAnalysisRunId,
      resultingRequisitionId: draft.resultingRequisitionId,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
      documents: draft.documents.map((d) => ({
        id: d.id,
        category: d.category === "ACTES_PROPRIETE" ? "ACTES" : d.category,
        customCategoryName: d.customCategoryName ?? null,
        title: d.title,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        sizeBytes: Number(d.sizeBytes),
        documentDate: d.documentDate?.toISOString() ?? null,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    };
  }

  private resolveCustomCategory(
    category: string,
    customCategoryName: string | null | undefined,
  ): string | null {
    if (category !== "AUTRE") return null;
    return assertCustomCategoryName(customCategoryName);
  }

  async create(user: AuthUser) {
    this.assertAdmin(user);
    const draft = await this.prisma.terrainDraft.create({
      data: { createdById: user.id, status: "DRAFT" },
      include: { documents: true },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: "terrain_draft.create",
      entityType: "TerrainDraft",
      entityId: draft.id,
    });
    return this.present(draft);
  }

  async get(id: string, user: AuthUser) {
    this.assertAdmin(user);
    return this.present(await this.getOwnedDraft(id, user));
  }

  async createUploadSession(draftId: string, dto: CreateDraftUploadSessionDto, user: AuthUser) {
    this.assertAdmin(user);
    const draft = await this.getOwnedDraft(draftId, user);
    if (draft.status === "CONFIRMED" || draft.status === "CANCELLED") {
      throw new BadRequestException({
        code: "DRAFT_CLOSED",
        message: "Ce brouillon n’accepte plus de documents.",
      });
    }
    if (!WIZARD_CATEGORIES.has(dto.category)) {
      throw new BadRequestException({
        code: "INVALID_CATEGORY",
        message: "Catégorie de document invalide pour le wizard.",
      });
    }
    if (!ALLOWED_MIME.has(dto.mimeType)) {
      throw new UnsupportedMediaTypeException({
        code: "UNSUPPORTED_FILE_TYPE",
        message: "Type de fichier non supporté (PDF, DOCX, JPG, PNG, WEBP).",
      });
    }
    if (dto.sizeBytes > MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Le fichier dépasse la taille maximale de 25 Mo.",
      });
    }

    const category = dto.category === "ACTES_PROPRIETE" ? "ACTES" : dto.category;
    const customCategoryName = this.resolveCustomCategory(category, dto.customCategoryName);
    const folderRoot = this.config.get<string>("CLOUDINARY_UPLOAD_FOLDER", "naala-foncier");
    const customSeg = customCategoryName
      ? `/${customCategoryName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40) || "custom"}`
      : "";
    // Temporary draft path — no requisitionId yet
    const key = `${folderRoot}/drafts/${draft.id}/${categoryFolderSegment(category)}${customSeg}/${randomUUID()}`;

    let signed;
    try {
      signed = await this.storage.createPresignedUploadUrl(key, dto.mimeType, dto.sizeBytes);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException({
          code: "CLOUDINARY_NOT_CONFIGURED",
          message: "Cloudinary n’est pas configuré.",
        });
      }
      throw err;
    }

    return {
      draftId: draft.id,
      uploadUrl: signed.url,
      method: signed.method,
      headers: signed.headers,
      fields: signed.fields ?? {},
      expiresAt: signed.expiresAt.toISOString(),
      storageProvider: this.storage.provider,
      resourceType: signed.resourceType,
      publicId: signed.publicId ?? key,
      category,
      customCategoryName,
      originalFilename: dto.originalFilename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      title: titleFromOriginalFilename(dto.originalFilename),
    };
  }

  async completeUpload(
    draftId: string,
    body: {
      publicId: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      category: string;
      customCategoryName?: string;
      documentDate?: string;
      cloudinaryAssetId?: string;
      cloudinaryResourceType?: string;
      cloudinaryDeliveryType?: string;
      format?: string;
    },
    user: AuthUser,
  ) {
    this.assertAdmin(user);
    await this.getOwnedDraft(draftId, user);
    const category = (body.category === "ACTES_PROPRIETE" ? "ACTES" : body.category) as never;
    const customCategoryName = this.resolveCustomCategory(
      String(category),
      body.customCategoryName,
    );
    const doc = await this.prisma.terrainDraftDocument.create({
      data: {
        draftId,
        category,
        customCategoryName,
        title: titleFromOriginalFilename(body.originalFilename),
        originalFilename: body.originalFilename,
        mimeType: body.mimeType,
        sizeBytes: BigInt(body.sizeBytes),
        documentDate: body.documentDate ? new Date(body.documentDate) : null,
        storageProvider: this.storage.provider,
        storageBucket: this.storage.bucket,
        storageKey: body.publicId,
        cloudinaryPublicId: body.publicId,
        cloudinaryAssetId: body.cloudinaryAssetId,
        cloudinaryResourceType: body.cloudinaryResourceType,
        cloudinaryDeliveryType: body.cloudinaryDeliveryType ?? "authenticated",
        format: body.format,
      },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: "terrain_draft.document_upload",
      entityType: "TerrainDraftDocument",
      entityId: doc.id,
      newValues: {
        draftId,
        category: body.category,
        customCategoryName,
        filename: body.originalFilename,
      },
    });
    await this.markAnalysisStale(draftId);
    return this.present(await this.getOwnedDraft(draftId, user));
  }

  async renameCustomCategory(
    draftId: string,
    body: { fromName: string; toName: string },
    user: AuthUser,
  ) {
    this.assertAdmin(user);
    const draft = await this.getOwnedDraft(draftId, user);
    if (draft.status === "CONFIRMED" || draft.status === "CANCELLED") {
      throw new BadRequestException({
        code: "DRAFT_CLOSED",
        message: "Ce brouillon n’accepte plus de modifications.",
      });
    }
    const fromName = assertCustomCategoryName(body.fromName);
    const toName = assertCustomCategoryName(body.toName);
    if (fromName.toLowerCase() === toName.toLowerCase()) {
      return this.present(draft);
    }
    const taken = draft.documents.some(
      (d) =>
        d.category === "AUTRE" &&
        normalizeCustomCategoryName(d.customCategoryName).toLowerCase() ===
          toName.toLowerCase(),
    );
    if (taken) {
      throw new BadRequestException({
        code: "CUSTOM_CATEGORY_DUPLICATE",
        message: `La catégorie « ${toName} » existe déjà sur ce brouillon.`,
      });
    }
    const targets = draft.documents.filter(
      (d) =>
        d.category === "AUTRE" &&
        normalizeCustomCategoryName(d.customCategoryName).toLowerCase() ===
          fromName.toLowerCase(),
    );
    if (!targets.length) {
      throw new NotFoundException({
        code: "CUSTOM_CATEGORY_NOT_FOUND",
        message: `Aucune pièce dans la catégorie « ${fromName} ».`,
      });
    }
    await this.prisma.terrainDraftDocument.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { customCategoryName: toName },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: "terrain_draft.custom_category_rename",
      entityType: "TerrainDraft",
      entityId: draftId,
      oldValues: { fromName },
      newValues: { toName, documentCount: targets.length },
    });
    await this.markAnalysisStale(draftId);
    return this.present(await this.getOwnedDraft(draftId, user));
  }

  private async markAnalysisStale(draftId: string) {
    await this.prisma.terrainDraft.update({
      where: { id: draftId },
      data: { analysisFingerprint: null },
    });
    await this.prisma.aIAnalysisRun.updateMany({
      where: { draftId, status: "COMPLETED" },
      data: { status: "STALE" },
    });
  }

  async removeDocument(draftId: string, documentId: string, user: AuthUser) {
    this.assertAdmin(user);
    await this.getOwnedDraft(draftId, user);
    const doc = await this.prisma.terrainDraftDocument.findFirst({
      where: { id: documentId, draftId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: "DRAFT_DOCUMENT_NOT_FOUND",
        message: "Document de brouillon introuvable.",
      });
    }
    try {
      await this.storage.deleteObject(doc.storageKey);
    } catch {
      // Soft-fail Cloudinary cleanup; DB row still removed
    }
    await this.prisma.terrainDraftDocument.delete({ where: { id: documentId } });
    await this.audit.write({
      actorUserId: user.id,
      action: "terrain_draft.document_remove",
      entityType: "TerrainDraftDocument",
      entityId: documentId,
      oldValues: { draftId, filename: doc.originalFilename },
    });
    await this.markAnalysisStale(draftId);
    return this.present(await this.getOwnedDraft(draftId, user));
  }

  async analyze(draftId: string, user: AuthUser, force = false) {
    this.assertAdmin(user);
    return this.draftAnalysis.startAnalysis(draftId, user, force);
  }

  async getAnalysis(draftId: string, user: AuthUser) {
    this.assertAdmin(user);
    return this.draftAnalysis.getAnalysis(draftId, user);
  }

  async skipAnalysis(draftId: string, user: AuthUser) {
    this.assertAdmin(user);
    await this.getOwnedDraft(draftId, user);
    const updated = await this.prisma.terrainDraft.update({
      where: { id: draftId },
      data: {
        status: "READY_FOR_REVIEW",
        analysisMessage:
          "Analyse automatique indisponible. Vous pouvez compléter les informations manuellement.",
        proposedAnalysisJson: toPrismaJsonObject(emptyProposal()),
      },
      include: { documents: { orderBy: { uploadedAt: "desc" } } },
    });
    return this.present(updated);
  }

  async updateReview(draftId: string, dto: UpdateTerrainDraftReviewDto, user: AuthUser) {
    this.assertAdmin(user);
    await this.getOwnedDraft(draftId, user);
    const updated = await this.prisma.terrainDraft.update({
      where: { id: draftId },
      data: {
        proposedIdentityJson: dto.identity ? toPrismaJsonObject(dto.identity) : undefined,
        proposedProceduralJson: dto.procedural ? toPrismaJsonObject(dto.procedural) : undefined,
        status: "READY_FOR_REVIEW",
      },
      include: { documents: { orderBy: { uploadedAt: "desc" } } },
    });
    return this.present(updated);
  }

  async confirm(draftId: string, dto: ConfirmTerrainDraftDto, user: AuthUser) {
    this.assertAdmin(user);
    const draft = await this.getOwnedDraft(draftId, user);
    if (draft.status === "CONFIRMED") {
      if (draft.resultingRequisitionId) {
        const existingResult = await this.prisma.requisition.findUnique({ where: { id: draft.resultingRequisitionId }, select: { id: true, reference: true } });
        if (existingResult) return existingResult;
      }
      throw new BadRequestException("Terrain déjà créé depuis ce brouillon.");
    }

    const identity = dto.identity;
    const surface = parseSurface(identity.surface);
    const reference = identity.requisitionReference.trim();
    if (!reference) throw new BadRequestException("La référence de réquisition est obligatoire.");

    const existing = await this.prisma.requisition.findUnique({ where: { reference } });
    if (existing) throw new BadRequestException(`La référence ${reference} existe déjà.`);

    const province = identity.location?.split("/")[0]?.trim() || identity.location || "À confirmer";

    const requisition = await this.prisma.$transaction(async (tx) => {
      const created = await tx.requisition.create({
        data: {
          reference,
          propertyName: identity.propertyName || "À confirmer",
          location: identity.location || "À confirmer",
          province,
          ...surface,
          sellerName: identity.seller || "À confirmer",
          buyerName: identity.buyer || "À confirmer",
          riskLevel: "A_CONFIRMER",
          mainStatus: "A_CONFIRMER",
          mainStatusLabel: dto.initialSituationLabel || "Situation à confirmer",
          mainIssue: dto.initialSituationSummary || dto.initialSituationLabel || "Situation à confirmer",
          currentSituation: dto.initialSituationLabel || "Situation à confirmer",
          pointsToClarifyJson: dto.pointsToClarify ?? [],
          courtReached: (dto.courts?.some((c) => c.confirmed && c.caseNumber) || dto.court?.caseNumber)
            ? "Oui"
            : dto.courtMentioned
              ? "À confirmer"
              : "Non",
          dataFreshness: "TO_CONFIRM",
          isPrincipal: true,
          createdById: user.id,
          lastUpdatedById: user.id,
          oppositionCount: dto.oppositionCount ?? null,
        },
      });

      if (identity.linkedRequisition) {
        const linked = await tx.requisition.findUnique({
          where: { reference: identity.linkedRequisition },
        });
        if (linked) {
          await tx.requisitionRelation.create({
            data: {
              sourceRequisitionId: created.id,
              targetRequisitionId: linked.id,
              relationType: "LINKED",
              description: "Réquisition liée (création wizard)",
            },
          });
        }
      }

      const courtsToCreate = [
        ...(dto.courts ?? []).filter((c) => c.confirmed && c.caseNumber),
        ...(dto.court?.caseNumber && dto.court.confirmed ? [dto.court] : []),
      ];
      const seenCases = new Set<string>();
      for (const court of courtsToCreate) {
        const key = (court.caseNumber || "").trim();
        if (!key || seenCases.has(key)) continue;
        seenCases.add(key);
        await tx.legalCase.create({
          data: {
            requisitionId: created.id,
            caseNumber: key,
            courtName: court.courtName || "À confirmer",
            caseType: "Foncier",
            currentPhase: "À confirmer",
            currentStage: "A_CONFIRMER",
            opposingParties: "À confirmer",
            linkedRequisitionId: identity.linkedRequisition
              ? (
                  await tx.requisition.findUnique({
                    where: { reference: identity.linkedRequisition },
                  })
                )?.id
              : undefined,
          },
        });
      }

      // Attach draft files — reuse same Cloudinary publicId (no physical duplicate)
      for (const d of draft.documents) {
        const document = await tx.document.create({
          data: {
            requisitionId: created.id,
            title: d.title,
            category: d.category === "ACTES_PROPRIETE" ? "ACTES" : d.category,
            customCategoryName: d.customCategoryName,
            status: "DISPONIBLE",
            documentDate: d.documentDate,
            createdById: user.id,
            visibility: "PARTAGE",
          },
        });
        const version = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            versionNumber: 1,
            storageProvider: d.storageProvider,
            storageBucket: d.storageBucket,
            storageKey: d.storageKey,
            originalFilename: d.originalFilename,
            mimeType: d.mimeType,
            sizeBytes: d.sizeBytes,
            uploadedById: user.id,
            cloudinaryPublicId: d.cloudinaryPublicId,
            cloudinaryAssetId: d.cloudinaryAssetId,
            cloudinaryResourceType: d.cloudinaryResourceType,
            cloudinaryDeliveryType: d.cloudinaryDeliveryType,
            format: d.format,
          },
        });
        await tx.document.update({
          where: { id: document.id },
          data: { currentVersionId: version.id },
        });
        await tx.terrainEvent.create({
          data: {
            requisitionId: created.id,
            type: "DOCUMENT_RECEIVED",
            occurredAt: d.uploadedAt,
            title: `Document reçu — ${d.title}`,
            shortDescription: d.customCategoryName
              ? `${d.category}: ${d.customCategoryName}`
              : d.category,
            source: "DOCUMENT",
            sourceDocumentId: document.id,
            createdByUserId: user.id,
            validatedByUserId: user.id,
            validationStatus: "CONFIRMED",
          },
        });
      }

      const now = new Date();
      const eventsToCreate = [
        ...(dto.confirmedEvents ?? []),
        ...(dto.initialEvents ?? []),
      ];
      for (const ev of eventsToCreate) {
        const occurredAt = new Date(ev.occurredAt);
        const isFuture = occurredAt.getTime() > now.getTime();
        const isScheduled = Boolean(ev.isScheduled) || isFuture;
        await tx.terrainEvent.create({
          data: {
            requisitionId: created.id,
            type: ev.type as never,
            occurredAt,
            title: ev.title,
            shortDescription: ev.shortDescription,
            source: "MANUAL",
            createdByUserId: user.id,
            validatedByUserId: user.id,
            validationStatus: "CONFIRMED",
            isScheduled,
            scheduledAt: isScheduled
              ? new Date(ev.scheduledAt ?? ev.occurredAt)
              : null,
          },
        });
      }

      if (dto.reviewAudit) {
        await tx.aIExtraction.create({
          data: {
            draftId,
            requisitionId: created.id,
            extractionType: "TERRAIN_WIZARD_REVIEW",
            payloadJson: toPrismaJsonObject(dto.reviewAudit),
            confidence: "MOYENNE",
            status: "CONFIRMED",
            createdById: user.id,
            reviewedById: user.id,
            reviewedAt: new Date(),
          },
        });
      }

      await tx.terrainDraft.update({
        where: { id: draftId },
        data: {
          status: "CONFIRMED",
          resultingRequisitionId: created.id,
          proposedIdentityJson: toPrismaJsonObject(identity),
        },
      });

      await this.snapshots.refreshFromEvents(created.id, tx);

      return created;
    }, { timeout: 30_000 });

    await this.audit.write({
      actorUserId: user.id,
      action: "terrain.create_from_draft",
      entityType: "Requisition",
      entityId: requisition.id,
      newValues: { draftId, reference: requisition.reference },
    });

    return { id: requisition.id, reference: requisition.reference };
  }

  async cancel(draftId: string, user: AuthUser) {
    this.assertAdmin(user);
    const draft = await this.getOwnedDraft(draftId, user);
    for (const d of draft.documents) {
      try {
        await this.storage.deleteObject(d.storageKey);
      } catch {
        /* best-effort cleanup */
      }
    }
    if (draft.documents.length) {
      await this.prisma.terrainDraftDocument.deleteMany({ where: { draftId } });
    }
    await this.prisma.terrainDraft.update({
      where: { id: draftId },
      data: { status: "CANCELLED" },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: "terrain_draft.cancel",
      entityType: "TerrainDraft",
      entityId: draftId,
    });
    return { ok: true };
  }
}
