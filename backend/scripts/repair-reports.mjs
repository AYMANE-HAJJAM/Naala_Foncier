import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

/**
 * Soft-delete placeholder seed reports and unlinked portfolio stubs.
 * Keeps the real imported strategic DOCX portfolio report.
 * Marks its RAPPORTS Document as PARTAGE for USER access consistency.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const now = new Date();

const seedish = await prisma.report.findMany({
  where: {
    deletedAt: null,
    OR: [
      {
        currentVersion: { generatedBy: "Seed de développement" },
      },
      {
        documentId: null,
        title: { contains: "upload en attente" },
      },
      {
        documentId: null,
        scope: "REQUISITION",
        title: { startsWith: "Rapport stratégique —" },
      },
    ],
  },
  include: { currentVersion: true },
});

let removed = 0;
for (const r of seedish) {
  await prisma.report.update({
    where: { id: r.id },
    data: { deletedAt: now },
  });
  removed += 1;
  console.log(`SOFT-DELETE ${r.scope} ${r.id} — ${r.title}`);
}

const portfolio = await prisma.report.findFirst({
  where: {
    deletedAt: null,
    scope: "PORTFOLIO",
    documentId: { not: null },
    title: { contains: "Rapport stratégique portefeuille" },
  },
  include: { document: true },
});

if (portfolio?.documentId) {
  await prisma.document.update({
    where: { id: portfolio.documentId },
    data: { visibility: "PARTAGE" },
  });
  if (!portfolio.reportDate) {
    await prisma.report.update({
      where: { id: portfolio.id },
      data: { reportDate: portfolio.createdAt },
    });
  }
  console.log(
    `KEEP portfolio report ${portfolio.id} → document ${portfolio.documentId} (PARTAGE)`,
  );
} else {
  console.log("WARNING: no portfolio report with documentId found");
}

console.log(`Done. soft-deleted=${removed}`);
await prisma.$disconnect();
