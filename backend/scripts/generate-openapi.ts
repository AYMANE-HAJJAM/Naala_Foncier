import "reflect-metadata";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { createOpenApiDocument } from "../src/swagger.js";

process.env.DATABASE_URL ??= "postgresql://naala:naala@localhost:5432/naala_foncier?schema=public";
process.env.JWT_ACCESS_SECRET ??= "openapi-only-access-secret-not-for-runtime";
process.env.JWT_REFRESH_SECRET ??= "openapi-only-refresh-secret-not-runtime";
process.env.INITIAL_ADMIN_PASSWORD ??= "OpenApiOnly!";

const { AppModule } = await import("../src/app.module.js");
const app = await NestFactory.create(AppModule, { logger: ["error"], abortOnError: true });
const output = resolve(process.cwd(), "../openapi/naala-api.json");
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`, "utf8");
await app.close();
console.log(`OpenAPI generated: ${output}`);
