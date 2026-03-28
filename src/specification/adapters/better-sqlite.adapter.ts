import type { DatabasePort } from "../ports/database.port.js";

/**
 * Database adapter for better-sqlite3.
 * Synchronous SQLite — perfect for testing.
 */
export class BetterSqliteAdapter implements DatabasePort {
  private db: {
    exec: (sql: string) => void;
    prepare: (sql: string) => { all: () => Record<string, unknown>[] };
  };

  constructor(db: {
    exec: (sql: string) => void;
    prepare: (sql: string) => { all: () => Record<string, unknown>[] };
  }) {
    this.db = db;
  }

  async seed(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async query(table: string, columns: string[]): Promise<unknown[][]> {
    const columnList = columns.join(", ");
    const rows = this.db.prepare(`SELECT ${columnList} FROM ${table}`).all();

    return rows.map((row) => columns.map((col) => row[col]));
  }

  async reset(): Promise<void> {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    for (const { name } of tables) {
      this.db.exec(`DELETE FROM ${name}`);
    }
  }
}
