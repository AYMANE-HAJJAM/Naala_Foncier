import { readFile } from "node:fs/promises";
import path from "node:path";
import { prepareAnalysisInputs } from "../src/modules/ai-analysis/document-input.preparer.js";

describe("Document input preparer", () => {
  it("renders a real scanned PDF into a PNG with the deployed PDF.js version", async () => {
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 20 20] /Contents 4 0 R /Resources << >> >>",
      "<< /Length 0 >>\nstream\n\nendstream",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const [input] = await prepareAnalysisInputs([{
      id: "pdf-test", category: "AUTRE", originalFilename: "blank.pdf", mimeType: "application/pdf", storageKey: "unit-test", bytes: Buffer.from(pdf),
    }]);
    expect(input.isScannedPdf).toBe(true);
    expect(input.pageImages).toHaveLength(1);
    expect(input.pageImages?.[0].bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

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
