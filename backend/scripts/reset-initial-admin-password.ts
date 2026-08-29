import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";

const url = process.env.DATABASE_URL;
const password = process.env.INITIAL_ADMIN_PASSWORD;
const email = (process.env.INITIAL_ADMIN_EMAIL ?? "admin@naala-foncier.ma")
  .trim()
  .toLowerCase();

if (!url) throw new Error("DATABASE_URL is required.");
if (!password) throw new Error("INITIAL_ADMIN_PASSWORD is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const admin = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!admin) {
    throw new Error(`Admin account ${email} does not exist. Run npm run db:seed first.`);
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: await hash(password, 12) },
  });
  await prisma.refreshToken.updateMany({
    where: { userId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(`Password reset for ${email}. Existing sessions were revoked.`);
} finally {
  await prisma.$disconnect();
}
