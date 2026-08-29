import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Naala Foncier API")
    .setDescription("API de gestion des réquisitions foncières, documents et dossiers juridiques.")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
