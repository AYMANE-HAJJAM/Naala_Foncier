import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";
import { AuthCookieService } from "./auth-cookie.service.js";
@Module({ imports: [JwtModule.register({})], controllers: [AuthController, UsersController], providers: [AuthService, AuthCookieService, UsersService], exports: [UsersService] }) export class IdentityAccessModule {}
