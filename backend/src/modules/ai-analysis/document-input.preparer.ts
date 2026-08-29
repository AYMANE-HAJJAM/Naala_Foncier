import { createHash } from "node:crypto";
import mammoth from "mammoth";
import type { DocumentAnalysisInput, PageImage, PageText } from "./document-analysis.provider.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Below this average chars/page, PDF is treated as scanned imagery. */
const MIN_CHARS_PER_PAGE = 40;
/** Cap rendered PDF pages to control provider quota usage. */
const MAX_PDF_PAGES_FOR_VISION = 15;
const MAX_TEXT_CHARS = 120_000;

export async function prepareAnalysisInputs(
  docs: Array<{
    id: string;
    category: string;
    customCategoryName?: string | null;
    originalFilename: string;
    mimeType: string;
    storageKey: string;
    bytes: Buffer;
  }>,
): Promise<DocumentAnalysisInput[]> {
  const out: DocumentAnalysisInput[] = [];
  for (const d of docs) {
    const mime = d.mimeType || "application/octet-stream";
    const lowerName = d.originalFilename.toLowerCase();
    let textExcerpt: string | undefined;
    let pageTexts: PageText[] | undefined;
    let pageImages: PageImage[] | undefined;
    let isScannedPdf = false;
    let bytes: Buffer | undefined = d.bytes;
    let pageHint: number | null = null;

    if (mime === DOCX_MIME || lowerName.endsWith(".docx")) {
      try {
        const extracted = await mammoth.extractRawText({ buffer: d.bytes });
        textExcerpt = (extracted.value || "").slice(0, MAX_TEXT_CHARS);
        bytes = undefined;
      } catch {
        textExcerpt = undefined;
      }
    } else if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
      const pdfPages = await extractPdfPageTexts(d.bytes);
      if (isLikelyScannedPdf(pdfPages)) {
        isScannedPdf = true;
        pageImages = await renderPdfPagesToImages(d.bytes);
        pageTexts = undefined;
        textExcerpt = undefined;
        bytes = undefined;
        pageHint = pageImages[0]?.page ?? 1;
      } else {
        pageTexts = pdfPages;
        textExcerpt = pdfPages
          .map((p) => `--- Page ${p.page} ---\n${p.text}`)
          .join("\n\n")
          .slice(0, MAX_TEXT_CHARS);
        bytes = undefined;
        pageHint = pdfPages[0]?.page ?? null;
      }
    } else if (mime.startsWith("image/")) {
      pageHint = 1;
    }

    out.push({
      draftDocumentId: d.id,
      category: d.category,
      customCategoryName: d.customCategoryName,
      originalFilename: d.originalFilename,
      mimeType: mime,
      textExcerpt,
      pageTexts,
      pageImages,
      isScannedPdf,
      bytes,
      pageHint,
    });
  }
  return out;
}

async function extractPdfPageTexts(buffer: Buffer): Promise<PageText[]> {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;
    const pages: PageText[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ page: i, text });
    }
    return pages;
  } catch {
    return [];
  }
}

function isLikelyScannedPdf(pages: PageText[]): boolean {
  if (!pages.length) return true;
  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  return totalChars / pages.length < MIN_CHARS_PER_PAGE;
}

async function renderPdfPagesToImages(buffer: Buffer): Promise<PageImage[]> {
  const images: PageImage[] = [];
  try {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(buffer, { scale: 2 });
    let page = 0;
    for await (const image of document) {
      page += 1;
      if (page > MAX_PDF_PAGES_FOR_VISION) break;
      images.push({
        page,
        mimeType: "image/png",
        bytes: Buffer.isBuffer(image) ? image : Buffer.from(image),
      });
    }
  } catch {
    return [];
  }
  return images;
}

export function shortContentFingerprint(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}
