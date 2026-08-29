import { Injectable } from "@nestjs/common";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { RequisitionsService } from "../requisitions/requisitions.service.js";
import { presentAction, presentDocument, presentNotification } from "../shared/presenters.js";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requisitions: RequisitionsService,
    private readonly access: AccessScopeService,
  ) {}

  async get(user: AuthUser) {
    const idFilter = await this.access.requisitionIdFilter(user);
    const scopedRequisitionId = idFilter ? { requisitionId: idFilter } : {};

    const [requisitions, documents, actions, alerts, agenda, activity] = await Promise.all([
      this.requisitions.list({}, user),
      this.prisma.document.findMany({
        where: { deletedAt: null, ...scopedRequisitionId },
        include: { currentVersion: true, createdBy: true, requisition: true },
      }),
      this.prisma.actionItem.findMany({
        where: { deletedAt: null, ...scopedRequisitionId },
        include: { responsibleUser: true, requisition: true },
      }),
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.terrainEvent.findMany({
        where: {
          ...scopedRequisitionId,
          validationStatus: "CONFIRMED",
          isScheduled: true,
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: "asc" },
        take: 20,
        include: { requisition: { select: { reference: true } } },
      }),
      this.access.isAdmin(user)
        ? this.prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { actorUser: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      requisitions,
      documents: documents.map(presentDocument),
      actions: actions.map(presentAction),
      alerts: alerts.map(presentNotification),
      pendingAiProposals: this.access.isAdmin(user)
        ? await this.prisma.aIExtraction.count({
            where: {
              extractionType: { startsWith: "TERRAIN_UPDATE." },
              status: "PROPOSED",
            },
          })
        : 0,
      agenda: agenda.map((h) => ({
        id: h.id,
        requisitionId: h.requisitionId,
        date: h.scheduledAt?.toISOString().slice(0, 10) ?? null,
        type: h.type,
        title: h.title,
        status: "Confirmé",
        responsible: h.requisition.reference,
      })),
      activity: activity.map((a) => ({
        id: a.id,
        title: a.action,
        detail: `${a.entityType} · ${a.entityId}`,
        date: a.createdAt.toISOString(),
        user: a.actorUser ? `${a.actorUser.firstName} ${a.actorUser.lastName}` : "Système",
      })),
    };
  }
}
