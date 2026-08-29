import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI (migrate/generate) uses the direct Neon URL.
// Runtime Prisma Client uses DATABASE_URL via the pg adapter.
const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for Prisma CLI.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
