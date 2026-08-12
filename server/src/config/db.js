import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["error"],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected via Prisma Client");
  } catch (err) {
    console.warn("PostgreSQL initial connection warning:", err.message);
  }
}
