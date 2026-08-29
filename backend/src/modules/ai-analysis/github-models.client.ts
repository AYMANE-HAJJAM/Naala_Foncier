import { DocumentAnalysisProviderError } from "./document-analysis.provider.js";

export type GitHubModelsContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type GitHubModelsMessage = {
  role: "system" | "user" | "assistant";
  content: string | GitHubModelsContentPart[];
};

export type GitHubModelsChatOptions = {
  baseUrl: string;
  token: string;
  model: string;
  messages: GitHubModelsMessage[];
  responseFormat?: "json_object";
  timeoutMs?: number;
};

const RATE_LIMIT_MESSAGE =
  "Limite temporaire du service d’analyse atteinte. Réessayez plus tard ou continuez sans analyse automatique.";

export async function githubModelsChatCompletion(
  options: GitHubModelsChatOptions,
): Promise<string> {
  const base = options.baseUrl.replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: 0,
        response_format: options.responseFormat
          ? { type: options.responseFormat }
          : undefined,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new DocumentAnalysisProviderError(
        "AI_PROVIDER_RATE_LIMIT",
        RATE_LIMIT_MESSAGE,
      );
    }

    if (!res.ok) {
      const detail = await safeErrorBody(res);
      throw new DocumentAnalysisProviderError(
        "AI_ANALYSIS_FAILED",
        `Le service d’analyse a renvoyé une erreur (${res.status}).${detail ? ` ${detail}` : ""}`,
      );
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text?.trim()) {
      throw new DocumentAnalysisProviderError(
        "AI_INVALID_RESPONSE",
        "Réponse vide du fournisseur d’analyse.",
      );
    }
    return text;
  } catch (err) {
    if (err instanceof DocumentAnalysisProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new DocumentAnalysisProviderError(
        "AI_PROVIDER_TIMEOUT",
        "Délai dépassé lors de l’analyse automatique.",
      );
    }
    throw new DocumentAnalysisProviderError(
      "AI_ANALYSIS_FAILED",
      "L’analyse automatique n’a pas pu être terminée.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function safeErrorBody(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    const msg = body.error?.message?.trim();
    if (!msg) return null;
    // Never surface token-like strings in error messages.
    if (/bearer|api[_-]?key|token/i.test(msg)) return null;
    return msg.slice(0, 200);
  } catch {
    return null;
  }
}

export function parseJsonContent(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new DocumentAnalysisProviderError(
      "AI_INVALID_RESPONSE",
      "La réponse du fournisseur d’analyse n’est pas un JSON valide.",
    );
  }
}
