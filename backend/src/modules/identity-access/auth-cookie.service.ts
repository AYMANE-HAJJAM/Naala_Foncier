import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { ttlToSeconds } from "../../shared/authentication/token-ttl.js";

const REFRESH_COOKIE = "naala_refresh";

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  private options(): CookieOptions {
    const sameSite = this.config.get<"lax" | "strict" | "none">(
      "AUTH_COOKIE_SAME_SITE",
      "lax",
    );
    const domain = this.config.get<string>("AUTH_COOKIE_DOMAIN") || undefined;
    return {
      httpOnly: true,
      secure:
        this.config.get<string>("NODE_ENV") === "production" ||
        this.config.get<string>("AUTH_COOKIE_SECURE", "false") === "true",
      sameSite,
      domain,
      path: "/api/auth",
    };
  }

  set(response: Response, token: string) {
    const maxAge =
      ttlToSeconds(this.config.get<string>("JWT_REFRESH_TTL", "7d")) * 1_000;
    response.cookie(REFRESH_COOKIE, token, { ...this.options(), maxAge });
  }

  clear(response: Response) {
    response.clearCookie(REFRESH_COOKIE, this.options());
  }
}
