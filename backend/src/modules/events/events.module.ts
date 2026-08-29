import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { StatusSnapshotService } from "./status-snapshot.service.js";
import { TerrainEventsController } from "./terrain-events.controller.js";
import { TerrainEventsService } from "./terrain-events.service.js";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [TerrainEventsController],
  providers: [TerrainEventsService, StatusSnapshotService],
  exports: [TerrainEventsService, StatusSnapshotService],
})
export class EventsModule {}
