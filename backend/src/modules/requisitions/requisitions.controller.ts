import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { CreateRequisitionDto, RequisitionQueryDto, UpdateRequisitionDto } from "./dto/requisition.dto.js";
import { RequisitionsService } from "./requisitions.service.js";

class GrantRequisitionAccessDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}

@ApiTags("Requisitions")
@ApiBearerAuth()
@Controller("requisitions")
export class RequisitionsController {
  constructor(private readonly service: RequisitionsService) {}

  @Get()
  @ApiOperation({ operationId: "getRequisitions" })
  @RequirePermissions("requisition.view")
  list(@Query() query: RequisitionQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Post()
  @ApiOperation({ operationId: "createRequisition" })
  @RequirePermissions("requisition.create")
  create(@Body() dto: CreateRequisitionDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Get(":id")
  @ApiOperation({ operationId: "getRequisition" })
  @RequirePermissions("requisition.view")
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }

  @Patch(":id")
  @ApiOperation({ operationId: "updateRequisition" })
  @RequirePermissions("requisition.update")
  update(@Param("id") id: string, @Body() dto: UpdateRequisitionDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteRequisition" })
  @RequirePermissions("requisition.delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }

  @Get(":id/access")
  @ApiOperation({ operationId: "getRequisitionAccess" })
  @RequirePermissions("user.manage")
  listAccess(@Param("id") id: string) {
    return this.service.listAccess(id);
  }

  @Post(":id/access")
  @ApiOperation({ operationId: "grantRequisitionAccess" })
  @RequirePermissions("user.manage")
  grantAccess(@Param("id") id: string, @Body() dto: GrantRequisitionAccessDto, @CurrentUser() user: AuthUser) {
    return this.service.grantAccess(id, dto.userId, user.id);
  }

  @Delete(":id/access/:userId")
  @HttpCode(204)
  @ApiOperation({ operationId: "revokeRequisitionAccess" })
  @RequirePermissions("user.manage")
  revokeAccess(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: AuthUser) {
    return this.service.revokeAccess(id, userId, user.id);
  }
}
