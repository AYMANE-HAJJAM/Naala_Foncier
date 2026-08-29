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
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from "class-validator";
import { CourtStage } from "../../generated/prisma/enums.js";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { LegalCasesService } from "./legal-cases.service.js";
export class CreateLegalCaseDto {
  @ApiProperty() @IsUUID() requisitionId!: string;
  @ApiProperty() @IsString() caseNumber!: string;
  @ApiProperty() @IsString() courtName!: string;
  @ApiProperty() @IsString() caseType!: string;
  @ApiProperty() @IsString() currentPhase!: string;
  @ApiPropertyOptional({ enum: CourtStage }) @IsEnum(CourtStage) @IsOptional() currentStage?: CourtStage;
  @ApiPropertyOptional() @IsString() @IsOptional() currentStatus?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() lawyerUserId?: string;
  @ApiProperty() @IsString() opposingParties!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() outcomeStatus?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() latestEventAt?: string;
  @ApiPropertyOptional() @IsISO8601() @IsOptional() nextEventAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() linkedRequisitionId?: string;
}
export class UpdateLegalCaseDto extends PartialType(CreateLegalCaseDto) {}
@ApiTags("Legal cases")
@ApiBearerAuth()
@Controller()
export class LegalCasesController {
  constructor(private readonly s: LegalCasesService) {}
  @Get("legal-cases")
  @ApiOperation({ operationId: "getLegalCases" })
  @RequirePermissions("legalCase.view")
  list(@CurrentUser() u: AuthUser) {
    return this.s.list(u);
  }
  @Post("legal-cases")
  @ApiOperation({ operationId: "createLegalCase" })
  @RequirePermissions("legalCase.manage")
  create(@Body() d: CreateLegalCaseDto, @CurrentUser() u: AuthUser) {
    return this.s.create(d, u);
  }
  @Get("legal-cases/:id")
  @ApiOperation({ operationId: "getLegalCase" })
  @RequirePermissions("legalCase.view")
  get(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.get(id, u);
  }
  @Patch("legal-cases/:id")
  @ApiOperation({ operationId: "updateLegalCase" })
  @RequirePermissions("legalCase.manage")
  update(
    @Param("id") id: string,
    @Body() d: UpdateLegalCaseDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.update(id, d, u);
  }
  @Delete("legal-cases/:id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteLegalCase" })
  @RequirePermissions("legalCase.manage")
  remove(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.remove(id, u);
  }
  @Get("requisitions/:id/legal-cases")
  @ApiOperation({ operationId: "getRequisitionLegalCases" })
  @RequirePermissions("legalCase.view")
  forReq(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.list(u, id);
  }
}
