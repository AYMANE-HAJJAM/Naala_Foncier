import { Global, Module } from "@nestjs/common";
import { AccessScopeService } from "./access-scope.service.js";

@Global()
@Module({
  providers: [AccessScopeService],
  exports: [AccessScopeService],
})
export class AccessModule {}
