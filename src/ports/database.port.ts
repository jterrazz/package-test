/**
 * Abstract database interface for specification runners.
 * Implement this to plug in your database stack.
 */
export interface DatabasePort {
    /** Execute raw SQL (for seeding test data). */
    seed(sql: string): Promise<void>;

    /** Query a table and return rows as arrays of values. */
    query(table: string, columns: string[]): Promise<unknown[][]>;

    /** Reset database to clean state between tests. */
    reset(): Promise<void>;
}
