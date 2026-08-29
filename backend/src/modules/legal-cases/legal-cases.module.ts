import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module.js";
import { LegalCasesController } from "./legal-cases.controller.js";
import { LegalCasesService } from "./legal-cases.service.js";

@Module({ imports: [EventsModule], controllers: [LegalCasesController], providers: [LegalCasesService] })
export class LegalCasesModule {}
