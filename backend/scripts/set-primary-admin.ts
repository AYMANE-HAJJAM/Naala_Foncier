import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient, Prisma } from "../src/generated/prisma/client.js";

const url = process.env.DATABASE_URL;
const email = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.PRIMARY_ADMIN_PASSWORD;
const dryRun = process.argv.includes("--dry-run");
if (!url || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("DATABASE_URL et PRIMARY_ADMIN_EMAIL valide requis.");
}
const database = decodeURIComponent(new URL(url).pathname.slice(1));
if (/qa|test/i.test(database) || process.env.QA_DATABASE || new URL(url).searchParams.has("schema")) {
  throw new Error("Opération refusée sur une base QA/test ou un schéma personnalisé.");
}
if (!dryRun && (!password || password.length < 10 || Buffer.byteLength(password, "utf8") > 72)) {
  throw new Error("PRIMARY_ADMIN_PASSWORD requis: 10 caractères minimum, 72 octets maximum.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  // Serializable, with locks preventing concurrent login/role/assignment writes during cleanup.
  const passwordHash = dryRun ? undefined : await hash(password!, 12);
  const result = await prisma.$transaction(async (tx) => {
    if (!dryRun) await tx.$executeRaw`LOCK TABLE "User", "UserRole", "RefreshToken", "UserRequisitionAccess" IN SHARE ROW EXCLUSIVE MODE`;
    const before = await tx.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true, email: true, firstName: true, lastName: true, isActive: true,
        roles: { select: { role: { select: { key: true } } } },
        _count: { select: {
          requisitionAccess: true, responsibleRequisitions: true, createdRequisitions: true,
          updatedRequisitions: true, createdDocuments: true, validatedDocuments: true,
          uploadedVersions: true, assignedDocumentRequests: true, responsibleOppositions: true,
          legalCases: true, responsibleHearings: true, createdHearings: true, createdActions: true,
          responsibleActions: true, actionComments: true, notifications: true, notificationReminders: true,
          createdReports: true, validatedReports: true, publishedReports: true, requestedAnalyses: true,
          validatedFacts: true, auditLogs: true, uploadSessions: true, grantedRequisitionAccess: true,
          createdTerrainEvents: true, validatedTerrainEvents: true, createdTerrainDrafts: true,
          reviewedAIExtractions: true, createdAIExtractions: true,
        } },
      },
    });
    console.log(JSON.stringify({ auditBefore: before }, null, 2));
    if (dryRun) return { dryRun: true, totalUsers: before.length };
    const existing = before.find((user) => user.email === email);
    const role = await tx.role.findUnique({ where: { key: "ADMIN" } });
    if (!role) throw new Error("Exécuter le seed des rôles et permissions avant admin:setup.");
    const admin = await tx.user.upsert({
      where: { email },
      update: { passwordHash: passwordHash!, isActive: true, deletedAt: null },
      create: { email, firstName: "Administrateur", lastName: "Principal", passwordHash: passwordHash! },
      select: { id: true },
    });
    const others = before.filter((user) => user.id !== admin.id);
    await tx.user.updateMany({ where: { id: { in: others.map((user) => user.id) } }, data: { isActive: false } });
    const sessions = await tx.refreshToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
    const assignments = await tx.userRequisitionAccess.deleteMany({});
    await tx.userRole.deleteMany({});
    await tx.userRole.create({ data: { userId: admin.id, roleId: role.id } });
    // Inspect actual database FKs too: an unmodeled CASCADE must never delete business history.
    const foreignKeys = await tx.$queryRaw<Array<{ schemaName: string; tableName: string; columnName: string }>>`
      SELECT ns.nspname AS "schemaName", relation.relname AS "tableName", attribute.attname AS "columnName"
      FROM pg_constraint constraint_row
      JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace ns ON ns.oid = relation.relnamespace
      JOIN pg_attribute attribute ON attribute.attrelid = relation.oid AND attribute.attnum = ANY(constraint_row.conkey)
      WHERE constraint_row.contype = 'f' AND constraint_row.confrelid = 'public."User"'::regclass
    `;
    const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const removable: typeof others = [];
    for (const user of others.filter((record) => Object.values(record._count).every((count) => count === 0))) {
      let referenced = false;
      for (const key of foreignKeys) {
        if (key.schemaName === "public" && ["UserRole", "RefreshToken", "UserRequisitionAccess"].includes(key.tableName)) continue;
        // Identifiers come from pg_catalog and are quoted; the user id remains a bound parameter.
        const rows = await tx.$queryRawUnsafe<Array<{ present: boolean }>>(
          `SELECT EXISTS(SELECT 1 FROM ${quoteIdentifier(key.schemaName)}.${quoteIdentifier(key.tableName)} WHERE ${quoteIdentifier(key.columnName)} = $1::uuid) AS present`, user.id,
        );
        if (rows[0]?.present) { referenced = true; break; }
      }
      if (!referenced) removable.push(user);
    }
    const deleted = await tx.user.deleteMany({ where: { id: { in: removable.map((user) => user.id) } } });
    const summary = {
      totalUsers: await tx.user.count(), activeUsers: await tx.user.count({ where: { isActive: true, deletedAt: null } }),
      activeAdmins: await tx.user.count({ where: { isActive: true, deletedAt: null, roles: { some: { role: { key: "ADMIN" } } } } }),
      inactivePreserved: others.length - deleted.count, newlyDeactivated: others.filter((user) => user.isActive).length,
      deleted: deleted.count, assignmentsRemoved: assignments.count, sessionsRevoked: sessions.count,
      principalIdPreserved: existing ? existing.id === admin.id : null,
    };
    if (summary.activeUsers !== 1 || summary.activeAdmins !== 1) throw new Error("Invariant administrateur unique non satisfait.");
    await tx.auditLog.create({ data: {
      actorUserId: admin.id, action: "PRIMARY_ADMIN_SETUP", entityType: "User", entityId: admin.id,
      metadata: summary,
    } });
    return summary;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000, maxWait: 15000 });
  console.log(JSON.stringify({ summary: result }, null, 2));
} catch {
  console.error("Configuration admin échouée; transaction annulée. Vérifier configuration et accès DB sans publier les secrets.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
