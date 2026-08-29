import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessScopeService } from "../../shared/access/access-scope.service.js";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { AuditService } from "./audit.service.js";

@ApiTags("Audit")
@ApiBearerAuth()
@Controller("requisitions/:id/activity")
export class RequisitionActivityController {
  constructor(
    private readonly service: AuditService,
    private readonly access: AccessScopeService,
  ) {}

  @Get()
  @ApiOperation({ operationId: "getRequisitionActivity" })
  @RequirePermissions("requisition.view")
  async list(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanAccessRequisition(user, id);
    return this.service.forRequisition(id, this.access.isAdmin(user));
  }
}
