import {
  DocumentAnalysisProviderError,
  validateDocumentFacts,
} from "../src/modules/ai-analysis/document-analysis.provider.js";
import { jest } from "@jest/globals";
import {
  githubModelsChatCompletion,
  parseJsonContent,
} from "../src/modules/ai-analysis/github-models.client.js";
import { isDocumentAnalysisConfigured } from "../src/modules/ai-analysis/providers.js";

describe("GitHub Models client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps HTTP 429 to AI_PROVIDER_RATE_LIMIT", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({}),
    }) as typeof fetch;

    const request = githubModelsChatCompletion({
        baseUrl: "https://models.github.ai/inference",
        token: "test-token",
        model: "openai/gpt-4.1",
        messages: [{ role: "user", content: "hi" }],
      });
    await expect(request).rejects.toBeInstanceOf(DocumentAnalysisProviderError);
    await request.catch((error: unknown) => {
      if (!(error instanceof DocumentAnalysisProviderError)) throw error;
      expect(error.code).toBe("AI_PROVIDER_RATE_LIMIT");
      expect(error.message).toContain("Limite temporaire");
    });
  });

  it("parses fenced JSON content", () => {
    const raw = parseJsonContent('```json\n{"draftDocumentId":"d1","facts":[]}\n```');
    expect(validateDocumentFacts(raw).draftDocumentId).toBe("d1");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseJsonContent("not json")).toThrow(DocumentAnalysisProviderError);
  });
});

describe("GitHub Models configuration", () => {
  it("requires github-models provider and token", () => {
    const config = {
      get: (key: string) => {
        if (key === "AI_PROVIDER") return "github-models";
        if (key === "GITHUB_MODELS_TOKEN") return "";
        return "";
      },
    };
    expect(isDocumentAnalysisConfigured(config as never)).toBe(false);

    const configured = {
      get: (key: string) => {
        if (key === "AI_PROVIDER") return "github-models";
        if (key === "GITHUB_MODELS_TOKEN") return "ghp_secret";
        return "";
      },
    };
    expect(isDocumentAnalysisConfigured(configured as never)).toBe(true);
  });
});
