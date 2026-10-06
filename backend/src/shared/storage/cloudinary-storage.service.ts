import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { createHash, randomUUID } from "node:crypto";
import { StorageService, type SignedUpload, type StoredObjectHead } from "./storage.service.js";

type CloudinaryResourceType = "image" | "raw" | "auto";

@Injectable()
export class CloudinaryStorageService extends StorageService {
  readonly provider = "CLOUDINARY";
  readonly bucket: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly folderRoot: string;
  private readonly expiresIn: number;

  private readonly configured: boolean;

  constructor(config: ConfigService) {
    super();
    const cloudName = config.get<string>("CLOUDINARY_CLOUD_NAME", "");
    this.apiKey = config.get<string>("CLOUDINARY_API_KEY", "");
    this.apiSecret = config.get<string>("CLOUDINARY_API_SECRET", "");
    this.folderRoot = config.get<string>(
      "CLOUDINARY_UPLOAD_FOLDER",
      "naala-foncier",
    );
    this.bucket = cloudName;
    this.expiresIn = config.get<number>("SIGNED_URL_EXPIRATION_SECONDS", 900);
    this.configured = Boolean(cloudName && this.apiKey && this.apiSecret);

    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  private assertConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        "Cloudinary n’est pas configuré (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).",
      );
    }
  }

  buildPublicId(folderPath: string, uuid = randomUUID()): string {
    return `${folderPath}/${uuid}`;
  }

  resourceTypeForMime(mimeType: string): CloudinaryResourceType {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType === "application/pdf") return "image";
    return "raw";
  }

  createPresignedUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<SignedUpload> {
    this.assertConfigured();
    void sizeBytes;
    const timestamp = Math.floor(Date.now() / 1000);
    const resourceType = this.resourceTypeForMime(mimeType);
    const parts = key.split("/");
    const publicIdLeaf = parts.pop()!;
    const folder = parts.join("/") || this.folderRoot;

    const signedParams = {
      timestamp,
      folder,
      public_id: publicIdLeaf,
      type: "authenticated",
    };

    const signature = cloudinary.utils.api_sign_request(
      signedParams,
      this.apiSecret,
    );

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.bucket}/${resourceType}/upload`;

    return Promise.resolve({
      url: uploadUrl,
      method: "POST",
      headers: {},
      fields: {
        api_key: this.apiKey,
        timestamp: String(timestamp),
        signature,
        folder,
        public_id: publicIdLeaf,
        type: "authenticated",
      },
      expiresAt: new Date(Date.now() + this.expiresIn * 1000),
      resourceType,
      publicId: `${folder}/${publicIdLeaf}`,
    });
  }

  createPresignedDownloadUrl(
    key: string,
    disposition: "inline" | "attachment" = "attachment",
    options?: { resourceType?: string; format?: string },
  ): Promise<string> {
    this.assertConfigured();
    const resourceType =
      (options?.resourceType as CloudinaryResourceType) || "raw";
    const format = options?.format;
    return Promise.resolve(cloudinary.url(key, {
      type: "authenticated",
      resource_type: resourceType,
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + this.expiresIn,
      flags: disposition === "attachment" ? "attachment" : undefined,
      format,
    }));
  }

  async fetchObjectBytes(
    key: string,
    options?: { resourceType?: string; format?: string },
  ): Promise<Buffer> {
    this.assertConfigured();
    const url = await this.createPresignedDownloadUrl(key, "inline", options);
    const response = await fetch(url);
    if (!response.ok) {
      // Retry with alternate resource types for mis-tagged assets
      for (const resourceType of ["raw", "image", "auto"] as const) {
        if (resourceType === options?.resourceType) continue;
        const alt = await this.createPresignedDownloadUrl(key, "inline", {
          ...options,
          resourceType,
        });
        const retry = await fetch(alt);
        if (retry.ok) {
          return Buffer.from(await retry.arrayBuffer());
        }
      }
      throw new ServiceUnavailableException(
        `Impossible de récupérer le fichier Cloudinary (${response.status}).`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async verifyObjectExists(
    key: string,
    resourceType: CloudinaryResourceType = "raw",
  ): Promise<boolean> {
    this.assertConfigured();
    try {
      await cloudinary.api.resource(key, {
        resource_type: resourceType,
        type: "authenticated",
      });
      return true;
    } catch {
      try {
        await cloudinary.api.resource(key, {
          resource_type: "image",
          type: "authenticated",
        });
        return true;
      } catch {
        try {
          await cloudinary.api.resource(key, {
            resource_type: "raw",
            type: "authenticated",
          });
          return true;
        } catch {
          return false;
        }
      }
    }
  }

  async headObject(key: string): Promise<StoredObjectHead> {
    this.assertConfigured();
    const resource = await this.fetchResource(key);
    return {
      sizeBytes: Number(resource.bytes ?? 0),
      contentType: resource.format
        ? this.mimeFromFormat(resource.format, resource.resource_type)
        : undefined,
      etag: resource.etag,
      width: resource.width,
      height: resource.height,
      format: resource.format,
      resourceType: resource.resource_type,
      version: resource.version ? String(resource.version) : undefined,
      assetId: typeof resource.asset_id === "string" ? resource.asset_id : undefined,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    for (const resourceType of ["image", "raw", "auto"] as const) {
      try {
        await cloudinary.uploader.destroy(key, {
          resource_type: resourceType,
          type: "authenticated",
          invalidate: true,
        });
        return;
      } catch {
        // try next
      }
    }
  }

  private async fetchResource(key: string): Promise<UploadApiResponse & Record<string, unknown>> {
    for (const resourceType of ["image", "raw"] as const) {
      try {
        return (await cloudinary.api.resource(key, {
          resource_type: resourceType,
          type: "authenticated",
        })) as UploadApiResponse & Record<string, unknown>;
      } catch {
        // continue
      }
    }
    throw new Error(`Cloudinary asset introuvable: ${key}`);
  }

  private mimeFromFormat(format: string, resourceType?: string): string {
    const f = format.toLowerCase();
    if (f === "pdf") return "application/pdf";
    if (["jpg", "jpeg"].includes(f)) return "image/jpeg";
    if (f === "png") return "image/png";
    if (f === "webp") return "image/webp";
    if (f === "doc") return "application/msword";
    if (f === "docx")
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (resourceType === "image") return `image/${f}`;
    return "application/octet-stream";
  }
}

/** Deterministic helper for folder segments from requisition reference */
export function safeRequisitionFolder(reference: string): string {
  return reference
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function categoryFolderSegment(category: string): string {
  const map: Record<string, string> = {
    FICHE_SYNTHESE: "fiche-synthese",
    ANCFCC: "ancfcc",
    ACTES: "actes",
    ACTES_PROPRIETE: "actes-propriete",
    OPPOSITIONS: "oppositions",
    TRIBUNAL: "tribunal",
    TOPOGRAPHIE: "topographie",
    TERRAIN: "terrain",
    CORRESPONDANCES: "correspondances",
    RAPPORTS: "rapports",
    AUTRE: "autre",
  };
  return map[category] ?? category.toLowerCase().replace(/_/g, "-");
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
