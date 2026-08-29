import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module.js";
import { HearingsController } from "./hearings.controller.js";
import { HearingsService } from "./hearings.service.js";

@Module({
  imports: [EventsModule],
  controllers: [HearingsController],
  providers: [HearingsService],
})
export class HearingsModule {}
