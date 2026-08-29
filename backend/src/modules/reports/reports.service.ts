import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { StorageService } from "../../shared/storage/storage.service.js";
import type {
  CreateReportDto,
  CreateReportVersionDto,
  UpdateReportDto,
} from "./reports.controller.js";

const labels: Record<string, string> = {
  BROUILLON: "Brouillon",
  A_VALIDER: "En validation",
  VALIDE: "Validé",
  PUBLIE: "Publié",
  REJETE: "Rejeté",
  ARCHIVE: "Archivé",
};

function formatFromFile(fileName?: string | null, mimeType?: string | null): string {
  const fromName = fileName?.split(".").pop()?.trim();
  if (fromName && fromName.length <= 5 && fromName !== fileName) {
    return fromName.toUpperCase();
  }
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPG";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("webp")) return "WEBP";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return "DOCX";
  return mime.split("/").pop()?.toUpperCase() || "—";
}

function isLegacyDocFormat(fileName?: string | null, mimeType?: string | null): boolean {
  const name = (fileName ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return false;
  return mime === "application/msword" || name.endsWith(".doc");
}

function isPdfFormat(fileName?: string | null, mimeType?: string | null): boolean {
  const name = (fileName ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  return mime.includes("pdf") || name.endsWith(".pdf");
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly p: PrismaService,
    private readonly access: AccessScopeService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private documentInclude = {
    currentVersion: {
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
    },
  } as const;

  private include = {
    currentVersion: true,
    createdBy: true,
    validatedBy: true,
    publishedBy: true,
    requisition: true,
    document: { include: this.documentInclude },
    previewDocument: { include: this.documentInclude },
  } as const;

  private present(r: Awaited<ReturnType<ReportsService["record"]>>) {
    const source = r.document?.deletedAt ? null : r.document;
    const preview = r.previewDocument?.deletedAt ? null : r.previewDocument;
    const sourceVersion = source?.currentVersion ?? null;
    const previewVersion = preview?.currentVersion ?? null;
    const openVersion =
      previewVersion && isPdfFormat(previewVersion.originalFilename, previewVersion.mimeType)
        ? previewVersion
        : sourceVersion;
    const openDoc = openVersion === previewVersion ? preview : source;

    const originalFilename = sourceVersion?.originalFilename ?? null;
    const mimeType = openVersion?.mimeType ?? sourceVersion?.mimeType ?? null;
    const fileSize = sourceVersion ? Number(sourceVersion.sizeBytes) : null;
    const format = formatFromFile(
      openVersion?.originalFilename ?? originalFilename,
      mimeType,
    );
    const uploadedByName = sourceVersion?.uploadedBy
      ? `${sourceVersion.uploadedBy.firstName} ${sourceVersion.uploadedBy.lastName}`
      : `${r.createdBy.firstName} ${r.createdBy.lastName}`;
    const generatedByRaw =
      r.currentVersion?.generatedBy ?? uploadedByName;
    const uploadedBy =
      generatedByRaw === "Seed de développement" ? uploadedByName : generatedByRaw;

    const canDownload = Boolean(sourceVersion && sourceVersion.storageProvider === "CLOUDINARY");
    const canPreview = Boolean(
      openVersion &&
        openVersion.storageProvider === "CLOUDINARY" &&
        !isLegacyDocFormat(openVersion.originalFilename, openVersion.mimeType),
    );

    return {
      id: r.id,
      reportId: r.id,
      requisitionId: r.requisitionId ?? "",
      scope: r.scope,
      reportType: r.reportType,
      title: r.title,
      version: r.currentVersion
        ? `v${r.currentVersion.versionNumber}.0`
        : sourceVersion
          ? "v1.0"
          : "—",
      status: labels[r.status] ?? r.status,
      statusCode: r.status,
      reportDate: (r.reportDate ?? r.currentVersion?.generatedAt ?? r.createdAt)
        .toISOString()
        .slice(0, 10),
      generatedBy: uploadedBy,
      generatedAt: (r.currentVersion?.generatedAt ?? r.createdAt)
        .toISOString()
        .slice(0, 10),
      uploadedBy,
      uploadedAt: (sourceVersion?.uploadedAt ?? r.createdAt).toISOString().slice(0, 10),
      sources: r.currentVersion?.sourceCount ?? 0,
      validator: r.validatedBy
        ? `${r.validatedBy.firstName} ${r.validatedBy.lastName}`
        : "Non renseigné",
      publishedAt: r.publishedAt?.toISOString() ?? null,
      documentId: source?.id ?? null,
      sourceDocumentId: source?.id ?? null,
      previewDocumentId: preview?.id ?? null,
      originalFilename,
      mimeType,
      fileType: mimeType,
      fileSize,
      fileName: originalFilename ?? undefined,
      format,
      canPreview,
      canDownload,
      hasFile: canDownload,
      openDocumentId: openDoc?.id ?? null,
    };
  }

  async record(id: string) {
    const r = await this.p.report.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!r) throw new NotFoundException("Rapport introuvable.");
    return r;
  }

  /** PORTFOLIO reports are visible to any USER with at least one assignment. */
  async assertCanAccessReport(
    user: AuthUser,
    report: { scope: string; requisitionId: string | null; status?: string },
  ): Promise<void> {
    if (this.access.isAdmin(user)) return;
    if (report.status !== "PUBLIE") {
      throw new ForbiddenException({
        code: "REPORT_NOT_PUBLISHED",
        message: "Ce rapport n'est pas publié.",
      });
    }
    if (report.scope === "PORTFOLIO" || !report.requisitionId) {
      const ids = await this.access.assignedRequisitionIds(user.id);
      if (ids.length === 0) {
        throw new ForbiddenException({
          code: "REPORT_ACCESS_DENIED",
          message: "Accès non autorisé à ce rapport.",
        });
      }
      return;
    }
    await this.access.assertCanAccessRequisition(user, report.requisitionId);
  }

  async list(user: AuthUser, req?: string) {
    if (req) await this.access.assertCanAccessRequisition(user, req);
    const idFilter = req ? undefined : await this.access.requisitionIdFilter(user);

    const publicationFilter = this.access.isAdmin(user) ? {} : { status: "PUBLIE" as const };
    const where = req
      ? {
          deletedAt: null,
          ...publicationFilter,
          OR: [
            { requisitionId: req },
            { scope: "PORTFOLIO" as const, requisitionId: null },
          ],
        }
      : {
          deletedAt: null,
          ...publicationFilter,
          ...(idFilter
            ? {
                OR: [
                  { requisitionId: idFilter },
                  { scope: "PORTFOLIO" as const, requisitionId: null },
                ],
              }
            : {}),
        };

    // USER without assignments: no portfolio either
    if (!this.access.isAdmin(user) && !req) {
      const assigned = await this.access.assignedRequisitionIds(user.id);
      if (assigned.length === 0) {
        return [];
      }
    }

    return (
      await this.p.report.findMany({
        where,
        include: this.include,
        orderBy: { updatedAt: "desc" },
      })
    ).map((r) => this.present(r));
  }

  async get(id: string, user: AuthUser) {
    const r = await this.record(id);
    await this.assertCanAccessReport(user, r);
    return this.present(r);
  }

  async create(d: CreateReportDto, user: AuthUser) {
    await this.access.assertCanAccessOptionalRequisition(user, d.requisitionId);
    return this.p.$transaction(async (tx) => {
      const r = await tx.report.create({ data: { ...d, createdById: user.id }, include: this.include });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: "REPORT_CREATED", entityType: "Report", entityId: r.id, metadata: r.requisitionId ? { requisitionId: r.requisitionId } : undefined } });
      return this.present(r);
    });
  }

  async update(id: string, d: UpdateReportDto, user: AuthUser) {
    const previous = await this.record(id);
    await this.assertCanAccessReport(user, previous);
    if (previous.status !== "BROUILLON" && previous.status !== "REJETE") {
      throw new BadRequestException("Seul un rapport brouillon ou rejeté peut être modifié.");
    }
    if (d.requisitionId !== undefined) {
      await this.access.assertCanAccessOptionalRequisition(user, d.requisitionId);
    }
    return this.p.$transaction(async (tx) => {
      const updated = await tx.report.update({ where: { id }, data: d, include: this.include });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: "REPORT_UPDATED", entityType: "Report", entityId: id, metadata: updated.requisitionId ? { requisitionId: updated.requisitionId } : undefined } });
      return this.present(updated);
    });
  }

  async version(id: string, d: CreateReportVersionDto, user: AuthUser) {
    const report = await this.record(id);
    await this.assertCanAccessReport(user, report);
    if (report.status !== "BROUILLON" && report.status !== "REJETE") {
      throw new BadRequestException("Une version ne peut être ajoutée qu'à un brouillon ou un rapport rejeté.");
    }
    return this.p.$transaction(async (tx) => {
      const latest = await tx.reportVersion.aggregate({
        where: { reportId: id },
        _max: { versionNumber: true },
      });
      const v = await tx.reportVersion.create({
        data: {
          reportId: id,
          versionNumber: (latest._max.versionNumber ?? 0) + 1,
          contentJson: d.contentJson,
          generatedBy: d.generatedBy,
          sourceCount: d.sourceCount,
          notes: d.notes,
        },
      });
      await tx.report.update({
        where: { id },
        data: { currentVersionId: v.id, status: "BROUILLON" },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "REPORT_VERSION_CREATED",
          entityType: "Report",
          entityId: id,
          newValues: { versionNumber: v.versionNumber },
          metadata: report.requisitionId ? { requisitionId: report.requisitionId } : undefined,
        },
      });
      return v;
    });
  }

  async submit(id: string, user: AuthUser) {
    const report = await this.record(id);
    await this.assertCanAccessReport(user, report);
    if (report.status !== "BROUILLON" && report.status !== "REJETE") {
      throw new BadRequestException("Le rapport n'est pas soumissible en validation.");
    }
    if (!report.currentVersionId && !report.documentId) {
      throw new BadRequestException("Ajoutez une version ou un document avant validation.");
    }
    return this.p.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: { status: "A_VALIDER" },
        include: this.include,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "REPORT_SUBMITTED",
          entityType: "Report",
          entityId: id,
          metadata: report.requisitionId ? { requisitionId: report.requisitionId } : undefined,
        },
      });
      return this.present(updated);
    });
  }

  async decision(id: string, status: "VALIDE" | "REJETE", user: AuthUser) {
    const r = await this.record(id);
    await this.assertCanAccessReport(user, r);
    if (r.status !== "A_VALIDER") {
      throw new BadRequestException("Le rapport doit être en validation.");
    }
    return this.p.$transaction(async (tx) => {
      const v = await tx.report.update({
        where: { id },
        data: { status, validatedById: user.id, validatedAt: new Date() },
        include: this.include,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: status === "VALIDE" ? "REPORT_VALIDATED" : "REPORT_REJECTED",
          entityType: "Report",
          entityId: id,
          metadata: r.requisitionId ? { requisitionId: r.requisitionId } : undefined,
        },
      });
      return this.present(v);
    });
  }

  async publish(id: string, user: AuthUser) {
    const report = await this.record(id);
    await this.assertCanAccessReport(user, report);
    if (report.status === "PUBLIE") return this.present(report);
    if (report.status !== "VALIDE") {
      throw new BadRequestException("Le rapport doit être validé avant publication.");
    }

    return this.p.$transaction(async (tx) => {
      const changed = await tx.report.updateMany({ where: { id, status: "VALIDE" }, data: { status: "PUBLIE", publishedAt: new Date(), publishedById: user.id } });
      const updated = await tx.report.findUniqueOrThrow({ where: { id }, include: this.include });
      if (changed.count === 0) return this.present(updated);
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "REPORT_PUBLISHED",
          entityType: "Report",
          entityId: id,
          metadata: report.requisitionId ? { requisitionId: report.requisitionId } : undefined,
        },
      });
      if (report.requisitionId) {
        const recipients = await tx.userRequisitionAccess.findMany({
          where: { requisitionId: report.requisitionId },
          select: { userId: true },
        });
        await tx.notification.createMany({
          data: recipients.map(({ userId }) => ({
            userId,
            type: "REPORT_PUBLISHED",
            title: "Nouveau rapport publié",
            message: report.title,
            requisitionId: report.requisitionId,
            relatedEntityType: "Report",
            relatedEntityId: report.id,
            dedupeKey: `REPORT_PUBLISHED:${userId}:${report.id}`,
          })),
          skipDuplicates: true,
        });
      }
      return this.present(updated);
    });
  }

  /**
   * Preview prefers optional PDF previewDocument; otherwise uses source document.
   * Download always uses the original source document.
   */
  async signedUrl(
    id: string,
    disposition: "inline" | "attachment",
    user: AuthUser,
  ) {
    const r = await this.record(id);
    await this.assertCanAccessReport(user, r);

    const source = r.document?.deletedAt ? null : r.document;
    const preview = r.previewDocument?.deletedAt ? null : r.previewDocument;
    const usePreview =
      disposition === "inline" &&
      preview?.currentVersion &&
      isPdfFormat(
        preview.currentVersion.originalFilename,
        preview.currentVersion.mimeType,
      );

    const doc = usePreview ? preview : source;
    const version = doc?.currentVersion;
    if (!doc || !version) {
      throw new NotFoundException("Aucun fichier lié à ce rapport.");
    }
    if (version.storageProvider !== "CLOUDINARY") {
      throw new GoneException({
        code: "LEGACY_STORAGE_UNAVAILABLE",
        message:
          "Ce rapport est stocké sur un ancien fournisseur. Re-téléversement Cloudinary requis.",
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
      documentId: doc.id,
      originalFilename: version.originalFilename,
      mimeType: version.mimeType,
      fileSize: Number(version.sizeBytes),
      previewAvailable: !isLegacyDocFormat(version.originalFilename, version.mimeType),
      isPreviewDocument: Boolean(usePreview),
    };
  }

  /** Stream original report file bytes through the API (avoids Cloudinary CORS). */
  async getContent(id: string, user: AuthUser) {
    const r = await this.record(id);
    await this.assertCanAccessReport(user, r);
    const source = r.document?.deletedAt ? null : r.document;
    const version = source?.currentVersion;
    if (!source || !version) {
      throw new NotFoundException("Aucun fichier lié à ce rapport.");
    }
    if (version.storageProvider !== "CLOUDINARY") {
      throw new GoneException({
        code: "LEGACY_STORAGE_UNAVAILABLE",
        message:
          "Ce rapport est stocké sur un ancien fournisseur. Re-téléversement Cloudinary requis.",
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
}
