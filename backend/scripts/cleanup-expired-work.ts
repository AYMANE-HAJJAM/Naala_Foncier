import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { CloudinaryStorageService } from "../src/shared/storage/cloudinary-storage.service.js";

const execute = process.argv.includes("--execute");
const daysArg = process.argv.find((arg) => arg.startsWith("--draft-days="));
const draftDays = Math.max(1, Number(daysArg?.split("=")[1] ?? 7));
const cutoff = new Date(Date.now() - draftDays * 24 * 60 * 60 * 1000);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const storage = new CloudinaryStorageService(new ConfigService(process.env));

async function removeAsset(key: string) {
  try {
    await storage.deleteObject(key);
    console.log(`asset deleted: ${key}`);
  } catch (error) {
    console.warn(`asset cleanup failed (continuing): ${key}`, error);
  }
}

try {
  const drafts = await prisma.terrainDraft.findMany({
    where: {
      status: { in: ["DRAFT", "ANALYZING", "READY_FOR_REVIEW"] },
      updatedAt: { lt: cutoff },
    },
    include: { documents: { select: { storageKey: true, cloudinaryPublicId: true } } },
  });
  const sessions = await prisma.uploadSession.findMany({
    where: { status: { in: ["CREATED", "UPLOADED"] }, expiresAt: { lt: new Date() } },
    select: { id: true, storageKey: true },
  });

  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", draftDays, cutoff, drafts: drafts.length, uploadSessions: sessions.length }));
  if (!execute) process.exitCode = 0;
  else {
    for (const draft of drafts) {
      for (const document of draft.documents) {
        await removeAsset(document.cloudinaryPublicId ?? document.storageKey);
      }
      await prisma.terrainDraft.delete({ where: { id: draft.id } });
      console.log(`draft deleted: ${draft.id}`);
    }
    for (const session of sessions) {
      await removeAsset(session.storageKey);
      await prisma.uploadSession.delete({ where: { id: session.id } });
      console.log(`upload session deleted: ${session.id}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
