import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DocumentAnalysisInput,
  DocumentAnalysisNotConfiguredError,
  DocumentAnalysisProvider,
  TerrainDocumentsAnalysisResult,
  emptyProposal,
} from "./document-analysis.provider.js";
import { GitHubModelsDocumentAnalysisProvider } from "./github-models-document-analysis.provider.js";

export function isDocumentAnalysisConfigured(config: ConfigService): boolean {
  const provider = (config.get<string>("AI_PROVIDER") || "").toLowerCase().trim();
  if (provider === "github-models") {
    return Boolean(config.get<string>("GITHUB_MODELS_TOKEN"));
  }
  return false;
}

/**
 * Default provider: refuses to invent results when credentials are missing.
 */
@Injectable()
export class UnconfiguredDocumentAnalysisProvider implements DocumentAnalysisProvider {
  readonly name = "unconfigured";

  isConfigured(): boolean {
    return false;
  }

  analyzeDocument(): Promise<Partial<TerrainDocumentsAnalysisResult>> {
    return Promise.reject(new DocumentAnalysisNotConfiguredError());
  }

  analyzeTerrainDocuments(): Promise<TerrainDocumentsAnalysisResult> {
    return Promise.resolve(emptyProposal());
  }
}

/**
 * Routes to the concrete provider based on AI_PROVIDER.
 */
@Injectable()
export class ConfigurableDocumentAnalysisProvider implements DocumentAnalysisProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly githubModels: GitHubModelsDocumentAnalysisProvider,
    private readonly unconfigured: UnconfiguredDocumentAnalysisProvider,
  ) {}

  get name(): string {
    return this.resolve().name;
  }

  isConfigured(): boolean {
    return this.resolve().isConfigured();
  }

  private resolve(): DocumentAnalysisProvider {
    const provider = (this.config.get<string>("AI_PROVIDER") || "").toLowerCase().trim();
    if (provider === "github-models" && this.githubModels.isConfigured()) {
      return this.githubModels;
    }
    return this.unconfigured;
  }

  analyzeDocument(input: DocumentAnalysisInput) {
    return this.resolve().analyzeDocument(input);
  }

  analyzeTerrainDocuments(inputs: DocumentAnalysisInput[]) {
    return this.resolve().analyzeTerrainDocuments(inputs);
  }
}
