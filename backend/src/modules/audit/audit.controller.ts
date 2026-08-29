import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { AuditService } from "./audit.service.js";

@ApiTags("Audit")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get()
  @ApiOperation({ operationId: "getAuditLogs" })
  @RequirePermissions("audit.view")
  list(@Query("page") page = "1", @Query("pageSize") pageSize = "50") {
    return this.service.list(Number(page), Number(pageSize));
  }
}
