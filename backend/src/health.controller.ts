import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "./modules/identity-access/public.decorator.js";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ operationId: "getHealth" })
  health() {
    return { status: "ok", service: "naala-foncier-api", timestamp: new Date().toISOString() };
  }
}
