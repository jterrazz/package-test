import type { DatabasePort } from "../ports/database.port.js";

/**
 * Database adapter for Prisma.
 * Executes raw SQL for seeding and querying.
 */
export class PrismaAdapter implements DatabasePort {
  private prisma: {
    $executeRawUnsafe: (sql: string) => Promise<unknown>;
    $queryRawUnsafe: (sql: string) => Promise<Record<string, unknown>[]>;
  };

  constructor(prisma: {
    $executeRawUnsafe: (sql: string) => Promise<unknown>;
    $queryRawUnsafe: (sql: string) => Promise<Record<string, unknown>[]>;
  }) {
    this.prisma = prisma;
  }

  async seed(sql: string): Promise<void> {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await this.prisma.$executeRawUnsafe(statement);
    }
  }

  async query(table: string, columns: string[]): Promise<unknown[][]> {
    const columnList = columns.join(", ");
    const rows = await this.prisma.$queryRawUnsafe(`SELECT ${columnList} FROM ${table}`);

    return rows.map((row) => columns.map((col) => row[col]));
  }

  async reset(): Promise<void> {
    const tables = (await this.prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'",
    )) as { name: string }[];

    for (const { name } of tables) {
      await this.prisma.$executeRawUnsafe(`DELETE FROM ${name}`);
    }
  }
}
