import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

import type { DatabasePort } from "../../specification/ports/database.port.js";
import type { ServiceHandle } from "./service.port.js";

interface PostgresOptions {
  /** Map to a service in docker-compose.test.yaml. */
  compose?: string;
  /** Override image. */
  image?: string;
  /** Override environment variables. */
  env?: Record<string, string>;
}

class PostgresHandle implements DatabasePort, ServiceHandle {
  readonly type = "postgres";
  readonly composeName: null | string;
  readonly defaultPort = 5432;
  readonly defaultImage: string;
  readonly environment: Record<string, string>;

  connectionString = "";
  started = false;

  private client: Client | null = null;

  constructor(options: PostgresOptions = {}) {
    this.composeName = options.compose ?? null;
    this.defaultImage = options.image ?? "postgres:17";
    this.environment = {
      POSTGRES_DB: "test",
      POSTGRES_PASSWORD: "test",
      POSTGRES_USER: "test",
      ...options.env,
    };
  }

  buildConnectionString(host: string, port: number): string {
    const user = this.environment.POSTGRES_USER ?? "test";
    const password = this.environment.POSTGRES_PASSWORD ?? "test";
    const db = this.environment.POSTGRES_DB ?? "test";
    return `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }

  createDatabaseAdapter(): DatabasePort {
    return this;
  }

  async healthcheck(): Promise<void> {
    if (!this.connectionString) {
      throw new Error("postgres: cannot healthcheck — no connection string");
    }

    // Healthcheck uses a throwaway client (connection might not be established yet)
    try {
      const client = new Client({ connectionString: this.connectionString });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
    } catch (error: any) {
      throw new Error(
        `postgres healthcheck failed: ${error.message || error.code || String(error)}`,
        { cause: error },
      );
    }
  }

  async initialize(composeDir: string): Promise<void> {
    if (!this.composeName) {
      return;
    }

    const initPaths = [
      resolve(composeDir, `${this.composeName}/init.sql`),
      resolve(composeDir, "postgres/init.sql"),
    ];

    for (const initPath of initPaths) {
      if (existsSync(initPath)) {
        const sql = readFileSync(initPath, "utf8");
        try {
          await this.seed(sql);
        } catch (error: any) {
          throw new Error(`postgres init script failed (${initPath}):\n${error.message}`, {
            cause: error,
          });
        }
        return;
      }
    }
  }

  private async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }
    const client = new Client({ connectionString: this.connectionString });
    client.on("error", () => {
      // Connection dropped (container stopped) — reset so next call reconnects
      this.client = null;
    });
    await client.connect();
    this.client = client;
    return client;
  }

  async seed(sql: string): Promise<void> {
    const client = await this.getClient();
    await client.query(sql);
  }

  async query(table: string, columns: string[]): Promise<unknown[][]> {
    const client = await this.getClient();
    const columnList = columns.join(", ");
    const result = await client.query(`SELECT ${columnList} FROM "${table}" ORDER BY 1`);
    return result.rows.map((row: Record<string, unknown>) => columns.map((col) => row[col]));
  }

  async reset(): Promise<void> {
    const client = await this.getClient();
    const result = await client.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename NOT LIKE '_prisma%'
        `);
    for (const row of result.rows) {
      await client.query(`TRUNCATE "${row.tablename}" CASCADE`);
    }
  }
}

/**
 * Create a PostgreSQL service handle.
 *
 * @example
 * const db = postgres({ compose: "db" });
 * // After start: db.connectionString is populated
 */
export function postgres(options: PostgresOptions = {}): PostgresHandle {
  return new PostgresHandle(options);
}
