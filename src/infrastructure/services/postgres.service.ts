import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { DatabasePort } from "../../specification/ports/database.port.js";
import type { ComposeService } from "../compose-parser.js";
import type { ContainerPort } from "../ports/container.port.js";

const DEFAULT_PORT = 5432;
const DEFAULT_USER = "test";
const DEFAULT_PASSWORD = "test";
const DEFAULT_DB = "test";

/**
 * PostgreSQL service handler.
 * Knows how to start, connect, seed, reset, and query a postgres container.
 */
export class PostgresService implements DatabasePort {
  private container: ContainerPort;
  private service: ComposeService;
  private composeFilePath: string;
  private connectionString: string = "";

  constructor(container: ContainerPort, service: ComposeService, composeFilePath: string) {
    this.container = container;
    this.service = service;
    this.composeFilePath = composeFilePath;
  }

  getUser(): string {
    return this.service.environment.POSTGRES_USER ?? DEFAULT_USER;
  }

  getPassword(): string {
    return this.service.environment.POSTGRES_PASSWORD ?? DEFAULT_PASSWORD;
  }

  getDatabase(): string {
    return this.service.environment.POSTGRES_DB ?? DEFAULT_DB;
  }

  getConnectionString(): string {
    if (!this.connectionString) {
      const host = this.container.getHost();
      const port = this.container.getMappedPort(DEFAULT_PORT);
      this.connectionString = `postgresql://${this.getUser()}:${this.getPassword()}@${host}:${port}/${this.getDatabase()}`;
    }
    return this.connectionString;
  }

  /**
   * Find and execute init.sql if it exists.
   */
  async initialize(): Promise<void> {
    const composeDir = dirname(this.composeFilePath);
    const initPaths = [
      resolve(composeDir, "postgres/init.sql"),
      resolve(composeDir, `${this.service.name}/init.sql`),
    ];

    for (const initPath of initPaths) {
      if (existsSync(initPath)) {
        const sql = readFileSync(initPath, "utf8");
        await this.seed(sql);
        return;
      }
    }
  }

  async seed(sql: string): Promise<void> {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: this.getConnectionString() });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  }

  async query(table: string, columns: string[]): Promise<unknown[][]> {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: this.getConnectionString() });
    await client.connect();
    try {
      const columnList = columns.join(", ");
      const result = await client.query(`SELECT ${columnList} FROM "${table}" ORDER BY 1`);
      return result.rows.map((row: Record<string, unknown>) => columns.map((col) => row[col]));
    } finally {
      await client.end();
    }
  }

  async reset(): Promise<void> {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: this.getConnectionString() });
    await client.connect();
    try {
      const result = await client.query(`
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename NOT LIKE '_prisma%'
            `);
      for (const row of result.rows) {
        await client.query(`TRUNCATE "${row.tablename}" CASCADE`);
      }
    } finally {
      await client.end();
    }
  }
}
