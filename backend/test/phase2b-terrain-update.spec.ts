import {
  dedupeAndNormalizeProposals,
  mapConflictsToProposals,
} from "../src/modules/ai-analysis/terrain-update-dedupe.js";
import { validateTerrainUpdateAnalysisResult } from "../src/modules/ai-analysis/terrain-update-analysis.provider.js";

const baseContext = {
  requisitionId: "req-1",
  reference: "R 148026/31",
  identity: {
    propertyName: "AL MOUSTAKBEL",
    location: "Enaala",
    surface: "53 ha 70 a 00 ca",
    seller: "A",
    buyer: "B",
    linkedRequisitions: [],
  },
  proceduralStatus: {
    currentStage: "BORNAGE_BLOQUE",
    currentLabel: "Bornage bloqué",
    latestKnownEvent: "Tentative de bornage",
    latestKnownEventAt: "2025-06-25T00:00:00.000Z",
    nextScheduledEventAt: "2026-09-15T00:00:00.000Z",
    judicialState: "Au tribunal",
  },
  courtCases: [
    {
      id: "lc-1",
      caseNumber: "2025/1403/237",
      courtName: "Sidi Ifni",
      currentStage: "AUDIENCE_PROGRAMMEE",
      nextEventAt: "2026-09-15T00:00:00.000Z",
    },
  ],
  recentEvents: [
    {
      id: "ev-1",
      type: "COURT_HEARING_SCHEDULED",
      title: "Audience programmée",
      occurredAt: "2026-01-01T00:00:00.000Z",
      scheduledAt: "2026-09-15T00:00:00.000Z",
      isScheduled: true,
      legalCaseId: "lc-1",
    },
  ],
  oppositions: [],
  upcomingDates: [
    {
      label: "Audience programmée",
      at: "2026-09-15T00:00:00.000Z",
      sourceType: "COURT_HEARING_SCHEDULED",
    },
  ],
};

describe("Phase 2B terrain update helpers", () => {
  it("validates terrain update analysis JSON", () => {
    const raw = {
      documentSummary: { shortSummary: "Convocation tribunal" },
      detectedUpdates: [
        {
          proposalType: "NEW_HEARING",
          title: "Audience",
          proposedData: { caseNumber: "2025/1403/237" },
          confidence: "HIGH",
          scheduledAt: "2026-10-13T00:00:00.000Z",
          eventType: "COURT_HEARING_SCHEDULED",
        },
      ],
      conflicts: [],
      newDates: [],
      pointsToClarify: [],
      noChange: false,
    };
    const result = validateTerrainUpdateAnalysisResult(raw);
    expect(result.detectedUpdates).toHaveLength(1);
  });

  it("dedupes known court case into DOCUMENT_INFORMATION", () => {
    const proposals = dedupeAndNormalizeProposals(
      [
        {
          proposalType: "NEW_COURT_CASE",
          title: "Nouvelle affaire",
          proposedData: { caseNumber: "2025/1403/237" },
          confidence: "HIGH",
        },
      ],
      baseContext,
    );
    expect(proposals[0]?.proposalType).toBe("DOCUMENT_INFORMATION");
  });

  it("dedupes duplicate hearing event", () => {
    const proposals = dedupeAndNormalizeProposals(
      [
        {
          proposalType: "NEW_HEARING",
          title: "Audience programmée",
          proposedData: {},
          confidence: "HIGH",
          eventType: "COURT_HEARING_SCHEDULED",
          scheduledAt: "2026-09-15T00:00:00.000Z",
        },
      ],
      baseContext,
    );
    expect(proposals[0]?.proposalType).toBe("DOCUMENT_INFORMATION");
  });

  it("maps identity conflicts to proposals", () => {
    const mapped = mapConflictsToProposals([
      {
        field: "surface",
        currentValue: "53 ha 70 a 00 ca",
        documentValue: "53 ha 07 a 00 ca",
        confidence: "HIGH",
      },
    ]);
    expect(mapped[0]?.proposalType).toBe("IDENTITY_CONFLICT");
  });

  it("accepts NO_CHANGE result", () => {
    const result = validateTerrainUpdateAnalysisResult({
      detectedUpdates: [],
      conflicts: [],
      newDates: [],
      pointsToClarify: [],
      noChange: true,
    });
    expect(result.noChange).toBe(true);
  });
});
