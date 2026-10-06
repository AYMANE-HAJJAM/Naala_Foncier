import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Express } from "express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./shared/errors/api-exception.filter.js";
import { createOpenApiDocument } from "./swagger.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  // Trust only the nearest proxy. Never trust arbitrary client-supplied hops.
  if (config.get<string>("NODE_ENV") === "production") app.set("trust proxy", 1);
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.getOrThrow<string>("WEB_ORIGIN"), credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  const swaggerEnabled = config.get<string>("SWAGGER_ENABLED", "false").toLowerCase() === "true";
  if (swaggerEnabled) {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup("api/docs", app, document);
    const expressApp: Express = app.getHttpAdapter().getInstance();
    expressApp.get(
      "/api/openapi.json",
      (_request, response) => response.json(document),
    );
  }
  app.enableShutdownHooks();
  await app.listen(config.get<number>("PORT") ?? config.get<number>("API_PORT", 3001), "0.0.0.0");
}

void bootstrap();
