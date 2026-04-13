import type { DatabasePort } from '../ports/database.port.js';
import { formatTableDiff } from '../utilities/reporter.js';

export class TableAssertion {
    private tableName: string;
    private db: DatabasePort;

    constructor(tableName: string, db: DatabasePort) {
        this.tableName = tableName;
        this.db = db;
    }

    async toMatch(expected: { columns: string[]; rows: unknown[][] }): Promise<void> {
        const actual = await this.db.query(this.tableName, expected.columns);
        if (JSON.stringify(actual) !== JSON.stringify(expected.rows)) {
            throw new Error(
                formatTableDiff(this.tableName, expected.columns, expected.rows, actual),
            );
        }
    }

    async toBeEmpty(): Promise<void> {
        const actual = await this.db.query(this.tableName, ['*']);
        if (actual.length !== 0) {
            throw new Error(
                `Expected table "${this.tableName}" to be empty, but it has ${actual.length} rows`,
            );
        }
    }
}
