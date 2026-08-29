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
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  OppositionIdentityStatus,
  OppositionStrategy,
  OppositionType,
  RiskLevel,
} from "../../generated/prisma/enums.js";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { OppositionsService } from "./oppositions.service.js";
export class CreateOppositionDto {
  @ApiProperty() @IsUUID() requisitionId!: string;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  oppositionNumber?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() opponentName?: string;
  @ApiPropertyOptional({ enum: OppositionIdentityStatus })
  @IsEnum(OppositionIdentityStatus)
  @IsOptional()
  identityStatus?: OppositionIdentityStatus;
  @ApiProperty({ enum: OppositionType })
  @IsEnum(OppositionType)
  type!: OppositionType;
  @ApiPropertyOptional() @IsString() @IsOptional() scope?: string;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  claimedSurfaceHectares?: number;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  claimedSurfaceAres?: number;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  claimedSurfaceCentiares?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() legalBasis?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() ancfccStatus?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() courtStatus?: string;
  @ApiPropertyOptional({ enum: RiskLevel }) @IsEnum(RiskLevel) @IsOptional() riskLevel?: RiskLevel;
  @ApiPropertyOptional({ enum: OppositionStrategy })
  @IsEnum(OppositionStrategy)
  @IsOptional()
  strategy?: OppositionStrategy;
  @ApiPropertyOptional() @IsUUID() @IsOptional() responsibleUserId?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() referenceDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() impact?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() sourceDocumentId?: string;
}
export class UpdateOppositionDto extends PartialType(CreateOppositionDto) {}
@ApiTags("Oppositions")
@ApiBearerAuth()
@Controller()
export class OppositionsController {
  constructor(private readonly service: OppositionsService) {}
  @Get("oppositions")
  @ApiOperation({ operationId: "getOppositions" })
  @RequirePermissions("opposition.view")
  list(@CurrentUser() u: AuthUser) {
    return this.service.list(u);
  }
  @Post("oppositions")
  @ApiOperation({ operationId: "createOpposition" })
  @RequirePermissions("opposition.manage")
  create(@Body() dto: CreateOppositionDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }
  @Get("oppositions/:id")
  @ApiOperation({ operationId: "getOpposition" })
  @RequirePermissions("opposition.view")
  get(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.service.get(id, u);
  }
  @Patch("oppositions/:id")
  @ApiOperation({ operationId: "updateOpposition" })
  @RequirePermissions("opposition.manage")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateOppositionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.service.update(id, dto, u);
  }
  @Delete("oppositions/:id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteOpposition" })
  @RequirePermissions("opposition.manage")
  remove(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
  @Get("requisitions/:id/oppositions")
  @ApiOperation({ operationId: "getRequisitionOppositions" })
  @RequirePermissions("opposition.view")
  forReq(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.service.list(u, id);
  }
}
