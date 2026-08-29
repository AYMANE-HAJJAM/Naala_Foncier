/**
 * Idempotent Phase 1 backfill:
 * - TerrainEvent from terrain-summaries + Hearing rows
 * - RequisitionStatusSnapshot
 * - LegalCase.linkedRequisitionId for R 20612 ↔ R 16605 when detectable
 *
 * Does NOT overwrite newer manual Requisition fields with older import text.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { terrainSummaries } from "../src/modules/requisitions/terrain-summaries.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function inferEventType(title: string, judicial: boolean): string {
  const t = title.toLowerCase();
  if (t.includes("bornage") && t.includes("bloq")) return "BORNAGE_BLOCKED";
  if (t.includes("bornage")) return "BORNAGE_ATTEMPTED";
  if (t.includes("moudawala")) return "COURT_HEARING_HELD";
  if (t.includes("audience")) return "COURT_HEARING_SCHEDULED";
  if (t.includes("transmission")) return "COURT_TRANSMISSION";
  if (t.includes("opposition")) return "OPPOSITION_ADDED";
  if (judicial) return "OTHER";
  return "GENERAL_UPDATE";
}

function mapFreshness(raw?: string | null) {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("confirmé") || v.includes("confirme")) return "CONFIRMED" as const;
  if (v.includes("actualiser") || v.includes("renseigner")) return "TO_CONFIRM" as const;
  return "TO_CONFIRM" as const;
}

async function main() {
  console.log("Phase 1 backfill starting…");

  const requisitions = await prisma.requisition.findMany({
    where: { deletedAt: null },
    include: {
      hearings: true,
      legalCases: { where: { deletedAt: null } },
      terrainEvents: true,
      statusSnapshot: true,
    },
  });

  const byRef = new Map(requisitions.map((r) => [r.reference, r]));
  const r20612 = byRef.get("R 20612/31");
  const r16605 = byRef.get("R 16605/31");

  if (r20612 && r16605) {
    for (const lc of r20612.legalCases) {
      if (!lc.linkedRequisitionId) {
        await prisma.legalCase.update({
          where: { id: lc.id },
          data: { linkedRequisitionId: r16605.id },
        });
        console.log(`Linked LegalCase ${lc.caseNumber} → R 16605/31`);
      }
    }
    const existingRelation = await prisma.requisitionRelation.findFirst({
      where: {
        OR: [
          { sourceRequisitionId: r20612.id, targetRequisitionId: r16605.id },
          { sourceRequisitionId: r16605.id, targetRequisitionId: r20612.id },
        ],
      },
    });
    if (!existingRelation) {
      await prisma.requisitionRelation.create({
        data: {
          sourceRequisitionId: r20612.id,
          targetRequisitionId: r16605.id,
          relationType: "RECIPROQUE",
          description: "Dossier réciproque / chevauchement possible",
        },
      });
      console.log("Created RequisitionRelation R 20612 ↔ R 16605");
    }
    if (r16605.isPrincipal !== false) {
      await prisma.requisition.update({
        where: { id: r16605.id },
        data: { isPrincipal: false },
      });
    }
  }

  for (const seed of terrainSummaries) {
    const req = byRef.get(seed.reference);
    if (!req) {
      console.warn(`Skip missing requisition ${seed.reference}`);
      continue;
    }

    const hasImportEvent = req.terrainEvents.some(
      (e) => e.source === "IMPORT" && e.title === (seed.latestKnownEvent ?? ""),
    );

    if (seed.latestKnownEvent && !hasImportEvent) {
      const occurredAt = seed.latestKnownEventAt
        ? new Date(`${seed.latestKnownEventAt}T12:00:00.000Z`)
        : req.createdAt;
      await prisma.terrainEvent.create({
        data: {
          requisitionId: req.id,
          type: inferEventType(seed.latestKnownEvent, Boolean(seed.latestJudicialEvent)) as never,
          occurredAt,
          title: seed.latestKnownEvent,
          shortDescription: seed.eventResult ?? seed.currentSituation,
          source: "IMPORT",
          validationStatus: "CONFIRMED",
          isScheduled: false,
          payloadJson: {
            sourceMeta: seed.sourceMeta,
            courtReached: seed.courtReached,
          },
        },
      });
      console.log(`Event for ${seed.reference}: ${seed.latestKnownEvent}`);
    }

    // Mirror hearings into TerrainEvent if not already mirrored
    for (const h of req.hearings) {
      const already = req.terrainEvents.some((e) => e.hearingId === h.id);
      if (already) continue;
      const at = h.scheduledAt ?? h.completedAt ?? h.createdAt;
      const isFuture = h.scheduledAt ? h.scheduledAt.getTime() >= Date.now() : false;
      await prisma.terrainEvent.create({
        data: {
          requisitionId: req.id,
          type:
            h.eventType === "AUDIENCE" || h.eventType === "MOUDAWALA"
              ? "COURT_HEARING_SCHEDULED"
              : h.eventType === "BORNAGE"
                ? "BORNAGE_SCHEDULED"
                : "OTHER",
          occurredAt: at,
          title: h.title,
          shortDescription: h.result ?? h.notes,
          source: "HEARING_MIRROR",
          hearingId: h.id,
          legalCaseId: h.legalCaseId,
          validationStatus: "CONFIRMED",
          isScheduled: isFuture,
          scheduledAt: isFuture ? h.scheduledAt : null,
        },
      });
      console.log(`Mirrored hearing ${h.title} → ${seed.reference}`);
    }

    // Snapshot from current fields + events (non-destructive on identity)
    const events = await prisma.terrainEvent.findMany({
      where: { requisitionId: req.id, validationStatus: "CONFIRMED" },
      orderBy: { occurredAt: "desc" },
    });
    const latest = events[0];
    const now = new Date();
    const next = events
      .filter((e) => e.isScheduled && e.scheduledAt && e.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())[0];

    await prisma.requisitionStatusSnapshot.upsert({
      where: { requisitionId: req.id },
      create: {
        requisitionId: req.id,
        currentStage: req.mainStatus,
        currentLabel: req.mainStatusLabel ?? seed.currentSituation ?? req.mainIssue,
        latestKnownEventId: latest?.id,
        latestKnownEventAt: latest?.occurredAt ?? req.latestKnownEventAt,
        nextScheduledEventAt: next?.scheduledAt ?? null,
        judicialState:
          seed.courtReached === "Oui"
            ? "Au tribunal"
            : seed.courtReached === "Non"
              ? "Pas au tribunal"
              : "Transmission à confirmer",
        dataFreshness: mapFreshness(seed.dataFreshness),
        lastVerifiedAt: now,
      },
      update: {
        currentLabel: req.mainStatusLabel ?? seed.currentSituation ?? req.mainIssue,
        latestKnownEventId: latest?.id,
        latestKnownEventAt: latest?.occurredAt ?? req.latestKnownEventAt,
        nextScheduledEventAt: next?.scheduledAt ?? null,
        dataFreshness: mapFreshness(req.dataFreshness ?? seed.dataFreshness),
        lastVerifiedAt: now,
      },
    });
  }

  console.log("Phase 1 backfill done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
