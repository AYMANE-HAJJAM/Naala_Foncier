import { fetchWithAuth } from "./auth-session";
import { ApiError, type ApiErrorBody } from "./fetcher";

/**
 * Authenticated binary fetch for in-app viewers (DOCX ArrayBuffer, etc.).
 * Does not parse JSON — returns raw bytes.
 */
export async function fetchBinary(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<ArrayBuffer> {
  const response = await fetchWithAuth(url, {
    method: "GET",
    signal: options?.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    let body: ApiErrorBody | string = `Erreur API ${response.status}`;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, body);
  }

  return response.arrayBuffer();
}

export function getDocumentContentUrl(documentId: string) {
  return `/api/documents/${documentId}/content`;
}

export function getReportContentUrl(reportId: string) {
  return `/api/reports/${reportId}/content`;
}
