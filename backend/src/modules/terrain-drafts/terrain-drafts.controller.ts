import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import {
  CompleteDraftUploadDto,
  ConfirmTerrainDraftDto,
  CreateDraftUploadSessionDto,
  RenameDraftCustomCategoryDto,
  UpdateTerrainDraftReviewDto,
} from "./dto/terrain-draft.dto.js";
import { TerrainDraftsService } from "./terrain-drafts.service.js";

@ApiTags("TerrainDrafts")
@ApiBearerAuth()
@Controller("terrain-drafts")
export class TerrainDraftsController {
  constructor(private readonly service: TerrainDraftsService) {}

  @Post()
  @ApiOperation({ operationId: "createTerrainDraft" })
  @RequirePermissions("requisition.create")
  create(@CurrentUser() user: AuthUser) {
    return this.service.create(user);
  }

  @Get(":id")
  @ApiOperation({ operationId: "getTerrainDraft" })
  @RequirePermissions("requisition.create")
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }

  @Post(":id/upload-sessions")
  @ApiOperation({ operationId: "createTerrainDraftUploadSession" })
  @RequirePermissions("requisition.create")
  uploadSession(
    @Param("id") id: string,
    @Body() dto: CreateDraftUploadSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createUploadSession(id, dto, user);
  }

  @Post(":id/documents")
  @ApiOperation({ operationId: "completeTerrainDraftUpload" })
  @RequirePermissions("requisition.create")
  completeUpload(
    @Param("id") id: string,
    @Body() dto: CompleteDraftUploadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.completeUpload(id, dto, user);
  }

  @Delete(":id/documents/:documentId")
  @ApiOperation({ operationId: "removeTerrainDraftDocument" })
  @RequirePermissions("requisition.create")
  removeDocument(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeDocument(id, documentId, user);
  }

  @Patch(":id/custom-category")
  @ApiOperation({ operationId: "renameTerrainDraftCustomCategory" })
  @RequirePermissions("requisition.create")
  renameCustomCategory(
    @Param("id") id: string,
    @Body() dto: RenameDraftCustomCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.renameCustomCategory(id, dto, user);
  }

  @Post(":id/analyze")
  @ApiOperation({ operationId: "analyzeTerrainDraft" })
  @RequirePermissions("requisition.create")
  analyze(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body?: { force?: boolean },
  ) {
    return this.service.analyze(id, user, Boolean(body?.force));
  }

  @Get(":id/analysis")
  @ApiOperation({ operationId: "getTerrainDraftAnalysis" })
  @RequirePermissions("requisition.create")
  getAnalysis(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.getAnalysis(id, user);
  }

  @Post(":id/skip-analysis")
  @ApiOperation({ operationId: "skipTerrainDraftAnalysis" })
  @RequirePermissions("requisition.create")
  skipAnalysis(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.skipAnalysis(id, user);
  }

  @Patch(":id/review")
  @ApiOperation({ operationId: "updateTerrainDraftReview" })
  @RequirePermissions("requisition.create")
  review(
    @Param("id") id: string,
    @Body() dto: UpdateTerrainDraftReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateReview(id, dto, user);
  }

  @Post(":id/confirm")
  @ApiOperation({ operationId: "confirmTerrainDraft" })
  @RequirePermissions("requisition.create")
  confirm(
    @Param("id") id: string,
    @Body() dto: ConfirmTerrainDraftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.confirm(id, dto, user);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @ApiOperation({ operationId: "cancelTerrainDraft" })
  @RequirePermissions("requisition.create")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.cancel(id, user);
  }
}
