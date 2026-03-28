import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "./generated/client/index.js";

export function createDatabase() {
  const adapter = new PrismaBetterSqlite3({ url: ":memory:" });
  const prisma = new PrismaClient({ adapter });

  return { prisma };
}

/**
 * Initialize the database schema.
 * Call this before running tests.
 */
export async function initializeSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "User" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "name" TEXT NOT NULL,
            "email" TEXT NOT NULL UNIQUE
        )
    `);
}
