import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  write(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: Prisma.InputJsonValue;
    newValues?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }, database: PrismaService | Prisma.TransactionClient = this.prisma) {
    return database.auditLog.create({ data: input });
  }
  list(page = 1, pageSize = 50) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actorUser: { select: { firstName: true, lastName: true } } },
    });
  }
  async forRequisition(requisitionId: string, includeTechnical = false) {
    const [documents, legalCases, oppositions, reports] = await Promise.all([
      this.prisma.document.findMany({ where: { requisitionId }, select: { id: true } }),
      this.prisma.legalCase.findMany({ where: { requisitionId }, select: { id: true } }),
      this.prisma.opposition.findMany({ where: { requisitionId }, select: { id: true } }),
      this.prisma.report.findMany({ where: { requisitionId }, select: { id: true } }),
    ]);
    const byType = [
      { entityType: "Requisition", entityId: requisitionId },
      ...documents.map(({ id }) => ({ entityType: "Document", entityId: id })),
      ...legalCases.map(({ id }) => ({ entityType: "LegalCase", entityId: id })),
      ...oppositions.map(({ id }) => ({ entityType: "Opposition", entityId: id })),
      ...reports.map(({ id }) => ({ entityType: "Report", entityId: id })),
    ];
    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          ...byType,
          { metadata: { path: ["requisitionId"], equals: requisitionId } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { actorUser: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actor: row.actorUser ? `${row.actorUser.firstName} ${row.actorUser.lastName}` : null,
      createdAt: row.createdAt,
      ...(includeTechnical ? { oldValues: row.oldValues, newValues: row.newValues, metadata: row.metadata } : {}),
    }));
  }
}
