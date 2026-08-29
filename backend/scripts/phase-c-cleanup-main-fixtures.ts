import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { v2 as cloudinary } from "cloudinary";

function readEnv(path: string) {
  if (!existsSync(path)) throw new Error(`Fichier absent: ${path}`);
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

const useQa = process.argv.includes("--qa-database");
const qa = useQa ? readEnv(resolve(process.cwd(), "../.phase-c-qa.env")) : {};
const connectionString = qa.DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL absente.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const confirmed = process.argv.includes("--confirm-test-fixtures");

try {
  const [target] = await prisma.$queryRaw<Array<{ current_schema: string; current_database: string }>>`SELECT current_schema(), current_database()`;
  const expectedDatabase = useQa ? "naala_phase_c_qa" : "neondb";
  if (target?.current_schema !== "public" || target.current_database !== expectedDatabase) {
    throw new Error(`Nettoyage refusé hors cible ${expectedDatabase}/public.`);
  }
  const requisitions = await prisma.requisition.findMany({
    where: { reference: { startsWith: "TEST-QA-" } },
    select: { id: true, reference: true, _count: { select: { documents: true, terrainEvents: true, reports: true } } },
  });
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@naala.test" } },
    select: { id: true, email: true },
  });
  const reqIds = requisitions.map((item) => item.id);
  const userIds = users.map((item) => item.id);
  const draftCount = await prisma.terrainDraft.count({ where: { createdById: { in: userIds } } });
  console.log(JSON.stringify({ mode: confirmed ? "CONFIRM" : "DRY_RUN", database: expectedDatabase, requisitions, users: users.map((item) => item.email), draftCount, deleteUsers: !useQa }, null, 2));
  if (!confirmed) process.exit(0);
  if (!reqIds.length && !userIds.length) process.exit(0);

  await prisma.$transaction(async (tx) => {
    const documentIds = (await tx.document.findMany({ where: { requisitionId: { in: reqIds } }, select: { id: true } })).map((item) => item.id);
    const reportIds = (await tx.report.findMany({ where: { requisitionId: { in: reqIds } }, select: { id: true } })).map((item) => item.id);
    const hearingIds = (await tx.hearing.findMany({ where: { requisitionId: { in: reqIds } }, select: { id: true } })).map((item) => item.id);
    const actionIds = (await tx.actionItem.findMany({ where: { requisitionId: { in: reqIds } }, select: { id: true } })).map((item) => item.id);
    const analysisJobIds = (await tx.aIAnalysisJob.findMany({ where: { requisitionId: { in: reqIds } }, select: { id: true } })).map((item) => item.id);

    await tx.notificationReminder.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { requisitionId: { in: reqIds } }, { hearingId: { in: hearingIds } }] } });
    await tx.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { requisitionId: { in: reqIds } }] } });
    await tx.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await tx.actionComment.deleteMany({ where: { actionItemId: { in: actionIds } } });
    await tx.actionItem.deleteMany({ where: { id: { in: actionIds } } });
    await tx.aIAnalysisDocument.deleteMany({ where: { aiAnalysisJobId: { in: analysisJobIds } } });
    await tx.aIAnalysisJob.deleteMany({ where: { id: { in: analysisJobIds } } });
    await tx.aIExtraction.deleteMany({ where: { OR: [{ requisitionId: { in: reqIds } }, { documentId: { in: documentIds } }] } });
    await tx.aIAnalysisRun.deleteMany({ where: { OR: [{ requisitionId: { in: reqIds } }, { documentId: { in: documentIds } }] } });
    await tx.terrainEvent.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.requisitionStatusSnapshot.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.opposition.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.hearing.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.legalCase.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.documentRequest.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.uploadSession.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.report.updateMany({ where: { id: { in: reportIds } }, data: { currentVersionId: null } });
    await tx.report.deleteMany({ where: { id: { in: reportIds } } });
    await tx.document.updateMany({ where: { id: { in: documentIds } }, data: { currentVersionId: null } });
    await tx.document.deleteMany({ where: { id: { in: documentIds } } });
    await tx.userRequisitionAccess.deleteMany({ where: { requisitionId: { in: reqIds } } });
    await tx.requisitionRelation.deleteMany({ where: { OR: [{ sourceRequisitionId: { in: reqIds } }, { targetRequisitionId: { in: reqIds } }] } });
    await tx.terrainDraft.deleteMany({ where: { createdById: { in: userIds } } });
    await tx.requisition.deleteMany({ where: { id: { in: reqIds } } });
    await tx.requisition.updateMany({ where: { responsibleUserId: { in: userIds } }, data: { responsibleUserId: null } });
    if (!useQa) await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
  if (useQa && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    for (const resource_type of ["image", "raw"] as const) {
      for (const type of ["authenticated", "upload"] as const) {
        try {
          await cloudinary.api.delete_resources_by_prefix("naala-foncier/qa-phase-c", { resource_type, type, invalidate: true });
        } catch (error) {
          console.warn(`Cloudinary cleanup best-effort ${resource_type}/${type}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  console.log(`Fixtures QA supprimées de ${expectedDatabase}/public.`);
} finally {
  await prisma.$disconnect();
}
