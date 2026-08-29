import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import type { Response } from "express";
import type { Prisma } from "../../generated/prisma/client.js";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { ReportsService } from "./reports.service.js";

export class CreateReportDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  requisitionId?: string;

  @ApiProperty()
  @IsString()
  reportType!: string;

  @ApiProperty()
  @IsString()
  title!: string;
}

export class UpdateReportDto extends PartialType(CreateReportDto) {}

export class CreateReportVersionDto {
  @ApiProperty({ type: Object })
  @IsObject()
  contentJson!: Prisma.InputJsonObject;

  @ApiProperty()
  @IsString()
  generatedBy!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sourceCount!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

@ApiTags("Reports")
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly s: ReportsService) {}

  @Get("reports")
  @ApiOperation({ operationId: "getReports" })
  @RequirePermissions("report.view")
  list(@CurrentUser() u: AuthUser) {
    return this.s.list(u);
  }

  @Post("reports")
  @ApiOperation({ operationId: "createReport" })
  @RequirePermissions("report.manage")
  create(@Body() d: CreateReportDto, @CurrentUser() u: AuthUser) {
    return this.s.create(d, u);
  }

  @Get("reports/:id")
  @ApiOperation({ operationId: "getReport" })
  @RequirePermissions("report.view")
  get(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.get(id, u);
  }

  @Get("reports/:id/preview-url")
  @ApiOperation({ operationId: "getReportPreviewUrl" })
  @RequirePermissions("report.view")
  previewUrl(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.signedUrl(id, "inline", u);
  }

  @Get("reports/:id/download-url")
  @ApiOperation({ operationId: "getReportDownloadUrl" })
  @RequirePermissions("report.view")
  downloadUrl(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.signedUrl(id, "attachment", u);
  }

  @Get("reports/:id/content")
  @ApiOperation({
    operationId: "getReportContent",
    description: "Stream private report file bytes for in-app Word preview.",
  })
  @RequirePermissions("report.view")
  async content(
    @Param("id") id: string,
    @CurrentUser() u: AuthUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const file = await this.s.getContent(id, u);
    const safeName = file.originalFilename.replace(/"/g, "");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Length", String(file.buffer.length));
    res.send(file.buffer);
  }

  @Patch("reports/:id")
  @ApiOperation({ operationId: "updateReport" })
  @RequirePermissions("report.manage")
  update(@Param("id") id: string, @Body() d: UpdateReportDto, @CurrentUser() u: AuthUser) {
    return this.s.update(id, d, u);
  }

  @Get("requisitions/:id/reports")
  @ApiOperation({ operationId: "getRequisitionReports" })
  @RequirePermissions("report.view")
  forReq(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.list(u, id);
  }

  @Post("reports/:id/versions")
  @ApiOperation({ operationId: "createReportVersion" })
  @RequirePermissions("report.manage")
  version(
    @Param("id") id: string,
    @Body() d: CreateReportVersionDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.s.version(id, d, u);
  }

  @Post("reports/:id/submit-validation")
  @ApiOperation({ operationId: "submitReportValidation" })
  @RequirePermissions("report.manage")
  submit(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.submit(id, u);
  }

  @Post("reports/:id/validate")
  @ApiOperation({ operationId: "validateReport" })
  @RequirePermissions("report.validate")
  validate(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.decision(id, "VALIDE", u);
  }

  @Post("reports/:id/reject")
  @ApiOperation({ operationId: "rejectReport" })
  @RequirePermissions("report.validate")
  reject(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.decision(id, "REJETE", u);
  }

  @Post("reports/:id/publish")
  @ApiOperation({ operationId: "publishReport" })
  @RequirePermissions("report.validate")
  publish(@Param("id") id: string, @CurrentUser() u: AuthUser) {
    return this.s.publish(id, u);
  }
}
