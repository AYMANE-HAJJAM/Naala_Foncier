import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentAnalysisNotConfiguredError, DocumentAnalysisProviderError } from "./document-analysis.provider.js";
import {
  githubModelsChatCompletion,
  parseJsonContent,
  type GitHubModelsContentPart,
  type GitHubModelsMessage,
} from "./github-models.client.js";
import {
  TerrainUpdateAnalysisInput,
  TerrainUpdateAnalysisProvider,
  TerrainUpdateAnalysisResult,
  validateTerrainUpdateAnalysisResult,
} from "./terrain-update-analysis.provider.js";

const SYSTEM_PROMPT = `You analyze a NEW document uploaded to an EXISTING Moroccan land requisition terrain (NAALA FONCIER).

Compare document facts against the provided OFFICIAL current terrain state.

Rules:
- Do not provide legal advice or legal strategy.
- Do not infer facts not present in the document.
- Do not predict court outcomes.
- Official database state is authoritative — never assume it is wrong without explicit document evidence.
- If document contradicts official identity fields → IDENTITY_CONFLICT proposal (do not auto-update).
- If document confirms an already-known event → DOCUMENT_INFORMATION or NO_ACTION (not duplicate NEW_EVENT).
- If no new/changed information → noChange=true, detectedUpdates=[].
- Return JSON only.
- Max 5 pointsToClarify.
- Preserve raw date text; do not invent exact dates from vague months.
- Use proposalType from allowed set.
- Category metadata guides detection priority (TRIBUNAL, ANCFCC, OPPOSITIONS, etc.).
- Every proposal needs evidenceText (max ~200 chars), sourcePage when known, confidence.

Allowed proposalType values:
NEW_EVENT, UPDATE_EVENT, NEW_COURT_CASE, UPDATE_COURT_CASE, NEW_HEARING, HEARING_POSTPONED,
COURT_DECISION, NEW_OPPOSITION, UPDATE_OPPOSITION, BORNAGE_UPDATE, ANCFCC_UPDATE,
IDENTITY_CONFLICT, PROCEDURAL_UPDATE, NEW_DATE, DOCUMENT_INFORMATION, NO_ACTION

JSON shape:
{
  "documentSummary": { "categoryHint": "...", "shortSummary": "..." },
  "detectedUpdates": [{ "proposalType", "title", "summary", "proposedData", "sourcePage", "evidenceText", "confidence", "rawDateText", "occurredAt", "scheduledAt", "isScheduled", "eventType" }],
  "conflicts": [{ "field", "currentValue", "documentValue", "sourcePage", "evidenceText", "confidence" }],
  "newDates": [{ "label", "rawDateText", "normalizedDate", "isFuture", "sourcePage" }],
  "pointsToClarify": ["..."],
  "noChange": false
}`;

@Injectable()
export class GitHubModelsTerrainUpdateAnalysisProvider implements TerrainUpdateAnalysisProvider {
  readonly name = "github-models";
  private readonly logger = new Logger(GitHubModelsTerrainUpdateAnalysisProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const provider = (this.config.get<string>("AI_PROVIDER") || "").toLowerCase().trim();
    return provider === "github-models" && Boolean(this.config.get<string>("GITHUB_MODELS_TOKEN"));
  }

  async analyzeDocumentUpdate(
    input: TerrainUpdateAnalysisInput,
  ): Promise<TerrainUpdateAnalysisResult> {
    if (!this.isConfigured()) throw new DocumentAnalysisNotConfiguredError();

    const messages: GitHubModelsMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: this.buildContent(input),
      },
    ];

    const rawText = await this.callWithRepair(messages);
    const result = validateTerrainUpdateAnalysisResult(parseJsonContent(rawText));
    return {
      ...result,
      pointsToClarify: (result.pointsToClarify ?? []).slice(0, 5),
      detectedUpdates: result.detectedUpdates ?? [],
    };
  }

  private buildContent(input: TerrainUpdateAnalysisInput): GitHubModelsContentPart[] {
    const parts: GitHubModelsContentPart[] = [
      {
        type: "text",
        text: `Analyze this new document for terrain update proposals.
documentId=${input.documentId}
category=${input.category}${input.customCategoryName ? `\ncustomCategoryName=${input.customCategoryName}` : ""}
filename=${input.originalFilename}

OFFICIAL CURRENT STATE (authoritative):
${JSON.stringify(input.officialContext)}`,
      },
    ];

    if (input.textExcerpt) {
      parts.push({ type: "text", text: `Document text:\n${input.textExcerpt}` });
    } else if (input.pageTexts?.length) {
      for (const p of input.pageTexts) {
        parts.push({ type: "text", text: `--- Page ${p.page} ---\n${p.text}` });
      }
    } else if (input.pageImages?.length) {
      for (const p of input.pageImages) {
        parts.push({ type: "text", text: `--- Scanned page ${p.page} ---` });
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${p.mimeType};base64,${p.bytes.toString("base64")}`,
          },
        });
      }
    } else if (input.bytes?.length && input.mimeType.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${input.mimeType};base64,${input.bytes.toString("base64")}`,
        },
      });
    }

    return parts;
  }

  private async callWithRepair(messages: GitHubModelsMessage[]): Promise<string> {
    const rawText = await this.callModel(messages);
    try {
      validateTerrainUpdateAnalysisResult(parseJsonContent(rawText));
      return rawText;
    } catch (err) {
      if (
        !(err instanceof DocumentAnalysisProviderError) ||
        err.code !== "AI_INVALID_RESPONSE"
      ) {
        throw err;
      }
      this.logger.warn("Invalid terrain update JSON — retrying once");
      const repair: GitHubModelsMessage[] = [
        ...messages,
        { role: "assistant", content: rawText },
        {
          role: "user",
          content: "Return corrected JSON only matching the schema. No markdown.",
        },
      ];
      return this.callModel(repair);
    }
  }

  private async callModel(messages: GitHubModelsMessage[]): Promise<string> {
    const token = this.config.get<string>("GITHUB_MODELS_TOKEN") || "";
    if (!token) throw new DocumentAnalysisNotConfiguredError();
    return githubModelsChatCompletion({
      baseUrl:
        this.config.get<string>("GITHUB_MODELS_BASE_URL") ||
        "https://models.github.ai/inference",
      token,
      model: this.config.get<string>("AI_MODEL") || "openai/gpt-4.1",
      messages,
      responseFormat: "json_object",
    });
  }
}
