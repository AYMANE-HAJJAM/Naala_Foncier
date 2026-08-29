import { TerrainEventsService } from "./terrain-events.service.js";
import { jest } from "@jest/globals";

const admin = {
  id: "admin-1",
  email: "admin@naala.test",
  firstName: "Admin",
  lastName: "Test",
  roles: ["ADMIN"],
  permissions: ["requisition.view"],
};

const user = { ...admin, id: "user-1", roles: ["USER"] };

describe("TerrainEventsService.upcoming", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-25T10:00:00.000Z"));
  });

  afterEach(() => jest.useRealTimers());

  function setup(filter: { in: string[] } | undefined) {
    let capturedWhere: Record<string, unknown> | undefined;
    const findMany = jest.fn((args: { where: Record<string, unknown> }) => {
      capturedWhere = args.where;
      return Promise.resolve([]);
    });
    const prisma = { terrainEvent: { findMany } };
    const access = { requisitionIdFilter: jest.fn().mockResolvedValue(filter) };
    return {
      prisma,
      getWhere: () => capturedWhere,
      service: new TerrainEventsService(
        prisma as never,
        access as never,
        {} as never,
        {} as never,
      ),
    };
  }

  it("requests only confirmed future scheduled events", async () => {
    const { getWhere, service } = setup({ in: ["terrain-1"] });
    await service.upcoming(user, 30);

    const where = getWhere();
    expect(where).toMatchObject({
      validationStatus: "CONFIRMED",
      isScheduled: true,
      requisitionId: { in: ["terrain-1"] },
      scheduledAt: {
        gte: new Date("2026-08-25T10:00:00.000Z"),
        lte: new Date("2026-09-24T10:00:00.000Z"),
      },
    });
  });

  it("does not restrict an ADMIN to assignment ids", async () => {
    const { getWhere, service } = setup(undefined);
    await service.upcoming(admin, 30);
    expect(getWhere()).not.toHaveProperty("requisitionId");
  });
});
