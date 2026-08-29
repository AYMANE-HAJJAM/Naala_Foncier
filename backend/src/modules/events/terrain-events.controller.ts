import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsISO8601, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { CreateTerrainEventDto, RescheduleTerrainEventDto, UpdateTerrainEventDto } from "./dto/terrain-event.dto.js";
import { TerrainEventsService } from "./terrain-events.service.js";

class CalendarQueryDto {
  @ApiPropertyOptional() @IsISO8601() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() to?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() days?: string;
}

@ApiTags("TerrainEvents")
@ApiBearerAuth()
@Controller()
export class TerrainEventsController {
  constructor(private readonly service: TerrainEventsService) {}

  @Get("requisitions/:id/events")
  @ApiOperation({ operationId: "getRequisitionEvents" })
  @RequirePermissions("requisition.view")
  listForReq(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.listForRequisition(id, user);
  }

  @Get("calendar/events")
  @ApiOperation({ operationId: "getCalendarEvents" })
  @RequirePermissions("requisition.view")
  calendar(@Query() q: CalendarQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listCalendar(user, q.from, q.to);
  }

  @Get("calendar/upcoming")
  @ApiOperation({ operationId: "getUpcomingCalendarEvents" })
  @RequirePermissions("requisition.view")
  upcoming(@Query() q: CalendarQueryDto, @CurrentUser() user: AuthUser) {
    const days = q.days ? Number(q.days) : 30;
    return this.service.upcoming(user, Number.isFinite(days) ? days : 30);
  }

  @Post("terrain-events")
  @ApiOperation({ operationId: "createTerrainEvent" })
  @RequirePermissions("requisition.update")
  create(@Body() dto: CreateTerrainEventDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch("terrain-events/:id")
  @ApiOperation({ operationId: "updateTerrainEvent" })
  @RequirePermissions("requisition.update")
  update(@Param("id") id: string, @Body() dto: UpdateTerrainEventDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post("terrain-events/:id/reschedule")
  @ApiOperation({ operationId: "rescheduleTerrainEvent" })
  @RequirePermissions("requisition.update")
  reschedule(@Param("id") id: string, @Body() dto: RescheduleTerrainEventDto, @CurrentUser() user: AuthUser) {
    return this.service.reschedule(id, dto, user);
  }

  @Delete("terrain-events/:id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteTerrainEvent" })
  @RequirePermissions("requisition.update")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
