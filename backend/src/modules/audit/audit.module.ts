import { Global, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller.js";
import { AuditService } from "./audit.service.js";
import { RequisitionActivityController } from "./requisition-activity.controller.js";
@Global()
@Module({
  controllers: [AuditController, RequisitionActivityController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
