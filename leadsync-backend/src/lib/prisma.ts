import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not defined.");
  process.exit(1);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create client with minimal lifecycle logging
const createPrismaClient = () => {
  console.log("🔌 [Prisma] Instantiating new PrismaClient (establishing connection pool)...");
  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
  });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
