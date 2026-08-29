import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { DashboardService } from "./dashboard.service.js";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @ApiOperation({ operationId: "getDashboard" })
  @RequirePermissions("requisition.view")
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user);
  }
}
