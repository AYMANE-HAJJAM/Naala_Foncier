import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { IS_PUBLIC_KEY } from "../../modules/identity-access/public.decorator.js";
@Injectable()
export class GlobalAuthGuard extends JwtAuthGuard { constructor(private readonly reflector: Reflector) { super(); } override canActivate(context: ExecutionContext) { if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true; return super.canActivate(context); } }
