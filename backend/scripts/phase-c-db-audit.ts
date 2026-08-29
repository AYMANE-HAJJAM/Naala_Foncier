import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

function readEnv(path: string) {
  if (!existsSync(path)) throw new Error(`Fichier absent: ${path}`);
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const useQa = process.argv.includes("--qa");
const qa = useQa ? readEnv(resolve(process.cwd(), "../.phase-c-qa.env")) : {};
const connectionString = qa.DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL absente.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const [database] = await prisma.$queryRaw<Array<{ current_schema: string; current_database: string }>>`SELECT current_schema(), current_database()`;
  const requisitions = await prisma.requisition.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      reference: true,
      isPrincipal: true,
      nextScheduledEventAt: true,
      _count: { select: { documents: true, legalCases: true, hearings: true, terrainEvents: true, oppositions: true, reports: true } },
    },
    orderBy: { reference: "asc" },
  });
  const now = new Date();
  const [orphanDocuments, orphanVersions, duplicateAssignments, duplicateNotifications, duplicateEvents, publishedWithoutContent, pastSnapshots, drafts] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "Document" d LEFT JOIN "Requisition" r ON r.id = d."requisitionId" WHERE r.id IS NULL`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "DocumentVersion" v LEFT JOIN "Document" d ON d.id = v."documentId" WHERE d.id IS NULL`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM (SELECT "userId", "requisitionId" FROM "UserRequisitionAccess" GROUP BY 1,2 HAVING COUNT(*) > 1) x`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM (SELECT "dedupeKey" FROM "Notification" WHERE "dedupeKey" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1) x`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM (SELECT "requisitionId", type, "scheduledAt", title FROM "TerrainEvent" WHERE "validationStatus" = 'CONFIRMED' GROUP BY 1,2,3,4 HAVING COUNT(*) > 1) x`,
    prisma.report.count({ where: { status: "PUBLIE", currentVersionId: null, documentId: null } }),
    prisma.requisitionStatusSnapshot.count({ where: { nextScheduledEventAt: { lt: now } } }),
    prisma.terrainDraft.findMany({
      where: { status: { in: ["DRAFT", "ANALYZING", "READY_FOR_REVIEW"] } },
      select: { id: true, createdAt: true, status: true, createdBy: { select: { email: true } }, _count: { select: { documents: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const count = (rows: Array<{ count: bigint }>) => Number(rows[0]?.count ?? 0n);
  const r20611 = requisitions.find((item) => item.reference === "R 20611/31");
  const hearings = r20611
    ? await prisma.hearing.findMany({
        where: { requisitionId: r20611.id },
        select: { id: true, eventType: true, title: true, scheduledAt: true, completedAt: true, nextDate: true, status: true, legalCase: { select: { caseNumber: true } }, minutesDocument: { select: { id: true, title: true } } },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      })
    : [];
  const oppositionsWithoutSource = await prisma.opposition.findMany({
    where: { deletedAt: null, sourceDocumentId: null },
    select: { id: true, oppositionNumber: true, opponentName: true, requisition: { select: { reference: true } } },
    orderBy: [{ requisitionId: "asc" }, { oppositionNumber: "asc" }],
  });
  console.log(JSON.stringify({
    target: useQa ? "QA" : "MAIN_READ_ONLY",
    database: database?.current_database,
    schema: database?.current_schema,
    requisitions: requisitions.map((item) => ({ reference: item.reference, isPrincipal: item.isPrincipal, nextScheduledEventAt: item.nextScheduledEventAt?.toISOString() ?? null, counts: item._count })),
    controls: {
      orphanDocuments: count(orphanDocuments),
      orphanVersions: count(orphanVersions),
      duplicateAssignments: count(duplicateAssignments),
      duplicateNotifications: count(duplicateNotifications),
      duplicateEvents: count(duplicateEvents),
      publishedWithoutContent,
      pastSnapshots,
    },
    r20611Hearings: hearings.map((item) => ({ ...item, scheduledAt: item.scheduledAt?.toISOString() ?? null, completedAt: item.completedAt?.toISOString() ?? null, nextDate: item.nextDate?.toISOString() ?? null })),
    oppositionsWithoutSource: oppositionsWithoutSource.map((item) => ({ id: item.id, terrain: item.requisition.reference, number: item.oppositionNumber, opponentName: item.opponentName, sourceDocumentId: null })),
    drafts: drafts.map((draft) => ({ id: draft.id, createdAt: draft.createdAt.toISOString(), owner: draft.createdBy.email, status: draft.status, documentCount: draft._count.documents })),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
