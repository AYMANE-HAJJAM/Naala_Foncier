import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./shared/errors/api-exception.filter.js";
import { createOpenApiDocument } from "./swagger.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
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
    app.getHttpAdapter().get(
      "/api/openapi.json",
      (_request: unknown, response: { json: (value: unknown) => void }) => response.json(document),
    );
  }
  await app.listen(config.get<number>("API_PORT", 3001));
}

void bootstrap();
