import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  PRINCIPAL_REFERENCES,
  terrainSummaries,
} from "../src/modules/requisitions/terrain-summaries.js";

/**
 * Apply factual presentation summaries + assign demo USER to all 6 principals.
 * Skips dossiers already manually updated by ADMIN (lastManuallyUpdatedAt set).
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const admin = await prisma.user.findFirst({
  where: { email: "admin@naala-foncier.ma" },
});
const demoUser = await prisma.user.findFirst({
  where: { email: "user@naala-foncier.ma" },
});
if (!admin || !demoUser) {
  throw new Error("Comptes admin/user introuvables — lancer le seed d’abord.");
}

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

await prisma.userRequisitionAccess.deleteMany({
  where: { userId: demoUser.id },
});
for (const reference of PRINCIPAL_REFERENCES) {
  const req = await prisma.requisition.findFirst({
    where: { reference, deletedAt: null },
  });
  if (!req) {
    console.warn(`missing ${reference}`);
    continue;
  }
  await prisma.userRequisitionAccess.create({
    data: {
      userId: demoUser.id,
      requisitionId: req.id,
      createdById: admin.id,
    },
  });
  console.log(`assigned ${reference} → demo USER`);
}

console.log("done");
await prisma.$disconnect();
