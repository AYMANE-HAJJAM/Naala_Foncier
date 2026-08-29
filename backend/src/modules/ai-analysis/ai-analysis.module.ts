import { Module, forwardRef } from "@nestjs/common";
import { StorageModule } from "../../shared/storage/storage.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { EventsModule } from "../events/events.module.js";
import { GitHubModelsDocumentAnalysisProvider } from "./github-models-document-analysis.provider.js";
import { GitHubModelsTerrainUpdateAnalysisProvider } from "./github-models-terrain-update.provider.js";
import {
  ConfigurableDocumentAnalysisProvider,
  UnconfiguredDocumentAnalysisProvider,
} from "./providers.js";
import { TerrainDraftAnalysisService } from "./terrain-draft-analysis.service.js";
import { TerrainOfficialContextBuilder } from "./terrain-official-context.builder.js";
import { TerrainUpdateAnalysisService } from "./terrain-update-analysis.service.js";
import { TerrainUpdateProposalService } from "./terrain-update-proposal.service.js";
import { TerrainUpdateProposalsController } from "./terrain-update-proposals.controller.js";
import {
  ConfigurableTerrainUpdateAnalysisProvider,
  UnconfiguredTerrainUpdateAnalysisProvider,
} from "./terrain-update-providers.js";

@Module({
  imports: [StorageModule, EventsModule, forwardRef(() => NotificationsModule)],
  controllers: [
    TerrainUpdateProposalsController,
  ],
  providers: [
    UnconfiguredDocumentAnalysisProvider,
    GitHubModelsDocumentAnalysisProvider,
    ConfigurableDocumentAnalysisProvider,
    TerrainDraftAnalysisService,
    GitHubModelsTerrainUpdateAnalysisProvider,
    UnconfiguredTerrainUpdateAnalysisProvider,
    ConfigurableTerrainUpdateAnalysisProvider,
    TerrainOfficialContextBuilder,
    TerrainUpdateAnalysisService,
    TerrainUpdateProposalService,
  ],
  exports: [
    UnconfiguredDocumentAnalysisProvider,
    ConfigurableDocumentAnalysisProvider,
    TerrainDraftAnalysisService,
    GitHubModelsDocumentAnalysisProvider,
    TerrainUpdateAnalysisService,
  ],
})
export class AIAnalysisModule {}
