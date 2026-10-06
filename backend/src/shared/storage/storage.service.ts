export interface StoredObjectHead {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
  width?: number;
  height?: number;
  format?: string;
  resourceType?: string;
  version?: string;
  assetId?: string;
}

export interface SignedUpload {
  url: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  fields?: Record<string, string>;
  expiresAt: Date;
  resourceType?: string;
  publicId?: string;
}

export abstract class StorageService {
  abstract readonly provider: string;
  abstract readonly bucket: string;
  abstract createPresignedUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<SignedUpload>;
  abstract createPresignedDownloadUrl(
    key: string,
    disposition?: "inline" | "attachment",
    options?: { resourceType?: string; format?: string },
  ): Promise<string>;
  /** Fetch private object bytes server-side (no public URL exposure to clients). */
  abstract fetchObjectBytes(
    key: string,
    options?: { resourceType?: string; format?: string },
  ): Promise<Buffer>;
  abstract verifyObjectExists(key: string, resourceType?: string): Promise<boolean>;
  abstract headObject(key: string): Promise<StoredObjectHead>;
  abstract deleteObject(key: string): Promise<void>;
}
