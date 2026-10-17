/** Database port for specification runners; implement it to plug in your stack. */
export type DatabasePort = {
    /** Execute raw SQL (for seeding test data). */
    seed: (sql: string) => Promise<void>;

    /** Query a table and return rows as arrays of values. */
    query: (table: string, columns: string[]) => Promise<unknown[][]>;

    /** The table's columns, in the order the table declares them: what a whole-table comparison reads. */
    columns: (table: string) => Promise<string[]>;

    /** Reset database to clean state between tests. */
    reset: () => Promise<void>;
};
