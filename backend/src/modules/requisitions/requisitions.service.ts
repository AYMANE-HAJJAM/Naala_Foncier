import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { CreateRequisitionDto, RequisitionQueryDto, UpdateRequisitionDto } from "./dto/requisition.dto.js";
import { presentRequisition } from "./requisitions.presenter.js";

@Injectable()
export class RequisitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessScopeService,
  ) {}

  private include = {
    responsibleUser: true,
    documents: true,
    documentRequests: true,
    legalCases: true,
    statusSnapshot: true,
    outgoingRelations: { include: { target: true } },
  } as const;

  async list(query: RequisitionQueryDto = {}, user: AuthUser) {
    const idFilter = await this.access.requisitionIdFilter(user);
    const rows = await this.prisma.requisition.findMany({
      where: {
        deletedAt: null,
        ...(idFilter ? { id: idFilter } : {}),
        ...(query.risk ? { riskLevel: query.risk } : {}),
        ...(query.status ? { mainStatus: query.status } : {}),
        ...(query.location ? { location: { contains: query.location, mode: "insensitive" as const } } : {}),
        ...(query.buyer ? { buyerName: { contains: query.buyer, mode: "insensitive" as const } } : {}),
        ...(query.search
          ? {
              OR: [
                { reference: { contains: query.search, mode: "insensitive" as const } },
                { propertyName: { contains: query.search, mode: "insensitive" as const } },
                { buyerName: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: this.include,
      orderBy: [{ priorityRank: "asc" }, { reference: "asc" }],
    });
    return rows.map(presentRequisition);
  }

  async record(id: string) {
    const row = await this.prisma.requisition.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!row) throw new NotFoundException("Réquisition introuvable.");
    return row;
  }

  async get(id: string, user: AuthUser) {
    await this.access.assertCanAccessRequisition(user, id);
    return presentRequisition(await this.record(id));
  }

  async create(dto: CreateRequisitionDto, actorId: string) {
    if (await this.prisma.requisition.findUnique({ where: { reference: dto.reference } })) {
      throw new ConflictException({
        code: "REQUISITION_REFERENCE_EXISTS",
        message: "Cette référence de réquisition existe déjà.",
      });
    }
    const row = await this.prisma.requisition.create({
      data: {
        ...dto,
        importantDate: dto.importantDate ? new Date(dto.importantDate) : undefined,
        criticalDetails: dto.criticalDetails ?? [],
        createdById: actorId,
        lastUpdatedById: actorId,
      },
      include: this.include,
    });
    await this.audit.write({
      actorUserId: actorId,
      action: "REQUISITION_CREATED",
      entityType: "Requisition",
      entityId: row.id,
      newValues: { reference: row.reference },
    });
    return presentRequisition(row);
  }

  async update(id: string, dto: UpdateRequisitionDto, actorId: string) {
    const previous = await this.record(id);
    const {
      constraints,
      pointsToClarify,
      resolutionSteps,
      latestKnownEventAt,
      latestJudicialEventAt,
      nextScheduledEventAt,
      importantDate,
      criticalDetails,
      ...rest
    } = dto;
    const clarify = pointsToClarify ?? constraints;
    const row = await this.prisma.requisition.update({
      where: { id },
      data: {
        ...rest,
        importantDate: importantDate ? new Date(importantDate) : undefined,
        latestKnownEventAt: latestKnownEventAt
          ? new Date(latestKnownEventAt)
          : undefined,
        latestJudicialEventAt: latestJudicialEventAt
          ? new Date(latestJudicialEventAt)
          : undefined,
        nextScheduledEventAt: nextScheduledEventAt
          ? new Date(nextScheduledEventAt)
          : undefined,
        criticalDetails: clarify ?? criticalDetails,
        constraintsJson: clarify,
        pointsToClarifyJson: clarify,
        resolutionStepsJson: resolutionSteps,
        lastUpdatedById: actorId,
        lastManuallyUpdatedAt: new Date(),
      },
      include: this.include,
    });
    await this.audit.write({
      actorUserId: actorId,
      action: "REQUISITION_UPDATED",
      entityType: "Requisition",
      entityId: id,
      oldValues: { riskLevel: previous.riskLevel, mainStatus: previous.mainStatus },
      newValues: { riskLevel: row.riskLevel, mainStatus: row.mainStatus },
    });
    return presentRequisition(row);
  }

  async remove(id: string, actorId: string) {
    await this.record(id);
    await this.prisma.requisition.update({
      where: { id },
      data: { deletedAt: new Date(), lastUpdatedById: actorId },
    });
    await this.audit.write({
      actorUserId: actorId,
      action: "REQUISITION_DELETED",
      entityType: "Requisition",
      entityId: id,
    });
  }

  async listAccess(requisitionId: string) {
    await this.record(requisitionId);
    return this.prisma.userRequisitionAccess.findMany({
      where: { requisitionId },
      include: { user: true, createdBy: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async grantAccess(requisitionId: string, userId: string, actorId: string) {
    const requisition = await this.record(requisitionId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException("Utilisateur introuvable.");
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userRequisitionAccess.findUnique({
        where: { userId_requisitionId: { userId, requisitionId } },
        include: { user: true, createdBy: true, requisition: true },
      });
      if (existing) return existing;
      const access = await tx.userRequisitionAccess.create({
        data: { userId, requisitionId, createdById: actorId },
        include: { user: true, createdBy: true, requisition: true },
      });
      await tx.auditLog.create({ data: { actorUserId: actorId, action: "REQUISITION_ACCESS_GRANTED", entityType: "UserRequisitionAccess", entityId: access.id, newValues: { userId, requisitionId }, metadata: { requisitionId } } });
      await tx.notification.create({ data: { userId, type: "TERRAIN_ASSIGNED", title: "Nouveau terrain assigné", message: `Le terrain ${requisition.reference} vous a été attribué.`, requisitionId, relatedEntityType: "Requisition", relatedEntityId: requisitionId, dedupeKey: `TERRAIN_ASSIGNED:${userId}:${requisitionId}` } });
      return access;
    });
  }

  async revokeAccess(requisitionId: string, userId: string, actorId: string) {
    const existing = await this.prisma.userRequisitionAccess.findUnique({
      where: { userId_requisitionId: { userId, requisitionId } },
    });
    if (!existing) throw new NotFoundException("Affectation introuvable.");
    await this.prisma.userRequisitionAccess.delete({ where: { id: existing.id } });
    await this.audit.write({
      actorUserId: actorId,
      action: "REQUISITION_ACCESS_REVOKED",
      entityType: "UserRequisitionAccess",
      entityId: existing.id,
      oldValues: { userId, requisitionId },
      metadata: { requisitionId },
    });
  }
}
