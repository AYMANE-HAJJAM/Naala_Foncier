import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthUser } from "../authentication/auth-user.js";
import { PERMISSIONS_KEY } from "./permissions.decorator.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user || !required.every((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Vous ne disposez pas de l’autorisation requise." });
    }
    return true;
  }
}
