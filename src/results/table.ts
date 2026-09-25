import { CaptureScope } from '../model/matching/match.js';
import type { DatabasePort } from '../model/ports/database.port.js';

/** A table as a whole-table comparison reads it: every column, in the table's order, and every row. */
export type TableContent = { columns: string[]; rows: unknown[][] };

/** A cell as a value written in place can state it: an instant is its ISO text. */
function comparableCell(cell: unknown): unknown {
    return cell instanceof Date ? cell.toISOString() : cell;
}

/**
 * Read-only accessor for a database table after a specification run.
 *
 * Assertions go through `expect()` (async — they query the database), and the
 * table is compared WHOLE — every column, in the table's order, every row:
 *
 *     await expect(result.table('users', { database: 'db' })).toMatch([
 *         ['{{int}}', 'Alice', 'alice@test.com'],
 *     ]);
 *     await expect(result.table('users', { database: 'db' })).toBeEmpty();
 */
export class TableAccessor {
    /** @internal Ref-capture scope shared by the current spec execution. */
    readonly captures: CaptureScope;
    /** @internal */
    private readonly db: DatabasePort;
    /** The table name this accessor reads. */
    readonly name: string;

    constructor(name: string, db: DatabasePort, captures?: CaptureScope) {
        this.name = name;
        this.db = db;
        this.captures = captures ?? new CaptureScope();
    }

    /** @internal Query the table — used by the toBeEmpty matcher. */
    async query(columns: string[]): Promise<unknown[][]> {
        return await this.db.query(this.name, columns);
    }

    /**
     * The whole table, as the whole-table `toMatch` compares it.
     *
     * @internal
     */
    async content(): Promise<TableContent> {
        const columns = await this.db.columns(this.name);
        if (columns.length === 0) {
            throw new Error(
                `table "${this.name}" has no columns: the database holds no such table.`,
            );
        }
        const rows = await this.db.query(this.name, columns);
        return { columns, rows: rows.map((row) => row.map((cell) => comparableCell(cell))) };
    }
}
