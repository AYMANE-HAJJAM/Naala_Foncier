import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  terrainSummaries,
} from "../src/modules/requisitions/terrain-summaries.js";

/**
 * Apply factual presentation summaries without changing user access.
 * Skips dossiers already manually updated by ADMIN (lastManuallyUpdatedAt set).
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const importedAt = new Date().toISOString();

for (const s of terrainSummaries) {
  const existing = await prisma.requisition.findFirst({
    where: { reference: s.reference, deletedAt: null },
  });
  if (!existing) {
    console.warn(`missing ${s.reference}`);
    continue;
  }
  if (existing.lastManuallyUpdatedAt) {
    console.log(`skip ${s.reference}: manually updated`);
    continue;
  }

  const updated = await prisma.requisition.update({
    where: { id: existing.id },
    data: {
      currentSituation: s.currentSituation,
      constraintsJson: s.pointsToClarify,
      pointsToClarifyJson: s.pointsToClarify,
      criticalDetails: s.pointsToClarify,
      resolutionStepsJson: s.resolutionSteps,
      latestKnownEvent: s.latestKnownEvent,
      latestKnownEventAt: s.latestKnownEventAt
        ? new Date(`${s.latestKnownEventAt}T12:00:00Z`)
        : null,
      eventResult: s.eventResult,
      latestJudicialEvent: s.latestJudicialEvent,
      latestJudicialEventAt: s.latestJudicialEventAt
        ? new Date(`${s.latestJudicialEventAt}T12:00:00Z`)
        : null,
      judicialResult: s.judicialResult,
      nextScheduledEventAt: s.nextScheduledEventAt
        ? new Date(`${s.nextScheduledEventAt}T12:00:00Z`)
        : null,
      importantDate: null,
      eventLabel: s.eventLabel,
      nextAction: s.nextAction,
      courtReached: s.courtReached,
      dataFreshness: s.dataFreshness,
      isPrincipal: s.isPrincipal,
      mainStatusLabel:
        s.reference === "R 148026/31"
          ? "Bornage bloqué"
          : s.reference === "R 20657/31"
            ? "Oppositions à clarifier"
            : s.courtReached === "Oui"
              ? "Au tribunal"
              : undefined,
      summarySourceMeta: {
        ...s.sourceMeta,
        importedAt,
      },
    },
  });
  console.log(`summary ${updated.reference}`);
}

console.log("done");
await prisma.$disconnect();
