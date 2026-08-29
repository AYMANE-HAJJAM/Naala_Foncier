import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import {
  CompleteUploadSessionDto,
  CreateLegacyDocumentRequestDto,
  CreateUploadSessionDto,
  RequestClearerCopyDto,
  UpdateDocumentDto,
} from "./dto/document.dto.js";
import { DocumentsService } from "./documents.service.js";
@ApiTags("Documents")
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
  @Get("documents")
  @ApiOperation({ operationId: "getDocuments" })
  @RequirePermissions("document.view")
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }
  @Get("documents/:id")
  @ApiOperation({ operationId: "getDocument" })
  @RequirePermissions("document.view")
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }
  @Patch("documents/:id")
  @ApiOperation({ operationId: "updateDocument" })
  @RequirePermissions("document.update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user.id);
  }
  @Delete("documents/:id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteDocument" })
  @RequirePermissions("document.update")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }
  @Get("requisitions/:id/documents")
  @ApiOperation({ operationId: "getRequisitionDocuments" })
  @RequirePermissions("document.view")
  forRequisition(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.list(user, id);
  }
  @Post("requisitions/:id/documents")
  @ApiOperation({ operationId: "createRequisitionDocument", description: "Compatibilité: crée une demande documentaire. Les fichiers utilisent les sessions d'upload sécurisées." })
  @RequirePermissions("document.upload")
  createRequest(@Param("id") id: string, @Body() dto: CreateLegacyDocumentRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.createLegacyRequest(id, dto, user);
  }
  @Post("documents/upload-sessions")
  @ApiOperation({ operationId: "createDocumentUploadSession" })
  @RequirePermissions("document.upload")
  session(@Body() dto: CreateUploadSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.createUploadSession(dto, user);
  }
  @Post("documents/upload-sessions/:id/complete")
  @ApiOperation({ operationId: "completeDocumentUploadSession" })
  @RequirePermissions("document.upload")
  complete(
    @Param("id") id: string,
    @Body() dto: CompleteUploadSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.completeUploadSession(id, dto, user);
  }
  @Post("documents/:id/versions")
  @ApiOperation({ operationId: "createDocumentVersion" })
  @RequirePermissions("document.upload")
  version(
    @Param("id") id: string,
    @Body() dto: CreateUploadSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createUploadSession({ ...dto, documentId: id }, user);
  }
  @Get("documents/:id/versions")
  @ApiOperation({ operationId: "getDocumentVersions" })
  @RequirePermissions("document.view")
  versions(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.versions(id, user);
  }
  @Get("documents/:id/download-url")
  @ApiOperation({ operationId: "getDocumentDownloadUrl" })
  @RequirePermissions("document.view")
  download(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.signedUrl(id, "attachment", user);
  }
  @Get("documents/:id/preview-url")
  @ApiOperation({ operationId: "getDocumentPreviewUrl" })
  @RequirePermissions("document.view")
  preview(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.signedUrl(id, "inline", user);
  }
  @Get("documents/:id/content")
  @ApiOperation({
    operationId: "getDocumentContent",
    description: "Stream private file bytes for in-app preview (DOCX, etc.).",
  })
  @RequirePermissions("document.view")
  async content(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const file = await this.service.getContent(id, user);
    const safeName = file.originalFilename.replace(/"/g, "");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeName}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Length", String(file.buffer.length));
    res.send(file.buffer);
  }
  @Post("documents/:id/validate")
  @ApiOperation({ operationId: "validateDocument" })
  @RequirePermissions("document.validate")
  validate(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.service.validate(id, user);
  }
  @Post("documents/:id/request-clearer-copy")
  @ApiOperation({ operationId: "requestClearerDocumentCopy" })
  @RequirePermissions("document.update")
  clearer(
    @Param("id") id: string,
    @Body() dto: RequestClearerCopyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestClearerCopy(id, dto, user);
  }
}
