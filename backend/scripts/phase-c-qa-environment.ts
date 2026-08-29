import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hash } from "bcryptjs";
import { Pool } from "pg";

const QA_DATABASE = "naala_phase_c_qa";
const ROOT = resolve(process.cwd(), "..");
const QA_ENV_PATH = resolve(ROOT, ".phase-c-qa.env");

function qaUrl(raw: string) {
  const url = new URL(raw);
  url.pathname = `/${QA_DATABASE}`;
  url.searchParams.delete("schema");
  url.searchParams.delete("options");
  return url.toString();
}

function parseEnvFile(path: string) {
  if (!existsSync(path)) return new Map<string, string>();
  return new Map(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function randomPassword() {
  return `Qa-${randomBytes(18).toString("base64url")}!7a`;
}

function writeQaEnv(_databaseUrl: string, directUrl: string) {
  const previous = parseEnvFile(QA_ENV_PATH);
  const values = {
    // PrismaPg qualifies generated tables in `public`; isolation therefore needs a database,
    // not only a PostgreSQL search_path/schema.
    DATABASE_URL: qaUrl(directUrl),
    DIRECT_URL: qaUrl(directUrl),
    QA_DATABASE,
    QA_SCHEMA: "public",
    QA_ADMIN_EMAIL: "admin.qa@naala.test",
    QA_ADMIN_PASSWORD: previous.get("QA_ADMIN_PASSWORD") ?? randomPassword(),
    QA_ASSIGNED_EMAIL: "assigned.qa@naala.test",
    QA_ASSIGNED_PASSWORD: previous.get("QA_ASSIGNED_PASSWORD") ?? randomPassword(),
    QA_UNASSIGNED_EMAIL: "unassigned.qa@naala.test",
    QA_UNASSIGNED_PASSWORD: previous.get("QA_UNASSIGNED_PASSWORD") ?? randomPassword(),
    QA_REQUISITION_REFERENCE: "TEST-QA-001",
  };
  writeFileSync(
    QA_ENV_PATH,
    `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return values;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} a échoué.`);
}

async function seedQa(values: Record<string, string>) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: values.DATABASE_URL }),
  });
  try {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    const userRole = await prisma.role.findUniqueOrThrow({ where: { key: "USER" } });
    const accounts = [
      { email: values.QA_ADMIN_EMAIL, password: values.QA_ADMIN_PASSWORD, firstName: "ADMIN", lastName: "QA", roleId: adminRole.id },
      { email: values.QA_ASSIGNED_EMAIL, password: values.QA_ASSIGNED_PASSWORD, firstName: "USER", lastName: "ASSIGNED QA", roleId: userRole.id },
      { email: values.QA_UNASSIGNED_EMAIL, password: values.QA_UNASSIGNED_PASSWORD, firstName: "USER", lastName: "UNASSIGNED QA", roleId: userRole.id },
    ];
    const users = new Map<string, string>();
    for (const account of accounts) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: { firstName: account.firstName, lastName: account.lastName, passwordHash: await hash(account.password, 12), isActive: true, deletedAt: null },
        create: { email: account.email, firstName: account.firstName, lastName: account.lastName, passwordHash: await hash(account.password, 12) },
      });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: account.roleId } });
      users.set(account.email, user.id);
    }
    const adminId = users.get(values.QA_ADMIN_EMAIL)!;
    const assignedId = users.get(values.QA_ASSIGNED_EMAIL)!;
    const terrain = await prisma.requisition.upsert({
      where: { reference: values.QA_REQUISITION_REFERENCE },
      update: { deletedAt: null, lastUpdatedById: adminId },
      create: {
        reference: values.QA_REQUISITION_REFERENCE,
        propertyName: "Terrain de recette Phase C",
        location: "Sidi Ifni",
        province: "Sidi Ifni",
        surfaceHectares: 1,
        surfaceAres: 25,
        surfaceCentiares: 0,
        sellerName: "Non renseigné",
        buyerName: "Non renseigné",
        riskLevel: "A_CONFIRMER",
        mainStatus: "EN_COURS",
        mainStatusLabel: "Recette en cours",
        mainIssue: "Terrain exclusivement réservé à la recette Phase C.",
        isPrincipal: true,
        createdById: adminId,
        lastUpdatedById: adminId,
      },
    });
    await prisma.userRequisitionAccess.upsert({
      where: { userId_requisitionId: { userId: assignedId, requisitionId: terrain.id } },
      update: {},
      create: { userId: assignedId, requisitionId: terrain.id, createdById: adminId },
    });
    await prisma.requisitionStatusSnapshot.upsert({
      where: { requisitionId: terrain.id },
      update: { currentStage: "EN_COURS", currentLabel: "Recette en cours", lastVerifiedAt: new Date(), nextScheduledEventAt: null },
      create: { requisitionId: terrain.id, currentStage: "EN_COURS", currentLabel: "Recette en cours", judicialState: "Aucune affaire", lastVerifiedAt: new Date() },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function setup() {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL ?? databaseUrl;
  if (!databaseUrl || !directUrl) throw new Error("DATABASE_URL/DIRECT_URL manquante.");
  const pool = new Pool({ connectionString: directUrl });
  try {
    const existing = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [QA_DATABASE],
    );
    if (!existing.rows[0]?.exists) await pool.query(`CREATE DATABASE "${QA_DATABASE}"`);
  } finally {
    await pool.end();
  }
  const values = writeQaEnv(databaseUrl, directUrl);
  const env = { ...process.env, ...values, INITIAL_ADMIN_PASSWORD: values.QA_ADMIN_PASSWORD };
  run("npx.cmd", ["prisma", "migrate", "deploy"], env);
  run("npx.cmd", ["tsx", "prisma/seed.ts"], env);
  await seedQa(values);
  console.log(`Environnement QA prêt dans la base ${QA_DATABASE}.`);
  console.log("Secrets conservés localement dans .phase-c-qa.env (non affichés).");
}

async function cleanup() {
  const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!directUrl) throw new Error("DIRECT_URL/DATABASE_URL manquante.");
  if (process.argv[3] !== "--confirm-database=naala_phase_c_qa") {
    throw new Error("Nettoyage refusé: confirmation exacte de la base QA requise.");
  }
  const pool = new Pool({ connectionString: directUrl });
  try {
    await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [QA_DATABASE]);
    await pool.query(`DROP DATABASE IF EXISTS "${QA_DATABASE}"`);
    // Remove the obsolete schema-based QA attempt, never any business schema.
    await pool.query(`DROP SCHEMA IF EXISTS "naala_phase_c_qa" CASCADE`);
  } finally {
    await pool.end();
  }
  console.log(`Base QA ${QA_DATABASE} et ancien schéma QA supprimés.`);
}

function diff() {
  const values = Object.fromEntries(parseEnvFile(QA_ENV_PATH));
  if (!values.DATABASE_URL || values.QA_DATABASE !== QA_DATABASE) {
    throw new Error("Environnement de base QA dédiée absent.");
  }
  const directory = resolve(
    process.cwd(),
    "prisma/migrations/20260826160000_phase_c_replay_alignment",
  );
  mkdirSync(directory, { recursive: true });
  run(
    "npx.cmd",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema=prisma/schema.prisma",
      "--script",
      "--output=prisma/migrations/20260826160000_phase_c_replay_alignment/migration.sql",
    ],
    { ...process.env, ...values },
  );
  console.log("Migration d'alignement générée depuis la base QA isolée.");
}

const command = process.argv[2] ?? "setup";
if (command === "setup") await setup();
else if (command === "cleanup") await cleanup();
else if (command === "diff") diff();
else throw new Error(`Commande inconnue: ${command}`);
