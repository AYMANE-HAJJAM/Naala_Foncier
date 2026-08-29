import { customFetcher } from "@/lib/api/fetcher";

export type ReportSignedUrlResponse = {
  data?: {
    url?: string;
    expiresIn?: number;
    documentId?: string;
    originalFilename?: string;
    mimeType?: string;
    fileSize?: number;
    previewAvailable?: boolean;
    isPreviewDocument?: boolean;
  };
};

export async function getReportPreviewUrl(id: string) {
  return customFetcher<ReportSignedUrlResponse>(
    `/api/reports/${id}/preview-url`,
  );
}

export async function getReportDownloadUrl(id: string) {
  return customFetcher<ReportSignedUrlResponse>(
    `/api/reports/${id}/download-url`,
  );
}
