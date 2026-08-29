import { StatusSnapshotService } from "./status-snapshot.service.js";
import { jest } from "@jest/globals";

describe("StatusSnapshotService", () => {
  it("ignores a past scheduled event when computing the next date", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-25T10:00:00.000Z"));
    const past = new Date("2026-08-20T09:00:00.000Z");
    const future = new Date("2026-09-02T09:00:00.000Z");
    let capturedCreate: { nextScheduledEventAt: Date | null } | undefined;
    const prisma = {
      terrainEvent: {
        findMany: jest.fn().mockResolvedValue([
          { id: "latest", type: "GENERAL_UPDATE", title: "Mise à jour", occurredAt: new Date("2026-08-24T09:00:00Z"), createdAt: new Date(), isScheduled: false, scheduledAt: null },
          { id: "past", type: "COURT_HEARING_SCHEDULED", title: "Ancienne audience", occurredAt: past, createdAt: past, isScheduled: true, scheduledAt: past },
          { id: "future", type: "COURT_HEARING_SCHEDULED", title: "Prochaine audience", occurredAt: new Date(), createdAt: new Date(), isScheduled: true, scheduledAt: future },
        ]),
      },
      requisition: {
        findUnique: jest.fn().mockResolvedValue({ legalCases: [], courtReached: "Non", mainStatus: "EN_COURS", mainStatusLabel: "En cours", mainIssue: null, dataFreshness: "À confirmer" }),
        update: jest.fn().mockResolvedValue({}),
      },
      requisitionStatusSnapshot: {
        upsert: jest.fn().mockImplementation(
          ({ create }: { create: { nextScheduledEventAt: Date | null } }) => {
            capturedCreate = create;
            return Promise.resolve(create);
          },
        ),
      },
    };
    const service = new StatusSnapshotService(prisma as never);

    await service.refreshFromEvents("terrain-1");
    expect(capturedCreate?.nextScheduledEventAt).toEqual(future);
    expect(capturedCreate?.nextScheduledEventAt).not.toEqual(past);
    jest.useRealTimers();
  });
});
