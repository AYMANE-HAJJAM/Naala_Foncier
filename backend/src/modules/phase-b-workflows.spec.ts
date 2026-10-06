import { jest } from "@jest/globals";
import { TerrainEventsService } from "./events/terrain-events.service.js";
import { NotificationsService } from "./notifications/notifications.service.js";
import { ReportsService } from "./reports/reports.service.js";

const admin = { id: "00000000-0000-4000-8000-000000000001", roles: ["ADMIN"] };
const user = { id: "00000000-0000-4000-8000-000000000002", roles: ["USER"] };

describe("Phase B report visibility", () => {
  it("filters USER lists to published reports", async () => {
    let where: unknown;
    const prisma = { report: { findMany: jest.fn((args: { where: unknown }) => { where = args.where; return Promise.resolve([]); }) } };
    const access = {
      isAdmin: jest.fn(() => false),
      requisitionIdFilter: jest.fn().mockResolvedValue({ in: ["terrain-1"] }),
      assignedRequisitionIds: jest.fn().mockResolvedValue(["terrain-1"]),
    };
    const service = new ReportsService(
      prisma as never,
      access as never,
      {} as never,
      { get: jest.fn() } as never,
      { write: jest.fn() } as never,
      { deliver: jest.fn() } as never,
    );
    await service.list(user as never);
    expect(where).toMatchObject({ deletedAt: null, status: "PUBLIE" });
  });
});

describe("Phase B notification idempotence", () => {
  it("uses a stable dedupe key for AI review notifications", async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([{ id: "admin-1" }]) }, notification: { createMany } };
    const service = new NotificationsService(prisma as never);
    await service.notifyAdminsOfTerrainUpdateProposals("terrain-1", "R 1/31", 2, "document-1");
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ dedupeKey: "AI_UPDATE_REVIEW:admin-1:document-1" })],
    }));
  });
});

describe("Phase B judicial postponement", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-08-25T10:00:00.000Z")));
  afterEach(() => jest.useRealTimers());

  it("preserves the old event and creates one future scheduled event transactionally", async () => {
    const existing = { id: "event-old", requisitionId: "terrain-1", legalCaseId: "case-1", hearingId: null, scheduledAt: new Date("2026-09-01T09:00:00.000Z") };
    const created = { ...existing, id: "event-new", type: "COURT_HEARING_POSTPONED", title: "Audience reportée", shortDescription: null, occurredAt: new Date(), source: "MANUAL", sourceDocumentId: null, validationStatus: "CONFIRMED", isScheduled: true, scheduledAt: new Date("2026-09-15T09:00:00.000Z"), createdAt: new Date() };
    const update = jest.fn().mockResolvedValue(existing);
    const create = jest.fn<(args: { data: { type: string; isScheduled: boolean; scheduledAt: Date } }) => Promise<typeof created>>().mockResolvedValue(created);
    const tx = { terrainEvent: { update, create }, auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = {
      terrainEvent: { findUnique: jest.fn().mockResolvedValue(existing) },
      requisition: { findUnique: jest.fn().mockResolvedValue({ reference: "R 1/31" }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const snapshots = { refreshFromEvents: jest.fn().mockResolvedValue({}) };
    const notifications = { notifyAssignedUsersOfConfirmedUpdate: jest.fn().mockResolvedValue(undefined) };
    const access = { assertCanAccessRequisition: jest.fn().mockResolvedValue(undefined), isAdmin: jest.fn(() => true) };
    const service = new TerrainEventsService(prisma as never, access as never, {} as never, snapshots as never, notifications as never);

    await service.reschedule("event-old", { scheduledAt: "2026-09-15T09:00:00.000Z" }, admin as never);

    expect(update).toHaveBeenCalledWith({ where: { id: "event-old" }, data: { isScheduled: false } });
    const createdData = create.mock.calls[0]?.[0].data;
    expect(createdData?.type).toBe("COURT_HEARING_POSTPONED");
    expect(createdData?.isScheduled).toBe(true);
    expect(createdData?.scheduledAt).toEqual(new Date("2026-09-15T09:00:00.000Z"));
    expect(snapshots.refreshFromEvents).toHaveBeenCalledWith("terrain-1");
  });
});
