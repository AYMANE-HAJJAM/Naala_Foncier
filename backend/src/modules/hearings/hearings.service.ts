import { Injectable, NotFoundException } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { StatusSnapshotService } from "../events/status-snapshot.service.js";
import type { CreateHearingDto, UpdateHearingDto } from "./hearings.controller.js";

@Injectable()
export class HearingsService {
  constructor(
    private readonly p: PrismaService,
    private readonly access: AccessScopeService,
    private readonly snapshots: StatusSnapshotService,
  ) {}

  private include = { responsibleUser: true } as const;

  private present(h: Awaited<ReturnType<HearingsService["record"]>>) {
    return {
      id: h.id,
      requisitionId: h.requisitionId,
      date: h.scheduledAt?.toISOString().slice(0, 10) ?? null,
      type: h.eventType,
      title: h.title,
      status: h.status,
      responsible: h.responsibleUser
        ? `${h.responsibleUser.firstName} ${h.responsibleUser.lastName}`
        : "Non renseigné",
      legalCaseId: h.legalCaseId,
      result: h.result ?? "À confirmer",
    };
  }

  async record(id: string) {
    const h = await this.p.hearing.findUnique({ where: { id }, include: this.include });
    if (!h) throw new NotFoundException("Événement introuvable.");
    return h;
  }

  async list(user: AuthUser, req?: string) {
    if (req) await this.access.assertCanAccessRequisition(user, req);
    const idFilter = req ? undefined : await this.access.requisitionIdFilter(user);
    return (
      await this.p.hearing.findMany({
        where: req ? { requisitionId: req } : idFilter ? { requisitionId: idFilter } : {},
        include: this.include,
        orderBy: { scheduledAt: "asc" },
      })
    ).map((h) => this.present(h));
  }

  async get(id: string, user: AuthUser) {
    const h = await this.record(id);
    await this.access.assertCanAccessRequisition(user, h.requisitionId);
    return this.present(h);
  }

  async create(d: CreateHearingDto, actor: AuthUser) {
    await this.access.assertCanAccessRequisition(actor, d.requisitionId);
    const h = await this.p.$transaction(async (tx) => {
      const v = await tx.hearing.create({
        data: {
          ...d,
          scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : undefined,
          completedAt: d.completedAt ? new Date(d.completedAt) : undefined,
        },
        include: this.include,
      });
      if (v.scheduledAt) {
        await tx.terrainEvent.create({
          data: {
            requisitionId: v.requisitionId,
            type: "COURT_HEARING_SCHEDULED",
            occurredAt: new Date(),
            title: v.title,
            shortDescription: v.notes,
            source: "HEARING_MIRROR",
            hearingId: v.id,
            legalCaseId: v.legalCaseId,
            createdByUserId: actor.id,
            validatedByUserId: actor.id,
            validationStatus: "CONFIRMED",
            isScheduled: true,
            scheduledAt: v.scheduledAt,
          },
        });
      }
      const accessRows = await tx.userRequisitionAccess.findMany({
        where: { requisitionId: d.requisitionId },
        select: { userId: true },
      });
      const admins = await tx.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          roles: { some: { role: { key: "ADMIN" } } },
        },
        select: { id: true },
      });
      const recipientIds = [
        ...new Set([...accessRows.map((a) => a.userId), ...admins.map((a) => a.id)]),
      ];
      if (recipientIds.length) {
        await tx.notification.createMany({
          data: recipientIds.map((userId) => ({
            userId,
            type: "HEARING_CREATED",
            title: "Nouvelle échéance ajoutée",
            message: d.title,
            requisitionId: d.requisitionId,
            relatedEntityType: "Hearing",
            relatedEntityId: v.id,
            dedupeKey: `HEARING_CREATED:${userId}:${v.id}`,
          })),
          skipDuplicates: true,
        });
      }
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "HEARING_CREATED", entityType: "Hearing", entityId: v.id, metadata: { requisitionId: v.requisitionId } },
      });
      return v;
    });
    await this.snapshots.refreshFromEvents(h.requisitionId);
    return this.present(h);
  }

  async update(id: string, d: UpdateHearingDto, actor: AuthUser) {
    const previous = await this.record(id);
    await this.access.assertCanAccessRequisition(actor, previous.requisitionId);
    if (d.requisitionId) await this.access.assertCanAccessRequisition(actor, d.requisitionId);
    const h = await this.p.$transaction(async (tx) => {
      const v = await tx.hearing.update({
        where: { id },
        data: {
          ...d,
          scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : undefined,
          completedAt: d.completedAt ? new Date(d.completedAt) : undefined,
        },
        include: this.include,
      });
      const dateChanged = previous.scheduledAt?.getTime() !== v.scheduledAt?.getTime();
      if (dateChanged) {
        await tx.terrainEvent.updateMany({
          where: { hearingId: id, source: "HEARING_MIRROR", isScheduled: true },
          data: { isScheduled: false },
        });
        if (v.scheduledAt) {
          await tx.terrainEvent.create({
            data: {
              requisitionId: v.requisitionId,
              type: "COURT_HEARING_POSTPONED",
              occurredAt: new Date(),
              title: v.title,
              shortDescription: v.notes,
              source: "HEARING_MIRROR",
              hearingId: v.id,
              legalCaseId: v.legalCaseId,
              createdByUserId: actor.id,
              validatedByUserId: actor.id,
              validationStatus: "CONFIRMED",
              isScheduled: true,
              scheduledAt: v.scheduledAt,
              payloadJson: {
                previousScheduledAt: previous.scheduledAt?.toISOString() ?? null,
              },
            },
          });
        }
      } else if (["REALISE", "ANNULE"].includes(v.status)) {
        await tx.terrainEvent.updateMany({
          where: { hearingId: id, source: "HEARING_MIRROR", isScheduled: true },
          data: { isScheduled: false },
        });
      }
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "HEARING_UPDATED", entityType: "Hearing", entityId: id },
      });
      return v;
    });
    await this.snapshots.refreshFromEvents(h.requisitionId);
    return this.present(h);
  }

  async remove(id: string, actor: AuthUser) {
    const previous = await this.record(id);
    await this.access.assertCanAccessRequisition(actor, previous.requisitionId);
    await this.p.$transaction([
      this.p.terrainEvent.updateMany({
        where: { hearingId: id, source: "HEARING_MIRROR", isScheduled: true },
        data: { isScheduled: false },
      }),
      this.p.hearing.delete({ where: { id } }),
    ]);
    await this.snapshots.refreshFromEvents(previous.requisitionId);
  }
}
