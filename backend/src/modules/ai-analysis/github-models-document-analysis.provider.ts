import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DocumentAnalysisInput,
  DocumentAnalysisNotConfiguredError,
  DocumentAnalysisProvider,
  DocumentAnalysisProviderError,
  DocumentFactsExtraction,
  TerrainDocumentsAnalysisResult,
  emptyProposal,
  validateAnalysisResult,
  validateDocumentFacts,
} from "./document-analysis.provider.js";
import {
  GitHubModelsContentPart,
  GitHubModelsMessage,
  githubModelsChatCompletion,
  parseJsonContent,
} from "./github-models.client.js";

const DOCUMENT_SYSTEM_PROMPT = `You extract factual information from a single private Moroccan land/legal document (NAALA FONCIER).

Rules:
- Do not provide legal advice.
- Do not infer facts not present in the document.
- Return JSON only.
- Each fact must include category, fieldKey, value, page (when known), evidenceText (max ~200 chars), confidence.
- Use draftDocumentId exactly as provided.
- Use null when information is unavailable.
- Preserve names, references, case numbers and dates exactly as written.
- Documents may be French, Arabic or mixed.
- Do not invent page numbers.
- Human-selected category and customCategoryName are context hints only.

JSON shape:
{
  "draftDocumentId": "...",
  "facts": [
    {
      "category": "identity|procedural|court|bornage|opposition|date|other",
      "fieldKey": "requisitionReference|propertyName|location|surface|seller|buyer|courtCaseNumber|courtName|bornageStatus|oppositionCount|...",
      "value": "string or boolean or number or null",
      "page": 1,
      "evidenceText": "short quote",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "rawNotes": "optional short notes"
}`;

const SYNTHESIS_SYSTEM_PROMPT = `You synthesize extracted facts from multiple Moroccan land/legal documents for a terrain creation wizard (NAALA FONCIER).

Rules:
- Do not provide legal advice.
- Do not infer facts not supported by the provided extracted facts.
- Do not predict court outcomes.
- Do not resolve contradictions silently — put them in conflicts[].
- Return structured JSON matching the terrain analysis schema.
- Every factual proposal must cite sourceDocumentId and sourcePage from the facts when available.
- Use null when information is unavailable.
- pointsToClarify: max 5, only from missing/contradictory/unclear facts.
- initialSituation.summary: factual, max ~250 characters, no opinion.
- includeByDefault=true only for HIGH confidence court cases/events.
- Never invent risk scores or financial valuations.

Required top-level keys: available, terrainIdentity, proceduralFacts.
Optional: courtCases, proceduralEvents, oppositions, bornage, conflicts, pointsToClarify, initialSituation.`;

@Injectable()
export class GitHubModelsDocumentAnalysisProvider implements DocumentAnalysisProvider {
  readonly name = "github-models";
  private readonly logger = new Logger(GitHubModelsDocumentAnalysisProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const provider = (this.config.get<string>("AI_PROVIDER") || "")
      .toLowerCase()
      .trim();
    const token = this.config.get<string>("GITHUB_MODELS_TOKEN") || "";
    return provider === "github-models" && Boolean(token);
  }

  private model(): string {
    return this.config.get<string>("AI_MODEL") || "openai/gpt-4.1";
  }

  private baseUrl(): string {
    return (
      this.config.get<string>("GITHUB_MODELS_BASE_URL") ||
      "https://models.github.ai/inference"
    );
  }

  private token(): string {
    const token = this.config.get<string>("GITHUB_MODELS_TOKEN") || "";
    if (!token) throw new DocumentAnalysisNotConfiguredError();
    return token;
  }

  async analyzeDocument(
    input: DocumentAnalysisInput,
  ): Promise<Partial<TerrainDocumentsAnalysisResult>> {
    return this.analyzeTerrainDocuments([input]);
  }

  async analyzeTerrainDocuments(
    inputs: DocumentAnalysisInput[],
  ): Promise<TerrainDocumentsAnalysisResult> {
    if (!this.isConfigured()) {
      throw new DocumentAnalysisNotConfiguredError();
    }
    if (!inputs.length) {
      return emptyProposal("Aucun document à analyser.");
    }

    const documentFacts: DocumentFactsExtraction[] = [];
    for (const input of inputs) {
      documentFacts.push(await this.extractDocumentFacts(input));
    }

    const synthesisMessages: GitHubModelsMessage[] = [
      { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Cross-document synthesis for ${inputs.length} documents.\n\nDocument index:\n${inputs
              .map(
                (d, i) =>
                  `${i + 1}. draftDocumentId=${d.draftDocumentId} category=${d.category}${
                    d.customCategoryName
                      ? ` customCategoryName=${d.customCategoryName}`
                      : ""
                  } filename=${d.originalFilename}`,
              )
              .join(
                "\n",
              )}\n\nExtracted facts (stage 1):\n${JSON.stringify(documentFacts)}`,
          },
        ],
      },
    ];

    const raw = await this.callWithJsonRepair(synthesisMessages, (data) =>
      validateAnalysisResult(data),
    );
    return this.normalizeResult(raw, inputs);
  }

  private async extractDocumentFacts(
    input: DocumentAnalysisInput,
  ): Promise<DocumentFactsExtraction> {
    const draftDocumentId = input.draftDocumentId ?? "unknown";
    const messages: GitHubModelsMessage[] = [
      { role: "system", content: DOCUMENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: this.buildDocumentContent(input, draftDocumentId),
      },
    ];

    const parsed = await this.callWithJsonRepair(messages, (data) => {
      const facts = validateDocumentFacts(data);
      if (facts.draftDocumentId !== draftDocumentId) {
        return { ...facts, draftDocumentId };
      }
      return facts;
    });
    return parsed;
  }

  private buildDocumentContent(
    input: DocumentAnalysisInput,
    draftDocumentId: string,
  ): GitHubModelsContentPart[] {
    const parts: GitHubModelsContentPart[] = [
      {
        type: "text",
        text: `Extract structured facts from this document.\ndraftDocumentId=${draftDocumentId}\ncategory=${input.category}${
          input.customCategoryName
            ? `\ncustomCategoryName=${input.customCategoryName}`
            : ""
        }\nfilename=${input.originalFilename}\nmime=${input.mimeType}`,
      },
    ];

    if (input.textExcerpt) {
      parts.push({
        type: "text",
        text: `Extracted text:\n${input.textExcerpt}`,
      });
      return parts;
    }

    if (input.pageTexts?.length) {
      for (const page of input.pageTexts) {
        parts.push({
          type: "text",
          text: `--- Page ${page.page} ---\n${page.text}`,
        });
      }
      return parts;
    }

    if (input.pageImages?.length) {
      for (const page of input.pageImages) {
        parts.push({
          type: "text",
          text: `--- Scanned page ${page.page} ---`,
        });
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${page.mimeType};base64,${page.bytes.toString("base64")}`,
          },
        });
      }
      return parts;
    }

    if (input.bytes?.length && input.mimeType.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${input.mimeType};base64,${input.bytes.toString("base64")}`,
        },
      });
      return parts;
    }

    parts.push({
      type: "text",
      text: "[Document content unavailable for analysis]",
    });
    return parts;
  }

  private async callWithJsonRepair<T>(
    messages: GitHubModelsMessage[],
    validate: (raw: unknown) => T,
  ): Promise<T> {
    let rawText = await this.callModel(messages);
    try {
      return validate(parseJsonContent(rawText));
    } catch (err) {
      if (
        !(err instanceof DocumentAnalysisProviderError) ||
        err.code !== "AI_INVALID_RESPONSE"
      ) {
        throw err;
      }
      this.logger.warn("Invalid AI JSON — retrying once with correction prompt");
      const repairMessages: GitHubModelsMessage[] = [
        ...messages,
        { role: "assistant", content: rawText },
        {
          role: "user",
          content:
            "Your previous JSON did not match the required schema. Return corrected JSON only, no markdown.",
        },
      ];
      rawText = await this.callModel(repairMessages);
      return validate(parseJsonContent(rawText));
    }
  }

  private async callModel(messages: GitHubModelsMessage[]): Promise<string> {
    try {
      return await githubModelsChatCompletion({
        baseUrl: this.baseUrl(),
        token: this.token(),
        model: this.model(),
        messages,
        responseFormat: "json_object",
      });
    } catch (err) {
      if (
        err instanceof DocumentAnalysisProviderError ||
        err instanceof DocumentAnalysisNotConfiguredError
      ) {
        throw err;
      }
      this.logger.error(
        "GitHub Models analysis failed: unexpected provider error",
      );
      throw new DocumentAnalysisProviderError(
        "AI_ANALYSIS_FAILED",
        "L’analyse automatique n’a pas pu être terminée.",
      );
    }
  }

  private normalizeResult(
    result: TerrainDocumentsAnalysisResult,
    inputs: DocumentAnalysisInput[],
  ): TerrainDocumentsAnalysisResult {
    const ids = new Set(
      inputs.map((i) => i.draftDocumentId).filter(Boolean) as string[],
    );
    const fixField = <T>(f: { sourceDocumentId?: string | null } & T): T => {
      if (f.sourceDocumentId && !ids.has(f.sourceDocumentId)) {
        return { ...f, sourceDocumentId: inputs[0]?.draftDocumentId ?? null };
      }
      return f;
    };
    const id = result.terrainIdentity;
    return {
      ...result,
      available: true,
      terrainIdentity: {
        requisitionReference: fixField(id.requisitionReference),
        propertyName: fixField(id.propertyName),
        location: fixField(id.location),
        surface: fixField(id.surface),
        seller: fixField(id.seller),
        buyer: fixField(id.buyer),
        linkedRequisition: fixField(id.linkedRequisition),
      },
      pointsToClarify: (result.pointsToClarify ?? []).slice(0, 5),
    };
  }
}
