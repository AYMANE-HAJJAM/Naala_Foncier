import { Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { NotificationsService } from "./notifications.service.js";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("alerts")
export class AlertsCompatibilityController {
  constructor(private readonly service: NotificationsService) {}
  @Get()
  @ApiOperation({ operationId: "getAlerts", description: "Alias de compatibilité frontend vers les notifications." })
  list(@CurrentUser() user: AuthUser) { return this.service.list(user.id); }
  @Patch(":id/read")
  @ApiOperation({ operationId: "markAlertRead", description: "Alias de compatibilité frontend." })
  read(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.service.read(id, user.id); }
}
