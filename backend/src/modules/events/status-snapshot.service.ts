import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { DataFreshnessCode, TerrainEventType } from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";

const JUDICIAL_TYPES = new Set<TerrainEventType>([
  "COURT_TRANSMISSION",
  "COURT_CASE_CREATED",
  "COURT_HEARING_SCHEDULED",
  "COURT_HEARING_POSTPONED",
  "COURT_HEARING_HELD",
  "COURT_DELIBERATION",
  "COURT_DECISION",
  "COURT_APPEAL",
  "COURT_CLOSED",
  "COURT_OTHER",
]);

function mapFreshness(raw?: string | null): DataFreshnessCode {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("confirm") && !v.includes("à confirmer") && !v.includes("a confirmer")) {
    return "CONFIRMED";
  }
  if (v.includes("ai") || v.includes("propos")) return "AI_SUGGESTED";
  if (v.includes("obsolète") || v.includes("outdated") || v.includes("actualiser")) return "OUTDATED";
  if (v.includes("confirmer") || v.includes("renseigner") || v.includes("à actualiser")) return "TO_CONFIRM";
  return "TO_CONFIRM";
}

@Injectable()
export class StatusSnapshotService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async refreshFromEvents(requisitionId: string, transaction?: Prisma.TransactionClient) {
    const database = transaction ?? this.prisma;
    const now = new Date();
    const confirmed = await database.terrainEvent.findMany({
      where: { requisitionId, validationStatus: "CONFIRMED" },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });
    const latest = confirmed.find((event) => event.occurredAt <= now) ?? null;
    const nextScheduled = confirmed
      .filter((e) => e.isScheduled && e.scheduledAt && e.scheduledAt >= now)
      .sort((a, b) => (a.scheduledAt!.getTime() - b.scheduledAt!.getTime()))[0];

    const judicial = confirmed.find((e) => JUDICIAL_TYPES.has(e.type));
    const requisition = await database.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        legalCases: {
          where: { deletedAt: null },
          select: { caseNumber: true, currentStage: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    if (!requisition) return null;

    let judicialState = "Pas au tribunal";
    if (requisition.legalCases.length > 0) {
      judicialState = requisition.legalCases
        .map((c) => `${c.caseNumber} (${c.currentStage})`)
        .join(" · ");
    } else if (requisition.courtReached === "À confirmer") {
      judicialState = "Transmission à confirmer";
    } else if (requisition.courtReached === "Oui") {
      judicialState = "Au tribunal";
    } else if (judicial) {
      judicialState = judicial.title;
    }

    const currentLabel =
      latest?.title ??
      requisition.mainStatusLabel ??
      requisition.mainIssue ??
      "Situation à renseigner";

    const dataFreshness = mapFreshness(requisition.dataFreshness);

    const snapshot = await database.requisitionStatusSnapshot.upsert({
      where: { requisitionId },
      create: {
        requisitionId,
        currentStage: requisition.legalCases[0]?.currentStage ?? requisition.mainStatus,
        currentLabel,
        latestKnownEventId: latest?.id,
        latestKnownEventAt: latest?.occurredAt ?? null,
        nextScheduledEventAt: nextScheduled?.scheduledAt ?? null,
        judicialState,
        dataFreshness,
        lastVerifiedAt: now,
      },
      update: {
        currentStage: requisition.legalCases[0]?.currentStage ?? requisition.mainStatus,
        currentLabel,
        latestKnownEventId: latest?.id,
        latestKnownEventAt: latest?.occurredAt ?? null,
        nextScheduledEventAt: nextScheduled?.scheduledAt ?? null,
        judicialState,
        dataFreshness,
        lastVerifiedAt: now,
      },
    });

    // Keep denormalized card fields in sync (non-destructive: only when events exist)
    await database.requisition.update({
      where: { id: requisitionId },
      data: {
        latestKnownEvent: latest?.title ?? requisition.latestKnownEvent,
        latestKnownEventAt: latest?.occurredAt ?? requisition.latestKnownEventAt,
        nextScheduledEventAt: nextScheduled?.scheduledAt ?? null,
        lastManuallyUpdatedAt: now,
      },
    });

    return snapshot;
  }

  async ensureFromRequisitionFields(requisitionId: string) {
    const existing = await this.prisma.requisitionStatusSnapshot.findUnique({
      where: { requisitionId },
    });
    if (existing) return existing;
    const r = await this.prisma.requisition.findUnique({ where: { id: requisitionId } });
    if (!r) return null;
    return this.prisma.requisitionStatusSnapshot.create({
      data: {
        requisitionId,
        currentStage: r.mainStatus,
        currentLabel: r.mainStatusLabel ?? r.mainIssue,
        latestKnownEventAt: r.latestKnownEventAt,
        nextScheduledEventAt: r.nextScheduledEventAt,
        judicialState:
          r.courtReached === "Oui"
            ? "Au tribunal"
            : r.courtReached === "Non"
              ? "Pas au tribunal"
              : "Transmission à confirmer",
        dataFreshness: mapFreshness(r.dataFreshness),
        lastVerifiedAt: r.lastManuallyUpdatedAt ?? r.updatedAt,
      },
    });
  }
}
