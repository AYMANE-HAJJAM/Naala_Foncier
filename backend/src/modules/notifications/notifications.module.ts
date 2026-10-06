import { Global, Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { AlertsCompatibilityController } from "./alerts-compatibility.controller.js";

@Global()
@Module({
  controllers: [NotificationsController, AlertsCompatibilityController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
