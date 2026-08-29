import { ForbiddenException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { PermissionsGuard } from "./permissions.guard.js";

describe("PermissionsGuard", () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new PermissionsGuard(reflector as never);

  function context(permissions: string[]) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions } }),
      }),
    } as never;
  }

  it("allows an ADMIN permission set", () => {
    reflector.getAllAndOverride.mockReturnValue(["user.manage"]);
    expect(guard.canActivate(context(["user.manage", "requisition.view"]))).toBe(true);
  });

  it("rejects a USER without the required permission", () => {
    reflector.getAllAndOverride.mockReturnValue(["user.manage"]);
    expect(() => guard.canActivate(context(["requisition.view"]))).toThrow(
      ForbiddenException,
    );
  });
});
