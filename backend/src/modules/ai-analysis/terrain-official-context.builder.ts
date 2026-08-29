import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { TerrainOfficialContext } from "./terrain-update-analysis.provider.js";

@Injectable()
export class TerrainOfficialContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(requisitionId: string): Promise<TerrainOfficialContext> {
    const requisition = await this.prisma.requisition.findFirst({
      where: { id: requisitionId, deletedAt: null },
      include: {
        statusSnapshot: true,
        legalCases: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
        oppositions: { where: { deletedAt: null }, orderBy: { oppositionNumber: "asc" } },
        outgoingRelations: {
          include: { target: { select: { reference: true } } },
        },
      },
    });
    if (!requisition) {
      throw new Error(`Requisition ${requisitionId} not found`);
    }

    const events = await this.prisma.terrainEvent.findMany({
      where: { requisitionId, validationStatus: "CONFIRMED" },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 25,
    });

    const now = new Date();
    const upcoming = events
      .filter((e) => e.isScheduled && e.scheduledAt && e.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())
      .slice(0, 10);

    const surface =
      requisition.surfaceHectares != null
        ? `${requisition.surfaceHectares} ha ${requisition.surfaceAres ?? 0} a ${requisition.surfaceCentiares ?? 0} ca`
        : null;

    const snapshot = requisition.statusSnapshot;

    return {
      requisitionId,
      reference: requisition.reference,
      identity: {
        propertyName: requisition.propertyName,
        location: requisition.location,
        surface,
        seller: requisition.sellerName,
        buyer: requisition.buyerName,
        linkedRequisitions: requisition.outgoingRelations.map((r) => r.target.reference),
      },
      proceduralStatus: {
        currentStage: snapshot?.currentStage ?? requisition.mainStatus,
        currentLabel: snapshot?.currentLabel ?? requisition.mainStatusLabel,
        latestKnownEvent:
          snapshot?.currentLabel ?? requisition.latestKnownEvent ?? null,
        latestKnownEventAt: (
          snapshot?.latestKnownEventAt ??
          requisition.latestKnownEventAt
        )?.toISOString() ?? null,
        nextScheduledEventAt: (
          snapshot?.nextScheduledEventAt ?? requisition.nextScheduledEventAt
        )?.toISOString() ?? null,
        judicialState: snapshot?.judicialState ?? null,
      },
      courtCases: requisition.legalCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        courtName: c.courtName,
        currentStage: c.currentStage,
        nextEventAt: c.nextEventAt?.toISOString() ?? null,
      })),
      recentEvents: events.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        occurredAt: e.occurredAt.toISOString(),
        scheduledAt: e.scheduledAt?.toISOString() ?? null,
        isScheduled: e.isScheduled,
        legalCaseId: e.legalCaseId,
      })),
      oppositions: requisition.oppositions.map((o) => ({
        id: o.id,
        number: o.oppositionNumber,
        opponentName: o.opponentName,
        type: o.type,
        claimedSurface:
          o.claimedSurfaceHectares == null
            ? null
            : `${o.claimedSurfaceHectares} ha ${o.claimedSurfaceAres ?? 0} a ${o.claimedSurfaceCentiares ?? 0} ca`,
        referenceDate: o.referenceDate?.toISOString().slice(0, 10) ?? null,
      })),
      upcomingDates: upcoming.map((e) => ({
        label: e.title,
        at: (e.scheduledAt ?? e.occurredAt).toISOString(),
        sourceType: e.type,
      })),
    };
  }
}
