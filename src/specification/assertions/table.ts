import { formatTableDiff } from "../../infrastructure/reporter.js";
import type { DatabasePort } from "../ports/database.port.js";
import { BaseAssertion } from "./base.js";

/**
 * Assertions on a database table.
 * Usage: await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] })
 */
export class TableAssertion extends BaseAssertion {
  private tableName: string;
  private db: DatabasePort;

  constructor(tableName: string, db: DatabasePort) {
    super();
    this.tableName = tableName;
    this.db = db;
  }

  async toMatch(expected: { columns: string[]; rows: unknown[][] }): Promise<void> {
    const actual = await this.db.query(this.tableName, expected.columns);
    const match = JSON.stringify(actual) === JSON.stringify(expected.rows);
    this.assert(
      match,
      formatTableDiff(this.tableName, expected.columns, expected.rows, actual),
      `Expected table "${this.tableName}" NOT to match, but it did`,
    );
  }

  async toBeEmpty(): Promise<void> {
    // Query a single column to check if table has rows — use a lightweight approach
    const actual = await this.db.query(this.tableName, ["*"]);
    const empty = actual.length === 0;
    this.assert(
      empty,
      `Expected table "${this.tableName}" to be empty, but it has ${actual.length} rows`,
      `Expected table "${this.tableName}" NOT to be empty, but it is`,
    );
  }
}
