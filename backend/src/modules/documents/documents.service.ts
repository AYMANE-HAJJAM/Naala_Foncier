import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import {
  categoryFolderSegment,
  safeRequisitionFolder,
} from "../../shared/storage/cloudinary-storage.service.js";
import { StorageService } from "../../shared/storage/storage.service.js";
import { presentDocument } from "../shared/presenters.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import type {
  CompleteUploadSessionDto,
  CreateLegacyDocumentRequestDto,
  CreateUploadSessionDto,
  RequestClearerCopyDto,
  UpdateDocumentDto,
} from "./dto/document.dto.js";
import { TerrainUpdateAnalysisService } from "../ai-analysis/terrain-update-analysis.service.js";

/** Derive a readable document title from the original filename. */
export function titleFromOriginalFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || filename;
}

const allowedMime = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StorageService)
    private readonly storage: StorageService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(AccessScopeService)
    private readonly access: AccessScopeService,
    @Optional()
    @Inject(forwardRef(() => TerrainUpdateAnalysisService))
    private readonly terrainUpdateAnalysis?: TerrainUpdateAnalysisService,
  ) {}
  private include = {
    currentVersion: true,
    createdBy: true,
    requisition: true,
  } as const;
  private async record(id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!doc) throw new NotFoundException("Document introuvable.");
    return doc;
  }
  private async assertDocumentAccess(user: AuthUser, documentId: string) {
    const doc = await this.record(documentId);
    await this.access.assertCanAccessRequisition(user, doc.requisitionId);
    if (
      !this.access.isAdmin(user) &&
      (doc).visibility === "INTERNE"
    ) {
      throw new ForbiddenException({
        code: "DOCUMENT_ACCESS_DENIED",
        message: "Ce document est réservé à l’administration.",
      });
    }
    return doc;
  }
  async list(user: AuthUser, requisitionId?: string, category?: string) {
    if (requisitionId) {
      await this.access.assertCanAccessRequisition(user, requisitionId);
    }
    const idFilter = requisitionId ? undefined : await this.access.requisitionIdFilter(user);
    const visibilityFilter = this.access.isAdmin(user)
      ? {}
      : { visibility: "PARTAGE" as const };
    const rows = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...visibilityFilter,
        ...(requisitionId ? { requisitionId } : idFilter ? { requisitionId: idFilter } : {}),
        ...(category ? { category: category as never } : {}),
      },
      include: this.include,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(presentDocument);
  }
  async get(id: string, user: AuthUser) {
    return presentDocument(await this.assertDocumentAccess(user, id));
  }
  async createLegacyRequest(requisitionId: string, dto: CreateLegacyDocumentRequestDto, user: AuthUser) {
    await this.access.assertCanAccessRequisition(user, requisitionId);
    const requisition = await this.prisma.requisition.findFirst({ where: { id: requisitionId, deletedAt: null } });
    if (!requisition) throw new NotFoundException("Réquisition introuvable.");
    const normalized = dto.category.toLowerCase();
    const category = normalized.includes("tribunal") ? "TRIBUNAL" : normalized.includes("opposition") ? "OPPOSITIONS" : normalized.includes("topograph") ? "TOPOGRAPHIE" : normalized.includes("terrain") ? "TERRAIN" : normalized.includes("rapport") ? "RAPPORTS" : normalized.includes("acte") ? "ACTES_PROPRIETE" : normalized.includes("ancfcc") ? "ANCFCC" : "AUTRE";
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.documentRequest.create({ data: { requisitionId, requestedDocumentTitle: dto.title, category, priority: "NORMALE", status: "A_DEMANDER", notes: "Demande créée depuis l'interface historique; aucun binaire n'a été enregistré." } });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: "DOCUMENT_REQUEST_CREATED", entityType: "Requisition", entityId: requisitionId, newValues: { requestId: request.id, title: dto.title } } });
      return request;
    });
  }
  async update(id: string, dto: UpdateDocumentDto, actorId: string) {
    await this.record(id);
    const doc = await this.prisma.$transaction(async (tx) => {
      const value = await tx.document.update({
        where: { id },
        data: dto,
        include: this.include,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "DOCUMENT_UPDATED",
          entityType: "Document",
          entityId: id,
          newValues: { ...dto },
        },
      });
      return value;
    });
    return presentDocument(doc);
  }
  async remove(id: string, actorId: string) {
    await this.record(id);
    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "DOCUMENT_DELETED",
          entityType: "Document",
          entityId: id,
        },
      }),
    ]);
  }
  async createUploadSession(dto: CreateUploadSessionDto, user: AuthUser) {
    if (!allowedMime.has(dto.mimeType))
      throw new BadRequestException({
        code: "UNSUPPORTED_FILE_TYPE",
        message: "Ce type de fichier n’est pas autorisé.",
      });
    if (
      dto.sizeBytes > this.config.get<number>("MAX_UPLOAD_SIZE_BYTES", 26214400)
    )
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "Le fichier dépasse la taille maximale autorisée.",
      });
    await this.access.assertCanAccessRequisition(user, dto.requisitionId);
    if (dto.category === "RAPPORTS" && !this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "REPORT_UPLOAD_FORBIDDEN",
        message: "Seuls les administrateurs peuvent déposer des rapports officiels.",
      });
    }
    if (dto.visibility === "INTERNE" && !this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "VISIBILITY_FORBIDDEN",
        message: "Seuls les administrateurs peuvent marquer un document interne.",
      });
    }
    const requisition = await this.prisma.requisition.findFirst({
      where: { id: dto.requisitionId, deletedAt: null },
    });
    if (!requisition) throw new NotFoundException("Réquisition introuvable.");
    if (dto.documentId) await this.assertDocumentAccess(user, dto.documentId);
    const folderRoot = this.config.get<string>(
      "CLOUDINARY_UPLOAD_FOLDER",
      "naala-foncier",
    );
    const safeRef = safeRequisitionFolder(requisition.reference);
    const categoryFolder = categoryFolderSegment(dto.category);
    const customName =
      dto.category === "AUTRE"
        ? (dto.customCategoryName ?? "").trim().replace(/\s+/g, " ")
        : null;
    if (dto.category === "AUTRE" && !customName) {
      throw new BadRequestException({
        code: "CUSTOM_CATEGORY_REQUIRED",
        message: "Le nom de la catégorie personnalisée est obligatoire.",
      });
    }
    if (customName && customName.length > 80) {
      throw new BadRequestException({
        code: "CUSTOM_CATEGORY_TOO_LONG",
        message: "Le nom de catégorie ne peut pas dépasser 80 caractères.",
      });
    }
    const customSeg = customName
      ? `/${customName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40) || "custom"}`
      : "";
    const key = `${folderRoot}/requisitions/${safeRef}/${categoryFolder}${customSeg}/${randomUUID()}`;
    const signed = await this.storage.createPresignedUploadUrl(
      key,
      dto.mimeType,
      dto.sizeBytes,
    );
    const session = await this.prisma.uploadSession.create({
      data: {
        requisitionId: dto.requisitionId,
        documentId: dto.documentId,
        requestedById: user.id,
        title: titleFromOriginalFilename(dto.originalFilename) || dto.title,
        category: dto.category,
        customCategoryName: customName,
        originalFilename: dto.originalFilename,
        mimeType: dto.mimeType,
        sizeBytes: BigInt(dto.sizeBytes),
        storageProvider: this.storage.provider,
        storageBucket: this.storage.bucket,
        storageKey: signed.publicId ?? key,
        expiresAt: signed.expiresAt,
      },
    });
    return {
      id: session.id,
      uploadUrl: signed.url,
      method: signed.method,
      headers: signed.headers,
      fields: signed.fields ?? {},
      expiresAt: signed.expiresAt.toISOString(),
      storageProvider: this.storage.provider,
      resourceType: signed.resourceType,
      publicId: signed.publicId ?? key,
    };
  }
  async completeUploadSession(
    id: string,
    dto: CompleteUploadSessionDto,
    user: AuthUser,
  ) {
    const session = await this.prisma.uploadSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException("Session d’upload introuvable.");
    if (
      session.requestedById !== user.id &&
      !user.permissions.includes("document.validate")
    )
      throw new BadRequestException(
        "Cette session appartient à un autre utilisateur.",
      );
    if (session.status !== "CREATED")
      throw new ConflictException({
        code: "UPLOAD_SESSION_ALREADY_USED",
        message: "Cette session d’upload a déjà été finalisée.",
      });
    if (session.expiresAt < new Date()) {
      await this.prisma.uploadSession.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException({
        code: "UPLOAD_URL_EXPIRED",
        message: "L’URL d’upload a expiré.",
      });
    }
    if (!(await this.storage.verifyObjectExists(session.storageKey)))
      throw new BadRequestException({
        code: "STORAGE_OBJECT_NOT_FOUND",
        message: "Le fichier téléversé est introuvable dans le stockage privé.",
      });
    const head = await this.storage.headObject(session.storageKey);
    const expected = Number(session.sizeBytes);
    if (
      expected > 0 &&
      head.sizeBytes > 0 &&
      Math.abs(head.sizeBytes - expected) / expected > 0.05
    )
      throw new BadRequestException({
        code: "STORAGE_SIZE_MISMATCH",
        message:
          "La taille du fichier téléversé ne correspond pas à la session.",
      });
    const result = await this.prisma.$transaction(async (tx) => {
      let documentId = session.documentId;
      let createdNewDocument = false;
      if (!documentId) {
        const doc = await tx.document.create({
          data: {
            requisitionId: session.requisitionId,
            title: session.title,
            category: session.category,
            customCategoryName: session.customCategoryName,
            status: "DISPONIBLE",
            visibility: "PARTAGE",
            createdById: user.id,
          },
        });
        documentId = doc.id;
        createdNewDocument = true;
      }
      const latest = await tx.documentVersion.aggregate({
        where: { documentId },
        _max: { versionNumber: true },
      });
      const version = await tx.documentVersion.create({
        data: {
          documentId,
          versionNumber: (latest._max.versionNumber ?? 0) + 1,
          storageProvider: session.storageProvider,
          storageBucket: session.storageBucket,
          storageKey: session.storageKey,
          originalFilename: session.originalFilename,
          mimeType: session.mimeType,
          sizeBytes: BigInt(head.sizeBytes || Number(session.sizeBytes)),
          sha256Checksum: dto.sha256Checksum,
          pageCount: dto.pageCount,
          sourceQuality: dto.sourceQuality ?? "MOYENNE",
          uploadedById: user.id,
          notes: dto.notes,
          cloudinaryPublicId: session.storageKey,
          cloudinaryAssetId: head.assetId,
          cloudinaryVersion: head.version,
          cloudinaryResourceType: head.resourceType ?? "raw",
          cloudinaryDeliveryType: "authenticated",
          format: head.format,
          width: head.width,
          height: head.height,
        },
      });
      const document = await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: version.id, status: "DISPONIBLE" },
        include: this.include,
      });
      await tx.uploadSession.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date(), documentId },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "DOCUMENT_UPLOADED",
          entityType: "Document",
          entityId: documentId,
          newValues: { versionId: version.id, storageKey: session.storageKey },
          metadata: { requisitionId: session.requisitionId },
        },
      });
      if (createdNewDocument && ["TRIBUNAL", "OPPOSITIONS", "ANCFCC", "RAPPORTS"].includes(session.category)) {
        const admins = await tx.user.findMany({ where: { deletedAt: null, isActive: true, roles: { some: { role: { key: "ADMIN" } } } }, select: { id: true } });
        await tx.notification.createMany({ data: admins.map(({ id: userId }) => ({ userId, type: "IMPORTANT_DOCUMENT_ADDED", title: "Nouveau document important", message: session.title, requisitionId: session.requisitionId, relatedEntityType: "Document", relatedEntityId: documentId, dedupeKey: `IMPORTANT_DOCUMENT_ADDED:${userId}:${documentId}` })), skipDuplicates: true });
      }
      return { document: presentDocument(document), versionId: version.id, documentId };
    });

    void this.terrainUpdateAnalysis?.triggerAfterUpload(
      session.requisitionId,
      result.documentId,
      result.versionId,
      user.id,
    );

    return result.document;
  }
  async versions(id: string, user: AuthUser) {
    await this.assertDocumentAccess(user, id);
    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        sha256Checksum: true,
        pageCount: true,
        sourceQuality: true,
        uploadedAt: true,
        notes: true,
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
  async signedUrl(id: string, disposition: "inline" | "attachment", user: AuthUser) {
    const doc = await this.assertDocumentAccess(user, id);
    if (!doc.currentVersion)
      throw new NotFoundException("Aucune version disponible.");
    const version = doc.currentVersion;
    if (version.storageProvider !== "CLOUDINARY") {
      throw new GoneException({
        code: "LEGACY_STORAGE_UNAVAILABLE",
        message:
          "Ce document est stocké sur un ancien fournisseur. Re-téléversement Cloudinary requis.",
      });
    }
    return {
      url: await this.storage.createPresignedDownloadUrl(
        version.cloudinaryPublicId ?? version.storageKey,
        disposition,
        {
          resourceType: version.cloudinaryResourceType ?? undefined,
          format: version.format ?? undefined,
        },
      ),
      expiresIn: this.config.get<number>("SIGNED_URL_EXPIRATION_SECONDS", 900),
      previewAvailable: (() => {
        const fmt = (
          version.format ??
          extname(version.originalFilename).replace(".", "")
        ).toLowerCase();
        const mime = (version.mimeType ?? "").toLowerCase();
        const name = version.originalFilename.toLowerCase();
        // Legacy .doc cannot be rendered in-app
        if (fmt === "doc" || (mime === "application/msword" && !name.endsWith(".docx"))) {
          return false;
        }
        return true;
      })(),
    };
  }

  /** Stream file bytes through the API for in-app viewers (DOCX, etc.). */
  async getContent(id: string, user: AuthUser) {
    const doc = await this.assertDocumentAccess(user, id);
    if (!doc.currentVersion) {
      throw new NotFoundException("Aucune version disponible.");
    }
    const version = doc.currentVersion;
    if (version.storageProvider !== "CLOUDINARY") {
      throw new GoneException({
        code: "LEGACY_STORAGE_UNAVAILABLE",
        message:
          "Ce document est stocké sur un ancien fournisseur. Re-téléversement Cloudinary requis.",
      });
    }
    const buffer = await this.storage.fetchObjectBytes(
      version.cloudinaryPublicId ?? version.storageKey,
      {
        resourceType: version.cloudinaryResourceType ?? undefined,
        format: version.format ?? undefined,
      },
    );
    return {
      buffer,
      mimeType: version.mimeType,
      originalFilename: version.originalFilename,
      sizeBytes: Number(version.sizeBytes),
    };
  }

  async validate(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id },
        data: {
          status: "VALIDE",
          validatedById: user.id,
          validatedAt: new Date(),
        },
        include: this.include,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "DOCUMENT_VALIDATED",
          entityType: "Document",
          entityId: id,
        },
      });
      return presentDocument(doc);
    });
  }
  async requestClearerCopy(
    id: string,
    dto: RequestClearerCopyDto,
    user: AuthUser,
  ) {
    const document = await this.record(id);
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.documentRequest.create({
        data: {
          requisitionId: document.requisitionId,
          documentId: id,
          requestedDocumentTitle: `Copie plus lisible — ${document.title}`,
          category: document.category,
          priority: "HAUTE",
          status: "DEMANDE",
          requestedFrom: dto.requestedFrom,
          assignedToId: dto.assignedToId,
          notes: dto.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "CLEARER_COPY_REQUESTED",
          entityType: "DocumentRequest",
          entityId: request.id,
        },
      });
      return request;
    });
  }
}
