import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentAnalysisNotConfiguredError } from "./document-analysis.provider.js";
import { GitHubModelsTerrainUpdateAnalysisProvider } from "./github-models-terrain-update.provider.js";
import type {
  TerrainUpdateAnalysisInput,
  TerrainUpdateAnalysisProvider,
  TerrainUpdateAnalysisResult,
} from "./terrain-update-analysis.provider.js";
import { isDocumentAnalysisConfigured } from "./providers.js";

@Injectable()
export class UnconfiguredTerrainUpdateAnalysisProvider implements TerrainUpdateAnalysisProvider {
  readonly name = "unconfigured";
  constructor(private readonly config: ConfigService) {}
  isConfigured(): boolean {
    return isDocumentAnalysisConfigured(this.config);
  }
  analyzeDocumentUpdate(): Promise<TerrainUpdateAnalysisResult> {
    return Promise.reject(new DocumentAnalysisNotConfiguredError());
  }
}

@Injectable()
export class ConfigurableTerrainUpdateAnalysisProvider implements TerrainUpdateAnalysisProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly github: GitHubModelsTerrainUpdateAnalysisProvider,
    private readonly unconfigured: UnconfiguredTerrainUpdateAnalysisProvider,
  ) {}

  get name(): string {
    return this.resolve().name;
  }

  isConfigured(): boolean {
    return this.resolve().isConfigured();
  }

  private resolve(): TerrainUpdateAnalysisProvider {
    const provider = (this.config.get<string>("AI_PROVIDER") || "").toLowerCase().trim();
    if (provider === "github-models" && this.github.isConfigured()) return this.github;
    return this.unconfigured;
  }

  analyzeDocumentUpdate(input: TerrainUpdateAnalysisInput) {
    return this.resolve().analyzeDocumentUpdate(input);
  }
}
