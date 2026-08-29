import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StatusSnapshotService } from "../events/status-snapshot.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { CreateTerrainEventDto, RescheduleTerrainEventDto, UpdateTerrainEventDto } from "./dto/terrain-event.dto.js";

const NOTIFIABLE_EVENT_TYPES = new Set([
  "COURT_HEARING_SCHEDULED",
  "COURT_HEARING_POSTPONED",
  "COURT_DECISION",
  "BORNAGE_SCHEDULED",
]);

@Injectable()
export class TerrainEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
    private readonly audit: AuditService,
    private readonly snapshots: StatusSnapshotService,
    private readonly notifications: NotificationsService,
  ) {}

  present(e: {
    id: string;
    requisitionId: string;
    type: string;
    occurredAt: Date;
    title: string;
    shortDescription: string | null;
    source: string;
    sourceDocumentId: string | null;
    legalCaseId?: string | null;
    validationStatus: string;
    isScheduled: boolean;
    scheduledAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: e.id,
      requisitionId: e.requisitionId,
      type: e.type,
      occurredAt: e.occurredAt.toISOString(),
      title: e.title,
      shortDescription: e.shortDescription,
      source: e.source,
      sourceDocumentId: e.sourceDocumentId,
      legalCaseId: e.legalCaseId ?? null,
      validationStatus: e.validationStatus,
      isScheduled: e.isScheduled,
      scheduledAt: e.scheduledAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    };
  }

  async listForRequisition(requisitionId: string, user: AuthUser, opts?: { includeProposed?: boolean }) {
    await this.access.assertCanAccessRequisition(user, requisitionId);
    const includeProposed = opts?.includeProposed && this.access.isAdmin(user);
    const rows = await this.prisma.terrainEvent.findMany({
      where: {
        requisitionId,
        ...(includeProposed ? {} : { validationStatus: "CONFIRMED" }),
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => this.present(r));
  }

  async listCalendar(user: AuthUser, from?: string, to?: string) {
    const idFilter = await this.access.requisitionIdFilter(user);
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
    const rows = await this.prisma.terrainEvent.findMany({
      where: {
        validationStatus: "CONFIRMED",
        ...(idFilter ? { requisitionId: idFilter } : {}),
        OR: [
          { isScheduled: true, scheduledAt: { gte: fromDate, lte: toDate } },
          { occurredAt: { gte: fromDate, lte: toDate } },
        ],
      },
      include: { requisition: { select: { reference: true, propertyName: true } } },
      orderBy: [{ scheduledAt: "asc" }, { occurredAt: "asc" }],
    });
    return rows.map((r) => ({
      ...this.present(r),
      requisitionReference: r.requisition.reference,
      propertyName: r.requisition.propertyName,
      calendarAt: (r.scheduledAt ?? r.occurredAt).toISOString(),
    }));
  }

  async upcoming(user: AuthUser, days = 30) {
    const idFilter = await this.access.requisitionIdFilter(user);
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.terrainEvent.findMany({
      where: {
        validationStatus: "CONFIRMED",
        isScheduled: true,
        scheduledAt: { gte: now, lte: until },
        ...(idFilter ? { requisitionId: idFilter } : {}),
      },
      include: { requisition: { select: { reference: true, propertyName: true } } },
      orderBy: { scheduledAt: "asc" },
    });
    return rows.map((r) => ({
      ...this.present(r),
      requisitionReference: r.requisition.reference,
      propertyName: r.requisition.propertyName,
      calendarAt: r.scheduledAt!.toISOString(),
    }));
  }

  async create(dto: CreateTerrainEventDto, user: AuthUser) {
    await this.access.assertCanAccessRequisition(user, dto.requisitionId);
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "EVENT_CREATE_FORBIDDEN",
        message: "Seul un administrateur peut créer un événement officiel.",
      });
    }
    const occurredAt = new Date(dto.occurredAt);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isScheduled = Boolean(dto.isScheduled ?? (scheduledAt && scheduledAt > new Date()));
    const row = await this.prisma.terrainEvent.create({
      data: {
        requisitionId: dto.requisitionId,
        type: dto.type,
        occurredAt,
        title: dto.title,
        shortDescription: dto.shortDescription,
        source: dto.source ?? "MANUAL",
        sourceDocumentId: dto.sourceDocumentId,
        hearingId: dto.hearingId,
        legalCaseId: dto.legalCaseId,
        createdByUserId: user.id,
        validatedByUserId: user.id,
        validationStatus: dto.validationStatus ?? "CONFIRMED",
        isScheduled,
        scheduledAt,
        payloadJson: dto.payloadJson
          ? (dto.payloadJson as object)
          : undefined,
      },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: "terrain_event.create",
      entityType: "TerrainEvent",
      entityId: row.id,
      newValues: { type: row.type, title: row.title, requisitionId: row.requisitionId },
    });
    if (row.validationStatus === "CONFIRMED") {
      await this.snapshots.refreshFromEvents(row.requisitionId);
      if (NOTIFIABLE_EVENT_TYPES.has(row.type)) {
        const requisition = await this.prisma.requisition.findUnique({ where: { id: row.requisitionId }, select: { reference: true } });
        if (requisition) {
          await this.notifications.notifyAssignedUsersOfConfirmedUpdate(
            row.requisitionId,
            requisition.reference,
            row.title,
            row.shortDescription ?? row.title,
            row.id,
          );
        }
      }
    }
    return this.present(row);
  }

  async update(id: string, dto: UpdateTerrainEventDto, user: AuthUser) {
    const existing = await this.prisma.terrainEvent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Événement introuvable.");
    await this.access.assertCanAccessRequisition(user, existing.requisitionId);
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({
        code: "EVENT_UPDATE_FORBIDDEN",
        message: "Seul un administrateur peut modifier un événement.",
      });
    }
    const scheduledAt = dto.scheduledAt !== undefined
      ? (dto.scheduledAt ? new Date(dto.scheduledAt) : null)
      : existing.scheduledAt;
    const row = await this.prisma.terrainEvent.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        shortDescription: dto.shortDescription,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        validationStatus: dto.validationStatus,
        validatedByUserId: dto.validationStatus ? user.id : undefined,
        isScheduled: dto.isScheduled,
        scheduledAt,
        payloadJson:
          dto.payloadJson === undefined
            ? undefined
            : (dto.payloadJson as object),
      },
    });
    await this.snapshots.refreshFromEvents(row.requisitionId);
    return this.present(row);
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.prisma.terrainEvent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Événement introuvable.");
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({ code: "EVENT_DELETE_FORBIDDEN", message: "Suppression réservée à l’administration." });
    }
    await this.prisma.terrainEvent.delete({ where: { id } });
    await this.snapshots.refreshFromEvents(existing.requisitionId);
  }

  async reschedule(id: string, dto: RescheduleTerrainEventDto, user: AuthUser) {
    const existing = await this.prisma.terrainEvent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Événement introuvable.");
    await this.access.assertCanAccessRequisition(user, existing.requisitionId);
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException({ code: "EVENT_RESCHEDULE_FORBIDDEN", message: "Report réservé à l'administration." });
    }
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException({ code: "EVENT_DATE_NOT_FUTURE", message: "La nouvelle date doit être future." });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.terrainEvent.update({ where: { id }, data: { isScheduled: false } });
      const created = await tx.terrainEvent.create({
        data: {
          requisitionId: existing.requisitionId,
          type: "COURT_HEARING_POSTPONED",
          occurredAt: new Date(),
          title: dto.title ?? "Audience reportée",
          shortDescription: dto.shortDescription,
          source: "MANUAL",
          legalCaseId: existing.legalCaseId,
          hearingId: existing.hearingId,
          createdByUserId: user.id,
          validatedByUserId: user.id,
          validationStatus: "CONFIRMED",
          isScheduled: true,
          scheduledAt,
          payloadJson: { previousEventId: id, previousScheduledAt: existing.scheduledAt?.toISOString() ?? null },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "terrain_event.reschedule",
          entityType: "TerrainEvent",
          entityId: created.id,
          metadata: { requisitionId: existing.requisitionId, previousEventId: id },
        },
      });
      return created;
    });
    await this.snapshots.refreshFromEvents(existing.requisitionId);
    const requisition = await this.prisma.requisition.findUnique({ where: { id: existing.requisitionId }, select: { reference: true } });
    if (requisition) {
      await this.notifications.notifyAssignedUsersOfConfirmedUpdate(existing.requisitionId, requisition.reference, row.title, row.shortDescription ?? row.title, row.id);
    }
    return this.present(row);
  }
}
