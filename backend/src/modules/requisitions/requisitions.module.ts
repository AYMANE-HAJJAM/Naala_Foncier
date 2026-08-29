import { Module } from "@nestjs/common";
import { RequisitionsController } from "./requisitions.controller.js";
import { RequisitionsService } from "./requisitions.service.js";
@Module({ controllers: [RequisitionsController], providers: [RequisitionsService], exports: [RequisitionsService] }) export class RequisitionsModule {}
