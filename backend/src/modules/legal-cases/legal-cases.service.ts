import { Injectable, NotFoundException } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { StatusSnapshotService } from "../events/status-snapshot.service.js";
import type { CreateLegalCaseDto, UpdateLegalCaseDto } from "./legal-cases.controller.js";

@Injectable()
export class LegalCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
    private readonly snapshots: StatusSnapshotService,
  ) {}

  private include = { lawyer: true } as const;

  private async present(c: Prisma.LegalCaseGetPayload<{ include: { lawyer: true } }>) {
    const now = new Date();
    const events = await this.prisma.terrainEvent.findMany({
      where: { legalCaseId: c.id, validationStatus: "CONFIRMED" },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, type: true, title: true, occurredAt: true, scheduledAt: true, isScheduled: true },
    });
    const latest = events.find((event) => event.occurredAt <= now) ?? null;
    const next = events
      .filter((event) => event.isScheduled && event.scheduledAt && event.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())[0] ?? null;
    return {
      id: c.id,
      requisitionId: c.requisitionId,
      number: c.caseNumber,
      court: c.courtName,
      phase: c.currentPhase,
      currentStage: c.currentStage,
      currentStatus: c.currentStatus,
      uiStatus: c.currentStage,
      lawyer: c.lawyer ? `${c.lawyer.firstName} ${c.lawyer.lastName}` : null,
      latestEvent: latest ? { id: latest.id, type: latest.type, title: latest.title, occurredAt: latest.occurredAt.toISOString() } : null,
      nextEvent: next ? { id: next.id, type: next.type, title: next.title, scheduledAt: next.scheduledAt!.toISOString() } : null,
      outcome: c.outcomeStatus,
      linkedRequisitionId: c.linkedRequisitionId,
      events: events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString(), scheduledAt: event.scheduledAt?.toISOString() ?? null })),
    };
  }

  async record(id: string) {
    const r = await this.prisma.legalCase.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!r) throw new NotFoundException("Dossier judiciaire introuvable.");
    return r;
  }

  async list(user: AuthUser, req?: string) {
    if (req) await this.access.assertCanAccessRequisition(user, req);
    const idFilter = req ? undefined : await this.access.requisitionIdFilter(user);
    const cases = await this.prisma.legalCase.findMany({
        where: {
          deletedAt: null,
          ...(req ? { requisitionId: req } : idFilter ? { requisitionId: idFilter } : {}),
        },
        include: this.include,
        orderBy: { updatedAt: "desc" },
      });
    return Promise.all(cases.map((c) => this.present(c)));
  }

  async get(id: string, user: AuthUser) {
    const r = await this.record(id);
    await this.access.assertCanAccessRequisition(user, r.requisitionId);
    return this.present(r);
  }

  async create(dto: CreateLegalCaseDto, actor: AuthUser) {
    await this.access.assertCanAccessRequisition(actor, dto.requisitionId);
    const c = await this.prisma.$transaction(async (tx) => {
      const v = await tx.legalCase.create({
        data: {
          ...dto,
          latestEventAt: dto.latestEventAt ? new Date(dto.latestEventAt) : undefined,
          nextEventAt: dto.nextEventAt ? new Date(dto.nextEventAt) : undefined,
        },
        include: this.include,
      });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "LEGAL_CASE_CREATED", entityType: "LegalCase", entityId: v.id, metadata: { requisitionId: v.requisitionId } },
      });
      await tx.terrainEvent.create({
        data: {
          requisitionId: v.requisitionId,
          legalCaseId: v.id,
          type: "COURT_CASE_CREATED",
          occurredAt: v.registrationDate ?? new Date(),
          title: `Affaire ${v.caseNumber} créée`,
          source: "MANUAL",
          createdByUserId: actor.id,
          validatedByUserId: actor.id,
          validationStatus: "CONFIRMED",
        },
      });
      return v;
    });
    await this.snapshots.refreshFromEvents(c.requisitionId);
    return this.present(c);
  }

  async update(id: string, dto: UpdateLegalCaseDto, actor: AuthUser) {
    const previous = await this.record(id);
    await this.access.assertCanAccessRequisition(actor, previous.requisitionId);
    if (dto.requisitionId) await this.access.assertCanAccessRequisition(actor, dto.requisitionId);
    const c = await this.prisma.$transaction(async (tx) => {
      const v = await tx.legalCase.update({
        where: { id },
        data: {
          ...dto,
          latestEventAt: dto.latestEventAt ? new Date(dto.latestEventAt) : undefined,
          nextEventAt: dto.nextEventAt ? new Date(dto.nextEventAt) : undefined,
        },
        include: this.include,
      });
      await tx.auditLog.create({
        data: { actorUserId: actor.id, action: "LEGAL_CASE_UPDATED", entityType: "LegalCase", entityId: id, metadata: { requisitionId: v.requisitionId } },
      });
      return v;
    });
    await this.snapshots.refreshFromEvents(c.requisitionId);
    return this.present(c);
  }

  async remove(id: string, actor: AuthUser) {
    const previous = await this.record(id);
    await this.access.assertCanAccessRequisition(actor, previous.requisitionId);
    await this.prisma.$transaction([
      this.prisma.legalCase.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorUserId: actor.id, action: "LEGAL_CASE_ARCHIVED", entityType: "LegalCase", entityId: id, metadata: { requisitionId: previous.requisitionId } } }),
    ]);
    await this.snapshots.refreshFromEvents(previous.requisitionId);
  }
}
