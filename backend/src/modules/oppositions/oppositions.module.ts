import { Module } from "@nestjs/common";
import { OppositionsController } from "./oppositions.controller.js";
import { OppositionsService } from "./oppositions.service.js";
@Module({ controllers: [OppositionsController], providers: [OppositionsService] }) export class OppositionsModule {}
