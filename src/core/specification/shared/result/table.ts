import { CaptureScope } from '../../../matching/match.js';
import type { DatabasePort } from '../../../ports/database.port.js';

/**
 * Read-only accessor for a database table after a specification run.
 *
 * Assertions go through `expect()` (async — they query the database):
 *
 *     await expect(result.table('users', { database: 'db' })).toMatchRows({
 *         columns: ['name'],
 *         rows: [['Alice']],
 *     });
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

    /** @internal Query the table — used by the toMatchRows / toBeEmpty matchers. */
    query(columns: string[]): Promise<unknown[][]> {
        return this.db.query(this.name, columns);
    }
}
