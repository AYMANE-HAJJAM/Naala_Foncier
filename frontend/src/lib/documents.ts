/** Clean USER-facing document titles (hide technical import suffixes). */
export function cleanDocumentTitle(title: string): string {
  if (!title) return "Document";
  return title
    .replace(/\s*[—–-]\s*R\s*\d+\s*\/\s*\d+/gi, "")
    .replace(/\s*[—–-]\s*slide\s*\d+(?:\s*\(\d+\))?/gi, "")
    .replace(/\s*[—–-]\s*page\s*\d+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[—–-]\s*$/g, "")
    .trim() || title;
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  const mo = bytes / (1024 * 1024);
  return `${mo.toFixed(mo >= 10 ? 0 : 1).replace(".", ",")} Mo`;
}

export function formatFileFormat(
  fileName?: string | null,
  mimeType?: string | null,
): string {
  const fromName = fileName?.split(".").pop()?.trim();
  if (fromName && fromName.length <= 5 && fromName !== fileName) {
    return fromName.toUpperCase();
  }
  if (!mimeType || mimeType === "—") return "—";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "JPG";
  if (mimeType.includes("png")) return "PNG";
  if (mimeType.includes("webp")) return "WEBP";
  if (mimeType.includes("wordprocessingml")) return "DOCX";
  if (mimeType.includes("msword")) return "DOC";
  if (mimeType.includes("presentationml")) return "PPTX";
  return mimeType.split("/").pop()?.toUpperCase() ?? "—";
}

export type PreviewKind =
  | "pdf"
  | "image"
  | "docx"
  | "doc"
  | "office"
  | "unknown";

export function detectPreviewKind(
  fileName?: string | null,
  mimeType?: string | null,
): PreviewKind {
  const name = (fileName ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(name)
  ) {
    return "image";
  }
  // Legacy .doc before .docx check
  if (
    (mime === "application/msword" && !name.endsWith(".docx")) ||
    (name.endsWith(".doc") && !name.endsWith(".docx"))
  ) {
    return "doc";
  }
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument.wordprocessing") ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    mime.includes("presentation") ||
    mime.includes("ms-powerpoint") ||
    /\.(pptx?)$/i.test(name)
  ) {
    return "office";
  }
  return "unknown";
}
