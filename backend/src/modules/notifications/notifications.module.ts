import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { AlertsCompatibilityController } from "./alerts-compatibility.controller.js";

@Module({
  controllers: [NotificationsController, AlertsCompatibilityController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
