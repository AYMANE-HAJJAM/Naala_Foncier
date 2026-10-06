import { UnauthorizedException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { JwtStrategy } from "./jwt.strategy.js";

describe("JwtStrategy", () => {
  const config = {
    getOrThrow: jest.fn(() => "test-secret-value-with-32-characters!"),
  };
  const prisma = { user: { findUnique: jest.fn() }, refreshToken: { findUnique: jest.fn() } };
  const strategy = new JwtStrategy(config as never, prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.refreshToken.findUnique.mockResolvedValue({ userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() + 60000) });
  });

  it("reloads roles and permissions for an active user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.test",
      firstName: "User",
      lastName: "Test",
      isActive: true,
      deletedAt: null,
      roles: [
        {
          role: {
            key: "USER",
            permissions: [{ permission: { key: "requisition.view" } }],
          },
        },
      ],
    });

    await expect(
      strategy.validate({ sub: "user-1", email: "user@example.test", sessionId: "session-1" }),
    ).resolves.toMatchObject({
      roles: ["USER"],
      permissions: ["requisition.view"],
    });
  });

  it("rejects a user disabled after the access token was issued", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      isActive: false,
      deletedAt: null,
      roles: [],
    });

    await expect(
      strategy.validate({ sub: "user-1", email: "user@example.test", sessionId: "session-1" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects legacy access tokens without a session", async () => {
    await expect(strategy.validate({ sub: "user-1", email: "user@example.test" })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    null,
    { userId: "user-1", revokedAt: new Date(), expiresAt: new Date(Date.now() + 60000) },
    { userId: "user-1", revokedAt: null, expiresAt: new Date(0) },
    { userId: "another-user", revokedAt: null, expiresAt: new Date(Date.now() + 60000) },
  ])("rejects a missing, revoked, expired or foreign session", async (session) => {
    prisma.refreshToken.findUnique.mockResolvedValue(session);
    await expect(strategy.validate({ sub: "user-1", email: "user@example.test", sessionId: "session-1" })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
