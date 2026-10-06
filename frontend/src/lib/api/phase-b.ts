import { customFetcher } from "./fetcher";

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const createLegalCase = (body: Record<string, unknown>) =>
  customFetcher("/api/legal-cases", json("POST", body));
export const createTerrainEvent = (body: Record<string, unknown>) =>
  customFetcher("/api/terrain-events", json("POST", body));
export const rescheduleTerrainEvent = (id: string, body: Record<string, unknown>) =>
  customFetcher(`/api/terrain-events/${id}/reschedule`, json("POST", body));

export const createOpposition = (body: Record<string, unknown>) =>
  customFetcher("/api/oppositions", json("POST", body));
export const updateOpposition = (id: string, body: Record<string, unknown>) =>
  customFetcher(`/api/oppositions/${id}`, json("PATCH", body));
export const deleteOpposition = (id: string) =>
  customFetcher(`/api/oppositions/${id}`, json("DELETE"));

export const createReport = (body: Record<string, unknown>) =>
  customFetcher("/api/reports", json("POST", body));
export const addReportVersion = (id: string, body: Record<string, unknown>) =>
  customFetcher(`/api/reports/${id}/versions`, json("POST", body));
export const submitReport = (id: string) =>
  customFetcher(`/api/reports/${id}/submit-validation`, json("POST"));
export const validateReport = (id: string) =>
  customFetcher(`/api/reports/${id}/validate`, json("POST"));
export const rejectReport = (id: string) =>
  customFetcher(`/api/reports/${id}/reject`, json("POST"));
export const publishReport = (id: string) =>
  customFetcher(`/api/reports/${id}/publish`, json("POST"));
