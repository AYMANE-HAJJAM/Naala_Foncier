import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { presentNotification } from "../shared/presenters.js";
import type { Prisma } from "../../generated/prisma/client.js";

type NotificationDelivery = {
  recipientIds: string[];
  type: string;
  title: string;
  message: string;
  requisitionId?: string | null;
  relatedEntityType?: string;
  relatedEntityId?: string;
  dedupeKey?: (userId: string) => string | undefined;
};

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

  async deliver(
    input: NotificationDelivery,
    database: PrismaService | Prisma.TransactionClient = this.p,
  ) {
    const recipientIds = [...new Set(input.recipientIds)];
    if (!recipientIds.length) return { count: 0 };
    return database.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        requisitionId: input.requisitionId,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        dedupeKey: input.dedupeKey?.(userId),
      })),
      skipDuplicates: true,
    });
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

    await this.deliver({
      recipientIds: admins.map((admin) => admin.id),
      type: "AI_UPDATE_REVIEW",
      title: "Nouvelles informations détectées",
      message: `${count} mise${count > 1 ? "s" : ""} à jour ${count > 1 ? "sont" : "est"} à vérifier pour ${reference}.`,
      requisitionId,
      relatedEntityType: "Document",
      relatedEntityId: documentId,
      dedupeKey: (userId) => `AI_UPDATE_REVIEW:${userId}:${documentId}`,
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

    await this.deliver({
      recipientIds: userIds,
      type: "TERRAIN_UPDATE_CONFIRMED",
      title,
      message: `${reference} — ${message}`,
      requisitionId,
      relatedEntityType: entityId ? "TerrainEvent" : undefined,
      relatedEntityId: entityId,
      dedupeKey: (userId) =>
        entityId ? `TERRAIN_UPDATE_CONFIRMED:${userId}:${entityId}` : undefined,
    });
  }
}
