import type { DatabasePort } from "../../specification/ports/database.port.js";
import type { ServiceHandle } from "./service.port.js";

interface SqliteOptions {
  /** Use in-memory database. */
  memory?: boolean;
  /** Use Prisma adapter (requires @prisma/adapter-better-sqlite3). */
  prisma?: boolean;
}

class SqliteHandle implements DatabasePort, ServiceHandle {
  readonly type = "sqlite";
  readonly composeName = null;
  readonly defaultPort = 0;
  readonly defaultImage = "";
  readonly environment: Record<string, string> = {};
  readonly usePrisma: boolean;

  connectionString: string;
  started = false;
  private prismaClient: any = null;
  private sqliteDb: any = null;

  constructor(options: SqliteOptions = {}) {
    this.connectionString = options.memory ? ":memory:" : "file:./test.db";
    this.usePrisma = options.prisma ?? false;
  }

  buildConnectionString(): string {
    return this.connectionString;
  }

  createDatabaseAdapter(): DatabasePort {
    return this;
  }

  async start(): Promise<void> {
    if (this.usePrisma) {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      const adapter = new PrismaBetterSqlite3({ url: this.connectionString });

      // Dynamic import of the project's PrismaClient
      // The consumer must have @prisma/client installed
      const prismaModule = (await import("@prisma/client")) as any;
      this.prismaClient = new prismaModule.PrismaClient({ adapter });
    } else {
      const betterSqlite3 = await import("better-sqlite3");
      const Database = betterSqlite3.default;
      this.sqliteDb = new Database(this.connectionString);
    }

    this.started = true;
  }

  async initialize(): Promise<void> {
    // SQLite doesn't use compose, no init scripts
  }

  async seed(sql: string): Promise<void> {
    if (this.prismaClient) {
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await this.prismaClient.$executeRawUnsafe(statement);
      }
    } else if (this.sqliteDb) {
      this.sqliteDb.exec(sql);
    }
  }

  async query(table: string, columns: string[]): Promise<unknown[][]> {
    const columnList = columns.join(", ");

    if (this.prismaClient) {
      const rows = await this.prismaClient.$queryRawUnsafe(`SELECT ${columnList} FROM "${table}"`);
      return rows.map((row: Record<string, unknown>) => columns.map((col) => row[col]));
    }

    if (this.sqliteDb) {
      const rows = this.sqliteDb.prepare(`SELECT ${columnList} FROM "${table}"`).all();
      return rows.map((row: Record<string, unknown>) => columns.map((col) => row[col]));
    }

    return [];
  }

  async reset(): Promise<void> {
    if (this.prismaClient) {
      const tables = (await this.prismaClient.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'",
      )) as { name: string }[];

      for (const { name } of tables) {
        await this.prismaClient.$executeRawUnsafe(`DELETE FROM "${name}"`);
      }
    } else if (this.sqliteDb) {
      const tables = this.sqliteDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      for (const { name } of tables) {
        this.sqliteDb.exec(`DELETE FROM "${name}"`);
      }
    }
  }

  /** Get the underlying Prisma client (for app factory). */
  get client(): any {
    return this.prismaClient ?? this.sqliteDb;
  }
}

/**
 * Create a SQLite service handle (in-process, no container).
 *
 * @example
 * const db = sqlite({ memory: true, prisma: true });
 * // No container needed — runs in-process
 */
export function sqlite(options: SqliteOptions = {}): SqliteHandle {
  return new SqliteHandle(options);
}
