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
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  ActionCategory,
  ActionPriority,
  ActionStatus,
} from "../../generated/prisma/enums.js";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { ActionsService } from "./actions.service.js";
export class CreateActionDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() requisitionId?: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty({ enum: ActionCategory })
  @IsEnum(ActionCategory)
  category!: ActionCategory;
  @ApiProperty({ enum: ActionPriority })
  @IsEnum(ActionPriority)
  priority!: ActionPriority;
  @ApiPropertyOptional({ enum: ActionStatus })
  @IsEnum(ActionStatus)
  @IsOptional()
  status?: ActionStatus;
  @ApiPropertyOptional() @IsUUID() @IsOptional() responsibleUserId?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() dueDate?: string;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() blockage?: string;
}
export class UpdateActionDto extends PartialType(CreateActionDto) {}
class CommentDto {
  @ApiProperty() @IsString() content!: string;
}
@ApiTags("Actions")
@ApiBearerAuth()
@Controller()
export class ActionsController {
  constructor(private readonly s: ActionsService) {}
  @Get("actions")
  @ApiOperation({ operationId: "getActions" })
  @RequirePermissions("action.view")
  list(@CurrentUser() u: AuthUser) {
    return this.s.list(u);
  }
  @Post("actions")
  @ApiOperation({ operationId: "createAction" })
  @RequirePermissions("action.manage")
  create(@Body() d: CreateActionDto, @CurrentUser() u: AuthUser) {
    return this.s.create(d, u);
  }
  @Get("actions/:id")
  @ApiOperation({ operationId: "getAction" })
  @RequirePermissions("action.view")
  get(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.get(id, u);
  }
  @Patch("actions/:id")
  @ApiOperation({ operationId: "updateAction" })
  @RequirePermissions("action.manage")
  update(
    @Param("id") id: string,
    @Body() d: UpdateActionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.update(id, d, u);
  }
  @Delete("actions/:id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteAction" })
  @RequirePermissions("action.manage")
  remove(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.remove(id, u);
  }
  @Get("requisitions/:id/actions")
  @ApiOperation({ operationId: "getRequisitionActions" })
  @RequirePermissions("action.view")
  forReq(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.list(u, id);
  }
  @Post("requisitions/:id/actions")
  @ApiOperation({ operationId: "createRequisitionAction" })
  @RequirePermissions("action.manage")
  createForReq(
    @Param("id") id: string,
    @Body() d: CreateActionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.create({ ...d, requisitionId: id }, u);
  }
  @Post("actions/:id/comments")
  @ApiOperation({ operationId: "createActionComment" })
  @RequirePermissions("action.manage")
  comment(
    @Param("id") id: string,
    @Body() d: CommentDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.comment(id, d.content, u);
  }
  @Get("actions/:id/comments")
  @ApiOperation({ operationId: "getActionComments" })
  @RequirePermissions("action.view")
  comments(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.comments(id, u);
  }
}
