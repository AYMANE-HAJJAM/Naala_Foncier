import { Module } from "@nestjs/common";
import { AIAnalysisModule } from "../ai-analysis/ai-analysis.module.js";
import { EventsModule } from "../events/events.module.js";
import { TerrainDraftsController } from "./terrain-drafts.controller.js";
import { TerrainDraftsService } from "./terrain-drafts.service.js";

@Module({
  imports: [EventsModule, AIAnalysisModule],
  controllers: [TerrainDraftsController],
  providers: [TerrainDraftsService],
  exports: [TerrainDraftsService],
})
export class TerrainDraftsModule {}
