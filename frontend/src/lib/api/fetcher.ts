import { fetchWithAuth } from "./auth-session";

export type ApiErrorBody = {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, body: ApiErrorBody | string) {
    const message =
      typeof body === "string"
        ? body
        : body.message || `Erreur API ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (typeof body !== "string") {
      this.code = body.code;
      this.details = body.details;
    }
  }
}

async function parseBody(response: Response) {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function customFetcher<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (
    options?.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetchWithAuth(url, { ...options, headers });

  const body = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as ApiErrorBody) || `Erreur API ${response.status}`,
    );
  }

  return {
    data: body,
    status: response.status,
    headers: response.headers,
  } as T;
}
