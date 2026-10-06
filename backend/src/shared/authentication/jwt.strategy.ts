import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser } from "./auth-user.js";

interface JwtPayload { sub: string; email: string; sessionId?: string }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET") });
  }
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sessionId) throw new UnauthorizedException("Session invalide.");
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Session invalide.");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user || !user.isActive || user.deletedAt) {
      this.logger.warn(`Protected request denied for inactive or missing user ${payload.sub}`);
      throw new UnauthorizedException("Session invalide.");
    }
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles.map((r) => r.role.key), permissions: [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))] };
  }
}
