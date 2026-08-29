import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { RequirePermissions } from "../../shared/permissions/permissions.decorator.js";
import { TerrainUpdateAnalysisService } from "./terrain-update-analysis.service.js";
import { TerrainUpdateProposalService } from "./terrain-update-proposal.service.js";

class ResolveConflictDto {
  resolution!: "KEEP_CURRENT" | "USE_PROPOSED" | "MANUAL_VALUE";
  manualValue?: string;
}

@ApiTags("AI Analysis")
@ApiBearerAuth()
@Controller()
export class TerrainUpdateProposalsController {
  constructor(
    private readonly analysis: TerrainUpdateAnalysisService,
    private readonly proposals: TerrainUpdateProposalService,
  ) {}

  @Post("requisitions/:requisitionId/documents/:documentId/analyze")
  @ApiOperation({ operationId: "analyzeRequisitionDocument" })
  @RequirePermissions("document.upload")
  retryAnalysis(
    @Param("requisitionId") requisitionId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.analysis.retryAnalysis(requisitionId, documentId, user);
  }

  @Get("requisitions/:requisitionId/documents/:documentId/analysis-status")
  @ApiOperation({ operationId: "getRequisitionDocumentAnalysisStatus" })
  @RequirePermissions("document.view")
  documentStatus(
    @Param("requisitionId") requisitionId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.analysis.getDocumentAnalysisStatus(requisitionId, documentId, user);
  }

  @Get("requisitions/:requisitionId/ai-proposals")
  @ApiOperation({ operationId: "getRequisitionAiProposals" })
  @RequirePermissions("requisition.view")
  listProposals(
    @Param("requisitionId") requisitionId: string,
    @Query("status") status: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposals.listForRequisition(
      requisitionId,
      user,
      status ?? "PROPOSED",
    );
  }

  @Get("requisitions/:requisitionId/ai-proposals/:proposalId")
  @ApiOperation({ operationId: "getRequisitionAiProposal" })
  @RequirePermissions("requisition.view")
  getProposal(
    @Param("requisitionId") requisitionId: string,
    @Param("proposalId") proposalId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposals.getProposal(requisitionId, proposalId, user);
  }

  @Post("requisitions/:requisitionId/ai-proposals/:proposalId/confirm")
  @ApiOperation({ operationId: "confirmRequisitionAiProposal" })
  @RequirePermissions("requisition.update")
  confirm(
    @Param("requisitionId") requisitionId: string,
    @Param("proposalId") proposalId: string,
    @Body() body: ResolveConflictDto | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposals.confirm(requisitionId, proposalId, user, body);
  }

  @Post("requisitions/:requisitionId/ai-proposals/:proposalId/reject")
  @ApiOperation({ operationId: "rejectRequisitionAiProposal" })
  @RequirePermissions("requisition.update")
  reject(
    @Param("requisitionId") requisitionId: string,
    @Param("proposalId") proposalId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposals.reject(requisitionId, proposalId, user);
  }

  @Post("requisitions/:requisitionId/ai-proposals/:proposalId/resolve-conflict")
  @ApiOperation({ operationId: "resolveRequisitionAiConflict" })
  @RequirePermissions("requisition.update")
  resolveConflict(
    @Param("requisitionId") requisitionId: string,
    @Param("proposalId") proposalId: string,
    @Body() body: ResolveConflictDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposals.confirm(requisitionId, proposalId, user, body);
  }

  @Get("admin/ai-proposals/pending-count")
  @ApiOperation({ operationId: "getPendingAiProposalsCount" })
  @RequirePermissions("requisition.view")
  pendingCount(@CurrentUser() user: AuthUser) {
    if (!user.roles.includes("ADMIN")) {
      return { count: 0 };
    }
    return this.proposals.countPendingForAdmin().then((count) => ({ count }));
  }
}
