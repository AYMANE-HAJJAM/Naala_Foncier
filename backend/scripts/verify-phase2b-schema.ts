import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  await prisma.aIAnalysisRun.findMany({ select: { id: true, contextType: true }, take: 1 });
  console.log("Phase 2B schema smoke: PASS (AIAnalysisRun.contextType readable)");
} finally {
  await prisma.$disconnect();
}
