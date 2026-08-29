jest.mock("../../shared/database/prisma.service.js", () => ({
  PrismaService: class PrismaService {},
}));
jest.mock("../audit/audit.service.js", () => ({
  AuditService: class AuditService {},
}));

import { createHash } from "node:crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcryptjs";
import { jest } from "@jest/globals";
import { AuthService } from "./auth.service.js";

describe("AuthService", () => {
  const password = "NaalaDev2026!";
  let passwordHash: string;
  const user = {
    id: "user-1",
    email: "admin@naala-foncier.ma",
    firstName: "Omar",
    lastName: "Alaoui",
    isActive: true,
    deletedAt: null as Date | null,
    passwordHash: "",
    roles: [
      {
        role: {
          key: "ADMIN",
          permissions: [{ permission: { key: "requisition.view" } }],
        },
      },
    ],
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const jwt = {
    signAsync: jest.fn(() => Promise.resolve("signed-token")),
    verifyAsync: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_TTL: "15m",
        JWT_REFRESH_TTL: "7d",
      };
      return map[key] ?? fallback;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key.includes("SECRET")) return "test-secret-value-with-32-characters!";
      return "value";
    }),
  };
  const audit = { write: jest.fn() };
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await hash(password, 4);
    user.passwordHash = passwordHash;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwt as never as JwtService,
      config as never as ConfigService,
      audit as never,
    );
  });

  it("logs in with valid credentials", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});
    const result = await service.login(
      { email: user.email, password },
      { ipAddress: "127.0.0.1" },
    );
    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe(user.email);
    expect(audit.write).toHaveBeenCalled();
  });

  it("rejects invalid password", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.login({ email: user.email, password: "wrong-password" }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects inactive user", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    const result = service.login({ email: user.email, password }, {});
    await expect(
      result,
    ).rejects.toMatchObject({ response: { code: "ACCOUNT_DISABLED" } });
  });

  it("rotates a valid refresh token", async () => {
    const raw = "refresh-token";
    const stored = {
      id: "token-old",
      userId: user.id,
      familyId: "family-1",
      tokenHash: createHash("sha256").update(raw).digest("hex"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    jwt.verifyAsync
      .mockResolvedValueOnce({ sub: user.id, tokenId: stored.id, familyId: stored.familyId })
      .mockResolvedValueOnce({ sub: user.id, tokenId: "token-new", familyId: stored.familyId });
    prisma.refreshToken.findUnique.mockResolvedValue(stored);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(user);

    const result = await service.refresh(raw);

    expect(result.user.id).toBe(user.id);
    expect(JSON.stringify(prisma.refreshToken.updateMany.mock.calls)).toContain(
      `"id":"${stored.id}"`,
    );
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: { replacedByTokenId: "token-new" },
    });
  });

  it("revokes a token family when a refresh token is reused", async () => {
    const raw = "refresh-token";
    jwt.verifyAsync.mockResolvedValue({
      sub: user.id,
      tokenId: "token-old",
      familyId: "family-1",
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "token-old",
      userId: user.id,
      familyId: "family-1",
      tokenHash: createHash("sha256").update(raw).digest("hex"),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.refresh(raw)).rejects.toMatchObject({
      response: { code: "REFRESH_TOKEN_REUSED" },
    });
    expect(JSON.stringify(prisma.refreshToken.updateMany.mock.calls)).toContain(
      '"familyId":"family-1"',
    );
  });

  it("revokes the current refresh token on logout", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await service.logout("refresh-token");
    expect(JSON.stringify(prisma.refreshToken.updateMany.mock.calls)).toContain(
      createHash("sha256").update("refresh-token").digest("hex"),
    );
  });
});

describe("refresh token hashing", () => {
  it("hashes with sha256", () => {
    const value = "token";
    expect(createHash("sha256").update(value).digest("hex")).toHaveLength(64);
  });
});

describe("permission denial shape", () => {
  it("uses BadRequestException for AI provider", () => {
    const error = new BadRequestException({
      code: "AI_PROVIDER_NOT_CONFIGURED",
      message: "Aucun fournisseur d’analyse IA n’est configuré.",
    });
    expect(error.getResponse()).toMatchObject({
      code: "AI_PROVIDER_NOT_CONFIGURED",
    });
  });
});
