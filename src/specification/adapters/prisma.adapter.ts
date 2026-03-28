import type { DatabasePort } from "../ports/database.port.js";

type PrismaLike = {
  $executeRawUnsafe: (sql: string) => Promise<unknown>;
  $queryRawUnsafe: <T = unknown>(sql: string) => Promise<T>;
};

/**
 * Database adapter for Prisma.
 * Works with any Prisma client instance that supports raw queries.
 */
export class PrismaAdapter implements DatabasePort {
  private prisma: PrismaLike;

  constructor(prisma: PrismaLike) {
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
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${columnList} FROM ${table}`,
    );

    return rows.map((row) => columns.map((col) => row[col]));
  }

  async reset(): Promise<void> {
    const tables = await this.prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'",
    );

    for (const { name } of tables) {
      await this.prisma.$executeRawUnsafe(`DELETE FROM "${name}"`);
    }
  }
}
