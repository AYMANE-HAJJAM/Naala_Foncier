import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser } from "../../shared/authentication/current-user.decorator.js";
import type { AuthUser } from "../../shared/authentication/auth-user.js";
import { AuthCookieService } from "./auth-cookie.service.js";
import { AuthService } from "./auth.service.js";
import {
  AuthUserResponseDto,
  LoginDto,
  LoginResponseDto,
} from "./dto/auth.dto.js";
import { Public } from "./public.decorator.js";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @Throttle({
    default: {
      limit: () => (process.env.NODE_ENV === "production" ? 5 : 30),
      ttl: 60_000,
    },
  })
  @ApiOperation({ operationId: "login" })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.login(dto, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    this.cookies.set(response, result.refreshToken);
    const { refreshToken, ...safe } = result;
    void refreshToken;
    return safe;
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ operationId: "refreshSession" })
  @ApiOkResponse({ type: LoginResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.naala_refresh as string | undefined;
    if (!token) {
      throw new UnauthorizedException({
        code: "REFRESH_TOKEN_MISSING",
        message: "La session a expire.",
      });
    }
    const result = await this.service.refresh(token);
    this.cookies.set(response, result.refreshToken);
    const { refreshToken, ...safe } = result;
    void refreshToken;
    return safe;
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ operationId: "logout" })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      await this.service.logout(request.cookies?.naala_refresh as string | undefined);
    } finally {
      this.cookies.clear(response);
    }
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ operationId: "getCurrentUser" })
  @ApiOkResponse({ type: AuthUserResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user.id);
  }
}
