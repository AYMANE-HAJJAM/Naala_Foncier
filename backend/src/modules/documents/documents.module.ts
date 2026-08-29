import { Module, forwardRef } from "@nestjs/common";
import { AIAnalysisModule } from "../ai-analysis/ai-analysis.module.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({
  imports: [forwardRef(() => AIAnalysisModule)],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
