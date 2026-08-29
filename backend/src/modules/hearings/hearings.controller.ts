import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from "@nestjs/swagger";
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import {
  HearingEventType,
  HearingStatus,
} from "../../generated/prisma/enums.js";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { HearingsService } from "./hearings.service.js";
export class CreateHearingDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() legalCaseId?: string;
  @ApiProperty() @IsUUID() requisitionId!: string;
  @ApiProperty({ enum: HearingEventType })
  @IsEnum(HearingEventType)
  eventType!: HearingEventType;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() scheduledAt?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() completedAt?: string;
  @ApiProperty({ enum: HearingStatus })
  @IsEnum(HearingStatus)
  status!: HearingStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() result?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() minutesDocumentId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() responsibleUserId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
export class UpdateHearingDto extends PartialType(CreateHearingDto) {}
@ApiTags("Hearings")
@ApiBearerAuth()
@Controller()
export class HearingsController {
  constructor(private readonly s: HearingsService) {}
  @Get("hearings")
  @ApiOperation({ operationId: "getHearings" })
  @RequirePermissions("requisition.view")
  list(@CurrentUser() u: AuthUser) {
    return this.s.list(u);
  }
  @Get("agenda")
  @ApiOperation({ operationId: "getAgenda" })
  @RequirePermissions("requisition.view")
  agenda(@CurrentUser() u: AuthUser) {
    return this.s.list(u);
  }
  @Post("hearings")
  @ApiOperation({ operationId: "createHearing" })
  @RequirePermissions("hearing.manage")
  create(@Body() d: CreateHearingDto, @CurrentUser() u: AuthUser) {
    return this.s.create(d, u);
  }
  @Get("hearings/:id")
  @ApiOperation({ operationId: "getHearing" })
  @RequirePermissions("requisition.view")
  get(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.get(id, u);
  }
  @Patch("hearings/:id")
  @ApiOperation({ operationId: "updateHearing" })
  @RequirePermissions("hearing.manage")
  update(
    @Param("id") id: string,
    @Body() d: UpdateHearingDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.update(id, d, u);
  }
  @Delete("hearings/:id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteHearing" })
  @RequirePermissions("hearing.manage")
  remove(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.remove(id, u);
  }
  @Get("requisitions/:id/hearings")
  @ApiOperation({ operationId: "getRequisitionHearings" })
  @RequirePermissions("requisition.view")
  forReq(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.list(u, id);
  }
}
