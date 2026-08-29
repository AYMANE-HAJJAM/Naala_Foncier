import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const references = ["R 20657/31", "R 20629/31", "R 20696/31", "R 20611/31", "R 20612/31", "R 148026/31", "R 16605/31"];
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  const terrains = await prisma.requisition.findMany({
    where: { reference: { in: references }, deletedAt: null },
    orderBy: { reference: "asc" },
    include: {
      outgoingRelations: { include: { target: { select: { reference: true } } } },
      incomingRelations: { include: { source: { select: { reference: true } } } },
      legalCases: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      hearings: { orderBy: { scheduledAt: "asc" } },
      terrainEvents: { where: { validationStatus: "CONFIRMED" }, orderBy: { occurredAt: "asc" } },
      statusSnapshot: true,
      oppositions: { where: { deletedAt: null }, include: { sourceDocument: { select: { id: true, title: true } } } },
      documents: { where: { deletedAt: null }, include: { currentVersion: { select: { originalFilename: true, storageKey: true } } } },
      reports: { where: { deletedAt: null }, include: { currentVersion: { select: { versionNumber: true } } } },
    },
  });
  const now = new Date();
  const result = terrains.map((terrain) => {
    const anomalies: string[] = [];
    if (terrain.statusSnapshot?.nextScheduledEventAt && terrain.statusSnapshot.nextScheduledEventAt < now) anomalies.push("snapshot_next_date_in_past");
    if ((terrain.oppositionCount ?? 0) < terrain.oppositions.length) anomalies.push("detailed_oppositions_exceed_known_count");
    if (terrain.oppositions.some((opposition) => !opposition.sourceDocumentId)) anomalies.push("opposition_without_source_document");
    const documentKeys = new Set<string>();
    for (const document of terrain.documents) {
      const key = `${document.category}|${document.customCategoryName ?? ""}|${document.currentVersion?.originalFilename ?? ""}`.toLowerCase();
      if (documentKeys.has(key)) anomalies.push(`possible_document_duplicate:${document.id}`);
      documentKeys.add(key);
    }
    if (terrain.reference === "R 16605/31") {
      if (terrain.isPrincipal) anomalies.push("R16605_marked_principal");
      const linked = [...terrain.outgoingRelations.map((r) => r.target.reference), ...terrain.incomingRelations.map((r) => r.source.reference)];
      if (!linked.includes("R 20612/31")) anomalies.push("R16605_not_linked_to_R20612");
    }
    return {
      identity: { reference: terrain.reference, propertyName: terrain.propertyName, location: terrain.location, surface: { hectares: terrain.surfaceHectares, ares: terrain.surfaceAres, centiares: terrain.surfaceCentiares }, seller: terrain.sellerName, buyer: terrain.buyerName, isPrincipal: terrain.isPrincipal },
      relations: { outgoing: terrain.outgoingRelations.map((r) => ({ reference: r.target.reference, type: r.relationType })), incoming: terrain.incomingRelations.map((r) => ({ reference: r.source.reference, type: r.relationType })) },
      judicial: { cases: terrain.legalCases.map((c) => ({ number: c.caseNumber, court: c.courtName, phase: c.currentPhase, stage: c.currentStage, status: c.currentStatus, latestEventAt: c.latestEventAt, nextEventAt: c.nextEventAt })), hearings: terrain.hearings.map((h) => ({ id: h.id, status: h.status, scheduledAt: h.scheduledAt, nextDate: h.nextDate })), events: terrain.terrainEvents.map((e) => ({ id: e.id, type: e.type, occurredAt: e.occurredAt, isScheduled: e.isScheduled, scheduledAt: e.scheduledAt, legalCaseId: e.legalCaseId })), snapshot: terrain.statusSnapshot },
      oppositions: { knownCount: terrain.oppositionCount, detailedCount: terrain.oppositions.length, rows: terrain.oppositions.map((o) => ({ id: o.id, number: o.oppositionNumber, opponentName: o.opponentName, type: o.type, sourceDocument: o.sourceDocument })) },
      documents: terrain.documents.map((d) => ({ id: d.id, title: d.title, category: d.category, customCategoryName: d.customCategoryName, currentFilename: d.currentVersion?.originalFilename ?? null })),
      reports: terrain.reports.map((r) => ({ id: r.id, title: r.title, status: r.status, documentId: r.documentId, currentVersion: r.currentVersion?.versionNumber ?? null })),
      anomalies,
    };
  });
  console.log(JSON.stringify({ expected: references.length, found: terrains.length, missing: references.filter((reference) => !terrains.some((terrain) => terrain.reference === reference)), terrains: result }, null, 2));
} finally {
  await prisma.$disconnect();
}
