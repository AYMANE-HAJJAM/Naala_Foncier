import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { ActionsModule } from "./modules/actions/actions.module.js";
import { AIAnalysisModule } from "./modules/ai-analysis/ai-analysis.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { DashboardModule } from "./modules/dashboard/dashboard.module.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { EventsModule } from "./modules/events/events.module.js";
import { HearingsModule } from "./modules/hearings/hearings.module.js";
import { IdentityAccessModule } from "./modules/identity-access/identity-access.module.js";
import { LegalCasesModule } from "./modules/legal-cases/legal-cases.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { OppositionsModule } from "./modules/oppositions/oppositions.module.js";
import { ReportsModule } from "./modules/reports/reports.module.js";
import { RequisitionsModule } from "./modules/requisitions/requisitions.module.js";
import { TerrainDraftsModule } from "./modules/terrain-drafts/terrain-drafts.module.js";
import { AccessModule } from "./shared/access/access.module.js";
import { AuthenticationModule } from "./shared/authentication/authentication.module.js";
import { GlobalAuthGuard } from "./shared/authentication/global-auth.guard.js";
import { validateEnvironment } from "./shared/config/environment.js";
import { DatabaseModule } from "./shared/database/database.module.js";
import { PermissionsGuard } from "./shared/permissions/permissions.guard.js";
import { StorageModule } from "./shared/storage/storage.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    LoggerModule.forRoot({ pinoHttp: { autoLogging: true, redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "res.headers.set-cookie"] } }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AccessModule,
    AuthenticationModule,
    StorageModule,
    AuditModule,
    IdentityAccessModule,
    RequisitionsModule,
    DashboardModule,
    DocumentsModule,
    OppositionsModule,
    LegalCasesModule,
    HearingsModule,
    ActionsModule,
    NotificationsModule,
    ReportsModule,
    AIAnalysisModule,
    EventsModule,
    TerrainDraftsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: GlobalAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
