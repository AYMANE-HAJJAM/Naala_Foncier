import "dotenv/config";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DatabaseModule } from "../src/shared/database/database.module.js";
import { PrismaService } from "../src/shared/database/prisma.service.js";
import { StatusSnapshotService } from "../src/modules/events/status-snapshot.service.js";

const references = ["R 20657/31", "R 20629/31", "R 20696/31", "R 20611/31", "R 20612/31", "R 148026/31", "R 16605/31"];
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule], providers: [StatusSnapshotService] })
class SnapshotMaintenanceModule {}

const app = await NestFactory.createApplicationContext(SnapshotMaintenanceModule, { logger: ["error"] });
try {
  const prisma = app.get(PrismaService);
  const snapshots = app.get(StatusSnapshotService);
  const terrains = await prisma.requisition.findMany({ where: { reference: { in: references }, deletedAt: null }, select: { id: true, reference: true } });
  for (const terrain of terrains) {
    await snapshots.refreshFromEvents(terrain.id);
    console.log(`snapshot refreshed: ${terrain.reference}`);
  }
} finally {
  await app.close();
}
