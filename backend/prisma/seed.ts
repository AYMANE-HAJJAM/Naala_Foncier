import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL est requis pour executer le seed.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const permissionKeys = [
  "user.manage", "role.manage", "requisition.view", "requisition.create", "requisition.update", "requisition.delete",
  "document.view", "document.upload", "document.update", "document.validate", "opposition.view", "opposition.manage",
  "legalCase.view", "legalCase.manage", "hearing.manage", "action.view", "action.manage", "report.view", "report.manage",
  "report.validate", "aiAnalysis.launch", "aiAnalysis.validate", "audit.view",
] as const;
const userPermissionKeys = new Set<string>([
  "requisition.view", "document.view", "document.upload", "opposition.view", "legalCase.view", "action.view", "report.view",
]);

try {
  await prisma.$transaction(async (tx) => {
    const permissions = [];
    for (const key of permissionKeys) {
      permissions.push(await tx.permission.upsert({ where: { key }, update: {}, create: { key, name: key } }));
    }
    for (const definition of [
      { key: "ADMIN", name: "Gérant / Administrateur", description: "Accès complet à la plateforme" },
      { key: "USER", name: "Utilisateur", description: "Consultation des dossiers assignés uniquement" },
    ]) {
      const role = await tx.role.upsert({ where: { key: definition.key }, update: definition, create: definition });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({ data: permissions
        .filter((permission) => definition.key === "ADMIN" || userPermissionKeys.has(permission.key))
        .map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    }
  }, { timeout: 60000 });
  console.log("Seed terminé: rôles et permissions uniquement; aucun utilisateur créé ou modifié.");
} catch {
  console.error("Échec du seed; transaction annulée.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
