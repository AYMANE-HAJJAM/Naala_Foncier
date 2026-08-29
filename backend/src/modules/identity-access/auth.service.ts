import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import type { LoginDto } from "./dto/auth.dto.js";
import { ttlToSeconds } from "../../shared/authentication/token-ttl.js";

interface RefreshClaims {
  sub: string;
  tokenId: string;
  familyId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}
  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
  private async loadUser(id: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user)
      throw new UnauthorizedException("Utilisateur inactif ou introuvable.");
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => r.role.key),
      permissions: [
        ...new Set(
          user.roles.flatMap((r) =>
            r.role.permissions.map((p) => p.permission.key),
          ),
        ),
      ],
    };
  }
  private async issue(user: AuthUser, familyId: string = randomUUID()) {
    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL", "15m");
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "7d");
    const tokenId = randomUUID();
    const rawSecret = randomBytes(32).toString("hex");
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, tokenId, familyId, secret: rawSecret },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshTtl as never,
      },
    );
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + ttlToSeconds(refreshTtl) * 1000),
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessTtl as never,
      },
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: ttlToSeconds(accessTtl),
      user,
    };
  }
  async login(
    dto: LoginDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const email = dto.email.trim().toLowerCase();
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record || !(await compare(dto.password, record.passwordHash))) {
      this.logger.warn(`Login rejected for ${email}: invalid credentials`);
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Adresse e-mail ou mot de passe incorrect.",
      });
    }
    if (!record.isActive || record.deletedAt) {
      this.logger.warn(`Login rejected for ${email}: account disabled`);
      throw new UnauthorizedException({
        code: "ACCOUNT_DISABLED",
        message: "Votre compte est desactive. Contactez l'administrateur.",
      });
    }
    await this.prisma.user.update({
      where: { id: record.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.write({
      actorUserId: record.id,
      action: "LOGIN",
      entityType: "User",
      entityId: record.id,
      metadata,
    });
    this.logger.log(`Login succeeded for user ${record.id}`);
    return this.issue(await this.loadUser(record.id));
  }
  async refresh(raw: string) {
    let claims: RefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshClaims>(raw, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      this.logger.warn("Refresh rejected: invalid or expired token");
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_INVALID",
        message: "La session a expiré.",
      });
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: claims.tokenId },
    });
    const now = new Date();
    if (
      !stored ||
      stored.tokenHash !== this.hash(raw) ||
      stored.revokedAt ||
      stored.expiresAt < now
    ) {
      const reuseDetected = Boolean(
        stored && (stored.revokedAt || stored.tokenHash !== this.hash(raw)),
      );
      if (stored)
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId },
          data: { revokedAt: new Date() },
        });
      this.logger.warn(`Refresh rejected: ${reuseDetected ? "token reuse" : "invalid session"}`);
      throw new UnauthorizedException({
        code: reuseDetected ? "REFRESH_TOKEN_REUSED" : "REFRESH_TOKEN_INVALID",
        message: "La session n’est plus valide.",
      });
    }
    let user: AuthUser;
    try {
      user = await this.loadUser(stored.userId);
    } catch (error) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      this.logger.warn(`Refresh rejected: inactive user ${stored.userId}`);
      throw error;
    }
    const claimed = await this.prisma.refreshToken.updateMany({
      where: {
        id: stored.id,
        tokenHash: stored.tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    if (claimed.count !== 1) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      this.logger.warn(`Refresh reuse detected for family ${stored.familyId}`);
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_REUSED",
        message: "La session n'est plus valide.",
      });
    }
    const next = await this.issue(
      user,
      stored.familyId,
    );
    const decoded = await this.jwt.verifyAsync<RefreshClaims>(
      next.refreshToken,
      { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET") },
    );
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { replacedByTokenId: decoded.tokenId },
    });
    return next;
  }
  async logout(raw?: string) {
    if (!raw) return;
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count > 0) this.logger.log("Refresh session revoked by logout");
  }
  me(id: string) {
    return this.loadUser(id);
  }
}
