import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { presentNotification } from "../shared/presenters.js";

@Injectable()
export class NotificationsService {
  constructor(private readonly p: PrismaService) {}

  async list(user: string) {
    return (
      await this.p.notification.findMany({
        where: { userId: user },
        orderBy: { createdAt: "desc" },
      })
    ).map(presentNotification);
  }

  async read(id: string, user: string) {
    const n = await this.p.notification.update({
      where: { id, userId: user },
      data: { readAt: new Date() },
    });
    return presentNotification(n);
  }

  async readAll(user: string) {
    const result = await this.p.notification.updateMany({
      where: { userId: user, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async notifyAdminsOfTerrainUpdateProposals(
    requisitionId: string,
    reference: string,
    count: number,
    documentId: string,
  ) {
    const admins = await this.p.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        roles: { some: { role: { key: "ADMIN" } } },
      },
      select: { id: true },
    });
    if (!admins.length || count <= 0) return;

    await this.p.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "AI_UPDATE_REVIEW",
        title: "Nouvelles informations détectées",
        message: `${count} mise${count > 1 ? "s" : ""} à jour ${count > 1 ? "sont" : "est"} à vérifier pour ${reference}.`,
        requisitionId,
        relatedEntityType: "Document",
        relatedEntityId: documentId,
        dedupeKey: `AI_UPDATE_REVIEW:${a.id}:${documentId}`,
      })),
      skipDuplicates: true,
    });
  }

  async notifyAssignedUsersOfConfirmedUpdate(
    requisitionId: string,
    reference: string,
    title: string,
    message: string,
    entityId?: string,
  ) {
    const access = await this.p.userRequisitionAccess.findMany({
      where: { requisitionId },
      select: { userId: true },
    });
    const userIds = [...new Set(access.map((a) => a.userId))];
    if (!userIds.length) return;

    await this.p.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: "TERRAIN_UPDATE_CONFIRMED",
        title,
        message: `${reference} — ${message}`,
        requisitionId,
        relatedEntityType: entityId ? "TerrainEvent" : undefined,
        relatedEntityId: entityId,
        dedupeKey: entityId ? `TERRAIN_UPDATE_CONFIRMED:${userId}:${entityId}` : undefined,
      })),
      skipDuplicates: true,
    });
  }
}
