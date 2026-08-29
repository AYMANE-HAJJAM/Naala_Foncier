import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { CreateRoleDto, CreateUserDto, UpdateRoleDto, UpdateUserDto } from "./dto/user.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("Users") @ApiBearerAuth() @Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get("users") @ApiOperation({ operationId: "getUsers" }) @RequirePermissions("user.manage") list() { return this.service.list(); }
  @Post("users") @ApiOperation({ operationId: "createUser" }) @RequirePermissions("user.manage") create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) { return this.service.create(dto, user.id); }
  @Get("users/:id") @ApiOperation({ operationId: "getUser" }) @RequirePermissions("user.manage") get(@Param("id") id: string) { return this.service.get(id); }
  @Patch("users/:id") @ApiOperation({ operationId: "updateUser" }) @RequirePermissions("user.manage") update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) { return this.service.update(id, dto, user.id); }
  @Patch("users/:id/activate") @ApiOperation({ operationId: "activateUser" }) @RequirePermissions("user.manage") activate(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.service.setActive(id, true, user.id); }
  @Patch("users/:id/deactivate") @ApiOperation({ operationId: "deactivateUser" }) @RequirePermissions("user.manage") deactivate(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.service.setActive(id, false, user.id); }
  @Get("roles") @ApiOperation({ operationId: "getRoles" }) roles() { return this.service.roles(); }
  @Post("roles") @ApiOperation({ operationId: "createRole" }) @RequirePermissions("role.manage") createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthUser) { return this.service.createRole(dto, user.id); }
  @Patch("roles/:id") @ApiOperation({ operationId: "updateRole" }) @RequirePermissions("role.manage") updateRole(@Param("id") id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: AuthUser) { return this.service.updateRole(id, dto, user.id); }
  @Get("permissions") @ApiOperation({ operationId: "getPermissions" }) permissions() { return this.service.permissions(); }
}
