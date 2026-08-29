import {
  computeDraftFingerprint,
  emptyProposal,
  validateAnalysisResult,
  validateDocumentFacts,
  DocumentAnalysisProviderError,
} from "../src/modules/ai-analysis/document-analysis.provider.js";

describe("Phase 2A analysis helpers", () => {
  it("computes a stable draft fingerprint independent of order", () => {
    const a = [
      {
        id: "1",
        category: "ANCFCC",
        customCategoryName: null,
        storageKey: "k1",
        sizeBytes: 10,
      },
      {
        id: "2",
        category: "AUTRE",
        customCategoryName: "Procuration",
        storageKey: "k2",
        sizeBytes: 20n,
      },
    ];
    const b = [...a].reverse();
    expect(computeDraftFingerprint(a)).toBe(computeDraftFingerprint(b));
  });

  it("changes fingerprint when custom category changes", () => {
    const base = {
      id: "1",
      category: "AUTRE",
      customCategoryName: "Procuration",
      storageKey: "k1",
      sizeBytes: 10,
    };
    const changed = { ...base, customCategoryName: "Mandat" };
    expect(computeDraftFingerprint([base])).not.toBe(
      computeDraftFingerprint([changed]),
    );
  });

  it("validates a minimal structured analysis result", () => {
    const raw = {
      available: true,
      terrainIdentity: {
        requisitionReference: {
          value: "R 20696/31",
          confidence: "HIGH",
          status: "PROPOSED",
          sourceDocumentId: "d1",
          sourcePage: 1,
        },
        propertyName: { value: "X", confidence: "MEDIUM", status: "PROPOSED" },
        location: { value: "Y", confidence: "LOW", status: "PROPOSED" },
        surface: {
          value: "48 ha 61 a 00 ca",
          confidence: "HIGH",
          status: "PROPOSED",
          sourceDocumentId: "d1",
        },
        seller: { value: "A", confidence: "MEDIUM", status: "PROPOSED" },
        buyer: { value: "B", confidence: "MEDIUM", status: "PROPOSED" },
        linkedRequisition: { value: null, confidence: "LOW", status: "PROPOSED" },
      },
      proceduralFacts: {
        courtMentioned: { value: true, confidence: "HIGH", status: "PROPOSED" },
        courtCaseNumbers: {
          value: ["2025/1403/237"],
          confidence: "HIGH",
          status: "PROPOSED",
        },
        courtName: { value: "Sidi Ifni", confidence: "MEDIUM", status: "PROPOSED" },
        dates: { value: [], confidence: "LOW", status: "PROPOSED" },
        bornageMentioned: { value: false, confidence: "LOW", status: "PROPOSED" },
        oppositionsMentioned: { value: true, confidence: "MEDIUM", status: "PROPOSED" },
        oppositionCount: { value: 7, confidence: "MEDIUM", status: "PROPOSED" },
        latestKnownFact: { value: "Moudawala", confidence: "MEDIUM", status: "PROPOSED" },
      },
      conflicts: [
        {
          field: "surface",
          severity: "REVIEW_REQUIRED",
          values: [
            { value: "48 ha 61 a 00 ca", sourceDocumentId: "d1", sourcePage: 1 },
            { value: "48 ha 16 a 00 ca", sourceDocumentId: "d2", sourcePage: 3 },
          ],
        },
      ],
      pointsToClarify: ["Deux superficies différentes détectées."],
    };
    const result = validateAnalysisResult(raw);
    expect(result.terrainIdentity.requisitionReference.value).toBe("R 20696/31");
    expect(result.conflicts?.[0]?.field).toBe("surface");
    expect(result.conflicts?.[0]?.values).toHaveLength(2);
  });

  it("validates per-document facts extraction", () => {
    const raw = {
      draftDocumentId: "d1",
      facts: [
        {
          category: "identity",
          fieldKey: "requisitionReference",
          value: "R 148026/31",
          page: 1,
          evidenceText: "R 148026/31",
          confidence: "HIGH",
        },
      ],
    };
    const result = validateDocumentFacts(raw);
    expect(result.facts[0]?.value).toBe("R 148026/31");
  });

  it("rejects invalid provider JSON", () => {
    expect(() => validateAnalysisResult({ available: true })).toThrow(
      DocumentAnalysisProviderError,
    );
  });

  it("emptyProposal never invents official facts", () => {
    const p = emptyProposal();
    expect(p.available).toBe(false);
    expect(p.terrainIdentity.requisitionReference.value).toBeNull();
    expect(p.conflicts).toEqual([]);
  });
});
