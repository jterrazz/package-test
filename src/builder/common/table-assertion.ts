import type { DatabasePort } from '../../adapters/ports/database.port.js';
import { formatTableDiff } from './reporter.js';

/** Assertion helper for verifying database table contents after a specification run. */
export class TableAssertion {
    private tableName: string;
    private db: DatabasePort;

    constructor(tableName: string, db: DatabasePort) {
        this.tableName = tableName;
        this.db = db;
    }

    /**
     * Assert that the table contains exactly the expected rows for the given columns.
     *
     * @example
     *   await result.table("users").toMatch({
     *     columns: ["name", "email"],
     *     rows: [["Alice", "alice@example.com"]],
     *   });
     */
    async toMatch(expected: { columns: string[]; rows: unknown[][] }): Promise<void> {
        const actual = await this.db.query(this.tableName, expected.columns);
        if (JSON.stringify(actual) !== JSON.stringify(expected.rows)) {
            throw new Error(
                formatTableDiff(this.tableName, expected.columns, expected.rows, actual),
            );
        }
    }

    /** Assert that the table has zero rows. */
    async toBeEmpty(): Promise<void> {
        const actual = await this.db.query(this.tableName, ['*']);
        if (actual.length !== 0) {
            throw new Error(
                `Expected table "${this.tableName}" to be empty, but it has ${actual.length} rows`,
            );
        }
    }
}
