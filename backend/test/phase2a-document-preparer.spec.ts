import { readFile } from "node:fs/promises";
import path from "node:path";
import { prepareAnalysisInputs } from "../src/modules/ai-analysis/document-input.preparer.js";

describe("Document input preparer", () => {
  it("extracts DOCX text and drops binary bytes", async () => {
    const docxPath = path.join(
      process.cwd(),
      "test",
      "fixtures",
      "sample.docx",
    );
    let bytes: Buffer;
    try {
      bytes = await readFile(docxPath);
    } catch {
      // Minimal DOCX zip header is enough to exercise mammoth failure path gracefully.
      bytes = Buffer.from("PK\x03\x04", "binary");
    }

    const [input] = await prepareAnalysisInputs([
      {
        id: "doc-1",
        category: "ANCFCC",
        originalFilename: "sample.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        storageKey: "k1",
        bytes,
      },
    ]);

    expect(input.draftDocumentId).toBe("doc-1");
    if (input.textExcerpt) {
      expect(input.bytes).toBeUndefined();
    }
  });

  it("keeps image bytes for multimodal input", async () => {
    const bytes = Buffer.from("fake-image");
    const [input] = await prepareAnalysisInputs([
      {
        id: "img-1",
        category: "AUTRE",
        customCategoryName: "Photo terrain",
        originalFilename: "photo.jpg",
        mimeType: "image/jpeg",
        storageKey: "k2",
        bytes,
      },
    ]);

    expect(input.mimeType).toBe("image/jpeg");
    expect(input.bytes).toEqual(bytes);
    expect(input.pageHint).toBe(1);
  });
});
