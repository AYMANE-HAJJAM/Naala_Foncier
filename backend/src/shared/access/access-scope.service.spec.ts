import { ForbiddenException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { AccessScopeService } from "./access-scope.service.js";

describe("AccessScopeService", () => {
  it("refuses a non-assigned USER", async () => {
    const prisma = {
      userRequisitionAccess: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new AccessScopeService(prisma as never);

    await expect(
      service.assertCanAccessRequisition(
        {
          id: "user-1",
          email: "user@naala.test",
          firstName: "User",
          lastName: "Test",
          roles: ["USER"],
          permissions: ["requisition.view"],
        },
        "terrain-2",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
