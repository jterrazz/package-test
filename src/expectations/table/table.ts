import { refusal } from '../../../lint/refusal.js';
import { CaptureScope } from '../tokens/match.js';

export type TableContent = { columns: string[]; rows: unknown[][] };

function comparableCell(cell: unknown): unknown {
    return cell instanceof Date ? cell.toISOString() : cell;
}

export type TableSource = {
    columns: (table: string) => Promise<string[]>;
    query: (table: string, columns: string[]) => Promise<unknown[][]>;
};

/** Read-only accessor for a database table, compared whole: every column, every row. */
export class TableAccessor {
    /** @internal */
    readonly captures: CaptureScope;
    /** @internal */
    private readonly db: TableSource;
    /** The table name this accessor reads. */
    readonly name: string;

    constructor(name: string, db: TableSource, captures?: CaptureScope) {
        this.name = name;
        this.db = db;
        this.captures = captures ?? new CaptureScope();
    }

    /** @internal */
    async query(columns: string[]): Promise<unknown[][]> {
        return await this.db.query(this.name, columns);
    }

    /** @internal */
    async content(): Promise<TableContent> {
        const columns = await this.db.columns(this.name);
        if (columns.length === 0) {
            throw new Error(
                refusal({
                    fix: 'name a table the database holds, or create it in the init script or a seed',
                    found: `table "${this.name}" has no columns: the database holds no such table`,
                    read: 'docs/21-assertions.md#resulttablename--database---database-tables-api-job-cli-integration',
                    why: 'A table is read from the database that holds it.',
                }),
            );
        }
        const rows = await this.db.query(this.name, columns);
        return { columns, rows: rows.map((row) => row.map((cell) => comparableCell(cell))) };
    }
}
