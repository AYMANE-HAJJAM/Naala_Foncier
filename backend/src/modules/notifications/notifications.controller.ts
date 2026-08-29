import { Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { NotificationsService } from "./notifications.service.js";
@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly s: NotificationsService) {}
  @Get() @ApiOperation({ operationId: "getNotifications" }) list(
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.list(u.id);
  }
  @Patch(":id/read")
  @ApiOperation({ operationId: "markNotificationRead" })
  read(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.read(id, u.id);
  }
  @Patch("read-all")
  @ApiOperation({ operationId: "markAllNotificationsRead" })
  all(@CurrentUser() u: AuthUser) {
    return this.s.readAll(u.id);
  }
}
